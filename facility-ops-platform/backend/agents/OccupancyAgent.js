const Zone = require('../models/Zone');
const OccupancyLog = require('../models/OccupancyLog');
const Alert = require('../models/Alert');
const env = require('../config/env');

const HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21]; // 3-hour buckets, same shape as Energy's heatmap

/**
 * OccupancyAgent
 * ------------------------------------------------------------------
 * Autonomous agent for the Occupancy domain. Follows the same shape as
 * EnergyAgent/MaintenanceAgent: stateless/functional, config pulled from
 * config/env.js, DB access only inside methods that need to persist
 * (detectOvercrowding writes Alerts, refreshCurrentOccupancy writes Zones).
 *
 * Core spec methods:
 *  - monitorOccupancy   : live occupancy rate per zone
 *  - detectOvercrowding : flags zones >= threshold, writes Alerts
 *  - analyzeUtilization : historical hour/day utilization buckets for heatmaps
 *
 * Supporting methods (needed to actually power the dashboard's KPIs/actions):
 *  - calculateWorkspaceEfficiency
 *  - refreshCurrentOccupancy
 *  - generateRecommendations
 *  - runOccupancyCycle (orchestrates all of the above for one facility)
 * ------------------------------------------------------------------
 */
class OccupancyAgent {
  constructor(config = {}) {
    this.overcrowdingThresholdPct = config.overcrowdingThresholdPct ?? env.agents.occupancy.overcrowdingThresholdPct;
    this.idealUtilizationPct = config.idealUtilizationPct ?? env.agents.occupancy.idealUtilizationPct;
    this.underutilizedThresholdPct = config.underutilizedThresholdPct ?? env.agents.occupancy.underutilizedThresholdPct;
    this.baselineWindowDays = config.baselineWindowDays ?? env.agents.occupancy.baselineWindowDays;
  }

  /**
   * monitorOccupancy(zoneData): computes a live occupancy rate (%) for
   * each zone. Pure function - takes plain Zone-shaped objects, doesn't
   * touch the DB, so it can be reused on any zone snapshot (live or seeded).
   */
  monitorOccupancy(zoneData = []) {
    return zoneData.map((z) => ({
      zoneId: z.zoneId,
      facilityId: z.facilityId,
      name: z.name,
      zoneType: z.zoneType,
      maxCapacity: z.maxCapacity,
      currentOccupancy: z.currentOccupancy,
      occupancyRate: z.maxCapacity > 0 ? Math.round((z.currentOccupancy / z.maxCapacity) * 100) : 0,
    }));
  }

  /**
   * detectOvercrowding(zones): flags any zone at/above the overcrowding
   * threshold (default 90%) and writes an Alert - skips zones that
   * already have an Active ZONE_OVERCROWDING alert so re-running the
   * scan doesn't spam duplicate alerts every cycle.
   */
  async detectOvercrowding(zones = []) {
    const monitored = this.monitorOccupancy(zones);
    const overcrowded = monitored.filter((z) => z.occupancyRate >= this.overcrowdingThresholdPct);

    const createdAlerts = [];
    for (const zone of overcrowded) {
      const existing = await Alert.findOne({
        facilityId: zone.facilityId,
        alertType: 'ZONE_OVERCROWDING',
        status: 'Active',
        'metadata.zoneId': zone.zoneId,
      }).lean();
      if (existing) continue;

      const alert = await Alert.create({
        facilityId: zone.facilityId,
        alertType: 'ZONE_OVERCROWDING',
        severity: zone.occupancyRate >= 100 ? 'Critical' : 'High',
        message: `${zone.name} is at ${zone.occupancyRate}% capacity (${zone.currentOccupancy}/${zone.maxCapacity}) — exceeds the ${this.overcrowdingThresholdPct}% overcrowding threshold.`,
        metadata: {
          zoneId: zone.zoneId,
          occupancyRate: zone.occupancyRate,
          currentOccupancy: zone.currentOccupancy,
          maxCapacity: zone.maxCapacity,
        },
        sourceAgent: 'OccupancyAgent',
      });
      createdAlerts.push(alert);
    }

    return { overcrowded, alertsCreated: createdAlerts.length };
  }

  /**
   * analyzeUtilization(logs): buckets zone-joined log entries into
   * 3-hour x day-of-week buckets and computes average utilization % per
   * bucket (for the heatmap) and per zone (for zone-level trend context).
   *
   * Each entry in `logs` must already be zone-joined:
   *   { zoneId, zoneName, maxCapacity, recordedOccupancy, timestamp }
   * (the controller does this join - keeps this method a pure calculator
   * that doesn't need to know about Mongoose at all).
   */
  analyzeUtilization(logs = []) {
    if (!logs.length) return { buckets: [], zoneAverages: [] };

    const bucketMap = new Map(); // `${day}-${hour}` -> { sum, count }
    const zoneTally = new Map(); // zoneId -> { sum, count, name }

    logs.forEach((log) => {
      const d = new Date(log.timestamp);
      const day = d.getDay();
      const bucketStart = HOUR_BUCKETS.filter((h) => h <= d.getHours()).pop() ?? 0;
      const utilizationPct = log.maxCapacity > 0 ? (log.recordedOccupancy / log.maxCapacity) * 100 : 0;

      const key = `${day}-${bucketStart}`;
      const bucket = bucketMap.get(key) || { sum: 0, count: 0 };
      bucket.sum += utilizationPct;
      bucket.count += 1;
      bucketMap.set(key, bucket);

      const zoneStat = zoneTally.get(log.zoneId) || { sum: 0, count: 0, name: log.zoneName };
      zoneStat.sum += utilizationPct;
      zoneStat.count += 1;
      zoneTally.set(log.zoneId, zoneStat);
    });

    const buckets = Array.from(bucketMap.entries()).map(([key, { sum, count }]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, avgUtilizationPct: Math.round(sum / count) };
    });

    const zoneAverages = Array.from(zoneTally.entries()).map(([zoneId, { sum, count, name }]) => ({
      zoneId,
      name,
      avgUtilizationPct: Math.round(sum / count),
    }));

    return { buckets, zoneAverages };
  }

  /**
   * calculateWorkspaceEfficiency(zones): bell-curve score around an ideal
   * utilization target (default 75%), scoped to Workspace-type zones only.
   * Mirrors EnergyAgent.calculateEfficiencyScore's baseline-deviation
   * approach - empty desks and overcrowded floors are both inefficient,
   * so the score decays in both directions away from the target.
   */
  calculateWorkspaceEfficiency(zones = []) {
    const workspaceZones = zones.filter((z) => z.zoneType === 'Workspace' && z.maxCapacity > 0);
    if (!workspaceZones.length) return null;

    const scores = workspaceZones.map((z) => {
      const utilizationPct = (z.currentOccupancy / z.maxCapacity) * 100;
      const deviationRatio = Math.abs(utilizationPct - this.idealUtilizationPct) / 100;
      return 100 * Math.exp(-3 * deviationRatio);
    });

    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * refreshCurrentOccupancy(facilityId): pulls the most recent
   * OccupancyLog entry for each of the facility's zones and writes it
   * back onto Zone.currentOccupancy. OccupancyLog is the source of
   * truth; Zone.currentOccupancy is a denormalized "latest reading"
   * cache read by every other method in this class - same relationship
   * as EnergyUsage -> Facility baseline, or MaintenanceRecord -> Asset.healthScore.
   */
  async refreshCurrentOccupancy(facilityId) {
    const zones = await Zone.find({ facilityId }).lean();

    const updates = await Promise.all(
      zones.map(async (zone) => {
        const latest = await OccupancyLog.findOne({ zoneId: zone.zoneId }).sort({ timestamp: -1 }).lean();
        if (!latest) return zone;

        await Zone.updateOne({ zoneId: zone.zoneId }, { $set: { currentOccupancy: latest.recordedOccupancy } });
        return { ...zone, currentOccupancy: latest.recordedOccupancy };
      })
    );

    return updates;
  }

  /**
   * generateRecommendations(metrics): turns monitored zones + workspace
   * efficiency into space-optimization recommendation cards, same shape
   * ({id, category, title, detail, priority}) as Energy's and
   * Maintenance's recommendation engines, for a consistent Agent Actions UI.
   */
  generateRecommendations(metrics = {}) {
    const { monitored = [], workspaceEfficiency } = metrics;
    const recommendations = [];

    monitored
      .filter((z) => z.occupancyRate >= this.overcrowdingThresholdPct)
      .forEach((z) => {
        recommendations.push({
          id: `overcrowding-${z.zoneId}`,
          category: 'Overcrowding',
          title: `Redistribute load from ${z.name}`,
          detail: `${z.name} is running at ${z.occupancyRate}% capacity (${z.currentOccupancy}/${z.maxCapacity}). Consider opening an overflow area or staggering access during peak hours.`,
          priority: z.occupancyRate >= 100 ? 'Critical' : 'High',
        });
      });

    monitored
      .filter((z) => z.zoneType === 'Workspace' && z.occupancyRate < this.underutilizedThresholdPct)
      .forEach((z) => {
        recommendations.push({
          id: `underused-${z.zoneId}`,
          category: 'Space Utilization',
          title: `Reclaim underused space in ${z.name}`,
          detail: `${z.name} is running at only ${z.occupancyRate}% capacity. Consider consolidating teams or repurposing part of this space.`,
          priority: 'Medium',
        });
      });

    if (
      typeof workspaceEfficiency === 'number' &&
      workspaceEfficiency < 70 &&
      !recommendations.some((r) => r.category !== 'General')
    ) {
      recommendations.push({
        id: 'workspace-rebalance',
        category: 'Space Utilization',
        title: 'Rebalance workspace allocation',
        detail: `Workspace efficiency is at ${workspaceEfficiency}%, below target. Review desk-booking patterns and consider a hot-desking policy adjustment.`,
        priority: 'Medium',
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: 'occupancy-nominal',
        category: 'General',
        title: 'Occupancy within healthy range',
        detail: 'No overcrowding or significant underutilization detected across monitored zones.',
        priority: 'Low',
      });
    }

    return recommendations;
  }

  /**
   * runOccupancyCycle(facilityId): orchestrates a full pass - refresh
   * live occupancy from logs, monitor, detect overcrowding (writes
   * Alerts), and generate recommendations. Used by the seed flow and the
   * dashboard's "Run Occupancy Scan" action.
   */
  async runOccupancyCycle(facilityId) {
    const zones = await this.refreshCurrentOccupancy(facilityId);
    const monitored = this.monitorOccupancy(zones);
    const { overcrowded, alertsCreated } = await this.detectOvercrowding(zones);
    const workspaceEfficiency = this.calculateWorkspaceEfficiency(zones);
    const recommendations = this.generateRecommendations({ monitored, workspaceEfficiency });

    return { zones: monitored, overcrowded, alertsCreated, workspaceEfficiency, recommendations };
  }
}

module.exports = OccupancyAgent;
module.exports.OccupancyAgent = OccupancyAgent;

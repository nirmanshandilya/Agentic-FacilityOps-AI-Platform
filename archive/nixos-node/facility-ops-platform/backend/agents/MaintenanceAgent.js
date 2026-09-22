const crypto = require('crypto');

const Asset = require('../models/Asset');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const Alert = require('../models/Alert');
const env = require('../config/env');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * MaintenanceAgent
 * ------------------------------------------------------------------
 * Autonomous agent for the Predictive Maintenance domain. Mirrors the
 * structure of EnergyAgent so both agents can later be coordinated by
 * a shared orchestration layer (see Milestone 4 in the project brief).
 *
 * Responsibilities:
 *  - evaluateAssetHealth : equipment condition scoring from mock
 *                          historical performance/uptime + real
 *                          maintenance history in the DB
 *  - predictFailures      : flags assets below the risk threshold and
 *                          projects a predicted failure date
 *  - generateWorkOrders   : creates pending MaintenanceRecord entries
 *                          and fires Alerts for high-risk predictions
 * ------------------------------------------------------------------
 */
class MaintenanceAgent {
  constructor(config = {}) {
    const cfg = env.agents.maintenance;
    this.healthWarningThreshold = config.healthWarningThreshold ?? cfg.healthWarningThreshold;
    this.healthCriticalThreshold = config.healthCriticalThreshold ?? cfg.healthCriticalThreshold;
    this.failureRiskThreshold = config.failureRiskThreshold ?? cfg.failureRiskThreshold;
    this.baseDecayRatePerDay = config.baseDecayRatePerDay ?? cfg.baseDecayRatePerDay;
    this.workOrderLeadTimeDays = config.workOrderLeadTimeDays ?? cfg.workOrderLeadTimeDays;
    this.workOrderWindowDays = config.workOrderWindowDays ?? cfg.workOrderWindowDays;
  }

  // ---------- Deterministic "sensor" helper ----------

  /**
   * In production this agent would consume a time-series of IoT
   * sensor/uptime telemetry per asset. Module 2 doesn't introduce a new
   * telemetry collection, so we derive a stable, deterministic "operating
   * stress" factor (0-1) from the assetId itself - the same asset always
   * yields the same factor, simulating a consistent hardware/usage
   * profile without needing to persist synthetic sensor rows. Swapping
   * this for a real telemetry aggregate later is a drop-in change.
   */
  static _stressFactor(assetId) {
    const hash = crypto.createHash('md5').update(assetId).digest('hex');
    const intVal = parseInt(hash.slice(0, 8), 16);
    return (intVal % 1000) / 1000; // 0.000 - 0.999
  }

  // ---------- Core agent methods ----------

  /**
   * Calculate a 0-100 equipment condition score for a single asset,
   * combining install-age decay, a deterministic operating-stress
   * penalty, and adjustments from real maintenance history.
   *
   * @param {Object} assetData - Asset document (must include assetId, installDate)
   * @param {Array}  [recentRecords] - this asset's MaintenanceRecord docs
   * @returns {{ healthScore:number, status:string, breakdown:Object }}
   */
  evaluateAssetHealth(assetData, recentRecords = []) {
    const now = Date.now();
    const installedAt = new Date(assetData.installDate).getTime();
    const ageDays = Math.max(0, (now - installedAt) / DAY_MS);

    // Age-based baseline: lose ~6 points/year, capped so very old
    // equipment still bottoms out around 45 from age alone (other
    // factors can push it lower).
    const ageBaselineScore = 100 - Math.min(55, (ageDays / 365) * 6);

    // Deterministic simulated operating-stress penalty (0-20 points).
    const stress = MaintenanceAgent._stressFactor(assetData.assetId);
    const stressPenalty = stress * 20;

    // Maintenance-history adjustment:
    //  + up to 10 points for recently completed preventive work
    //  - up to 24 points for overdue open tickets (raised >14 days ago, still open)
    let historyAdjustment = 0;
    const ninetyDaysAgo = now - 90 * DAY_MS;
    const fourteenDaysAgo = now - 14 * DAY_MS;

    const recentCompleted = recentRecords.filter(
      (r) => r.status === 'Completed' && new Date(r.maintenanceDate).getTime() >= ninetyDaysAgo
    ).length;
    historyAdjustment += Math.min(10, recentCompleted * 2.5);

    const overdueOpen = recentRecords.filter(
      (r) => r.status !== 'Completed' && new Date(r.createdAt || r.maintenanceDate).getTime() <= fourteenDaysAgo
    ).length;
    historyAdjustment -= Math.min(24, overdueOpen * 8);

    const rawScore = ageBaselineScore - stressPenalty + historyAdjustment;
    const healthScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    // 'Offline' is a manual/administrative state - the agent never
    // assigns it, it only moves between Operational/Warning/Critical.
    let status = 'Operational';
    if (healthScore < this.healthCriticalThreshold) status = 'Critical';
    else if (healthScore < this.healthWarningThreshold) status = 'Warning';

    return {
      healthScore,
      status,
      breakdown: {
        ageDays: Math.round(ageDays),
        ageBaselineScore: Number(ageBaselineScore.toFixed(1)),
        stressPenalty: Number(stressPenalty.toFixed(1)),
        historyAdjustment: Number(historyAdjustment.toFixed(1)),
      },
    };
  }

  /**
   * Evaluate + persist health scores for every asset belonging to a
   * facility. Skips assets manually set to 'Offline'.
   */
  async evaluateFacilityAssets(facilityId) {
    const assets = await Asset.find({ facilityId }).lean();
    const records = await MaintenanceRecord.find({ facilityId }).lean();
    const recordsByAsset = new Map();
    for (const r of records) {
      const list = recordsByAsset.get(r.assetId) || [];
      list.push(r);
      recordsByAsset.set(r.assetId, list);
    }

    const updated = [];
    for (const asset of assets) {
      if (asset.status === 'Offline') {
        updated.push(asset);
        continue;
      }
      const { healthScore, status } = this.evaluateAssetHealth(asset, recordsByAsset.get(asset.assetId) || []);
      const doc = await Asset.findOneAndUpdate(
        { assetId: asset.assetId },
        { $set: { healthScore, status, lastEvaluatedAt: new Date() } },
        { new: true }
      ).lean();
      updated.push(doc);
    }
    return updated;
  }

  /**
   * Identify assets whose health has dropped below the risk threshold
   * and project a predicted failure date for each.
   *
   * @param {Array} assetList - Asset documents, ideally freshly evaluated
   * @returns {Array} predictions sorted by urgency (soonest failure first)
   */
  predictFailures(assetList) {
    const now = Date.now();

    const predictions = assetList
      .filter((a) => a.status !== 'Offline' && typeof a.healthScore === 'number' && a.healthScore < this.failureRiskThreshold)
      .map((asset) => {
        const stress = MaintenanceAgent._stressFactor(asset.assetId);
        const effectiveDecayRate = this.baseDecayRatePerDay * (1 + stress); // faster decay under higher stress
        const daysRemaining = Math.max(1, Math.min(180, Math.round(asset.healthScore / effectiveDecayRate)));
        const predictedFailureDate = new Date(now + daysRemaining * DAY_MS);

        const riskLevel = asset.healthScore < this.healthCriticalThreshold ? 'Critical' : asset.healthScore < this.healthWarningThreshold ? 'High' : 'Medium';

        return {
          assetId: asset.assetId,
          facilityId: asset.facilityId,
          assetName: asset.assetName,
          assetType: asset.assetType,
          healthScore: asset.healthScore,
          riskLevel,
          daysRemaining,
          predictedFailureDate,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return predictions;
  }

  /**
   * Create pending MaintenanceRecord work orders (+ Alerts) for
   * high-risk predictions whose countdown falls inside the configured
   * window. Idempotent: won't duplicate a work order if the asset
   * already has an open (Pending/In Progress) record.
   *
   * @param {Array} predictions - output of predictFailures()
   * @returns {Promise<{records:Array, alerts:Array}>}
   */
  async generateWorkOrders(predictions) {
    const actionable = predictions.filter(
      (p) => (p.riskLevel === 'Critical' || p.riskLevel === 'High') && p.daysRemaining <= this.workOrderWindowDays
    );

    const createdRecords = [];
    const createdAlerts = [];

    for (const prediction of actionable) {
      // eslint-disable-next-line no-await-in-loop
      const existingOpen = await MaintenanceRecord.findOne({
        assetId: prediction.assetId,
        status: { $in: ['Pending', 'In Progress'] },
      }).lean();
      if (existingOpen) continue; // already has an open ticket - don't duplicate

      const leadTimeMs = this.workOrderLeadTimeDays * DAY_MS;
      let maintenanceDate = new Date(prediction.predictedFailureDate.getTime() - leadTimeMs);
      if (maintenanceDate.getTime() <= Date.now()) {
        maintenanceDate = new Date(Date.now() + DAY_MS); // always schedule at least a day out
      }

      // eslint-disable-next-line no-await-in-loop
      const record = await MaintenanceRecord.create({
        assetId: prediction.assetId,
        facilityId: prediction.facilityId,
        issueType: `Predictive maintenance — ${prediction.assetType}`,
        maintenanceDate,
        predictedFailureDate: prediction.predictedFailureDate,
        status: 'Pending',
        metadata: {
          healthScoreAtCreation: prediction.healthScore,
          riskLevel: prediction.riskLevel,
          daysRemainingAtCreation: prediction.daysRemaining,
          autoGenerated: true,
        },
        sourceAgent: 'MaintenanceAgent',
      });
      createdRecords.push(record);

      // eslint-disable-next-line no-await-in-loop
      const alert = await Alert.create({
        facilityId: prediction.facilityId,
        alertType: prediction.riskLevel === 'Critical' ? 'ASSET_HEALTH_CRITICAL' : 'PREDICTED_FAILURE_RISK',
        severity: prediction.riskLevel === 'Critical' ? 'Critical' : 'High',
        message: `${prediction.assetName} (${prediction.assetType}) is at ${prediction.riskLevel.toLowerCase()} risk of failure in ~${prediction.daysRemaining} days (health score ${prediction.healthScore}%). Work order ${record.maintenanceId} created.`,
        metadata: { assetId: prediction.assetId, maintenanceId: record.maintenanceId, ...prediction },
        sourceAgent: 'MaintenanceAgent',
      });
      createdAlerts.push(alert);
    }

    return { records: createdRecords, alerts: createdAlerts };
  }

  /**
   * Manually create a work order for one specific asset, bypassing the
   * risk-window filter used by generateWorkOrders(). This backs the
   * dashboard's "Generate Work Order" button, where a human has already
   * reviewed the recommendation and decided to act - so it's created
   * even if the countdown falls outside the auto-generation window.
   * Still idempotent: won't duplicate an already-open ticket.
   *
   * @param {string} assetId
   * @returns {Promise<{record:Object, alert:Object|null, alreadyExisted:boolean}>}
   */
  async createWorkOrderForAsset(assetId) {
    const asset = await Asset.findOne({ assetId }).lean();
    if (!asset) {
      throw Object.assign(new Error('Asset not found'), { status: 404 });
    }

    const existingOpen = await MaintenanceRecord.findOne({
      assetId,
      status: { $in: ['Pending', 'In Progress'] },
    }).lean();
    if (existingOpen) {
      return { record: existingOpen, alert: null, alreadyExisted: true };
    }

    const recentRecords = await MaintenanceRecord.find({ assetId }).lean();
    const { healthScore } = this.evaluateAssetHealth(asset, recentRecords);

    const stress = MaintenanceAgent._stressFactor(assetId);
    const effectiveDecayRate = this.baseDecayRatePerDay * (1 + stress);
    const daysRemaining = Math.max(1, Math.min(180, Math.round(healthScore / effectiveDecayRate)));
    const predictedFailureDate = new Date(Date.now() + daysRemaining * DAY_MS);
    const riskLevel =
      healthScore < this.healthCriticalThreshold ? 'Critical' : healthScore < this.healthWarningThreshold ? 'High' : 'Medium';

    const leadTimeMs = this.workOrderLeadTimeDays * DAY_MS;
    let maintenanceDate = new Date(predictedFailureDate.getTime() - leadTimeMs);
    if (maintenanceDate.getTime() <= Date.now()) {
      maintenanceDate = new Date(Date.now() + DAY_MS);
    }

    const record = await MaintenanceRecord.create({
      assetId,
      facilityId: asset.facilityId,
      issueType: `Manual work order — ${asset.assetType}`,
      maintenanceDate,
      predictedFailureDate,
      status: 'Pending',
      metadata: {
        healthScoreAtCreation: healthScore,
        riskLevel,
        daysRemainingAtCreation: daysRemaining,
        autoGenerated: false,
      },
      sourceAgent: 'MaintenanceAgent',
    });

    let alert = null;
    if (riskLevel === 'Critical' || riskLevel === 'High') {
      alert = await Alert.create({
        facilityId: asset.facilityId,
        alertType: riskLevel === 'Critical' ? 'ASSET_HEALTH_CRITICAL' : 'PREDICTED_FAILURE_RISK',
        severity: riskLevel === 'Critical' ? 'Critical' : 'High',
        message: `Manual work order ${record.maintenanceId} created for ${asset.assetName} (${asset.assetType}) — health score ${healthScore}%, ${riskLevel.toLowerCase()} risk.`,
        metadata: { assetId, maintenanceId: record.maintenanceId, healthScore, riskLevel, daysRemaining },
        sourceAgent: 'MaintenanceAgent',
      });
    }

    return { record, alert, alreadyExisted: false };
  }

  /**
   * Human-readable, prioritized recommendation cards for the "Agent
   * Actions" panel - one step up from the raw predictions table.
   */
  generateMaintenanceRecommendations(predictions) {
    if (!predictions.length) {
      return [
        {
          id: 'all-clear',
          assetId: null,
          title: 'All monitored assets within healthy range',
          detail: 'No assets are currently trending toward failure risk. Continue routine inspection schedules.',
          priority: 'Low',
          daysRemaining: null,
          estimatedDowntimeAvoidedHours: 0,
        },
      ];
    }

    return predictions.slice(0, 8).map((p) => {
      const downtimeAvoided = p.riskLevel === 'Critical' ? 12 + Math.round(Math.random() * 12) : 4 + Math.round(Math.random() * 8);
      return {
        id: `rec-${p.assetId}`,
        assetId: p.assetId,
        assetName: p.assetName,
        title: `Schedule service for ${p.assetName}`,
        detail: `Health score has dropped to ${p.healthScore}%. The predictive model estimates a ${p.riskLevel.toLowerCase()}-risk failure window of ~${p.daysRemaining} days. Proactive service now can avoid an estimated ${downtimeAvoided}h of unplanned downtime.`,
        priority: p.riskLevel === 'Critical' ? 'High' : p.riskLevel === 'High' ? 'Medium' : 'Low',
        daysRemaining: p.daysRemaining,
        estimatedDowntimeAvoidedHours: downtimeAvoided,
      };
    });
  }

  /**
   * Convenience orchestrator: evaluate -> predict -> generate work orders
   * for every asset in a facility, in one call. Used by the "run cycle"
   * endpoint and by the seed flow.
   */
  async runPredictiveCycle(facilityId) {
    const evaluatedAssets = await this.evaluateFacilityAssets(facilityId);
    const predictions = this.predictFailures(evaluatedAssets);
    const { records, alerts } = await this.generateWorkOrders(predictions);
    const recommendations = this.generateMaintenanceRecommendations(predictions);

    return {
      assetsEvaluated: evaluatedAssets.length,
      predictions,
      recommendations,
      workOrdersCreated: records.length,
      alertsCreated: alerts.length,
    };
  }
}

module.exports = MaintenanceAgent;
module.exports.MaintenanceAgent = MaintenanceAgent;

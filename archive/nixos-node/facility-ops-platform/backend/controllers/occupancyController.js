const Zone = require('../models/Zone');
const OccupancyLog = require('../models/OccupancyLog');
const OccupancyAgent = require('../agents/OccupancyAgent');
const { generateZonesForFacility, generateOccupancyLogsForZones } = require('../seed/mockDataGenerator');

const agent = new OccupancyAgent();

/**
 * @route GET /api/occupancy/:facilityId/summary
 * KPI cards: Occupancy Rate, Active Visitors, Workspace Efficiency.
 */
async function getSummary(req, res) {
  try {
    const { facilityId } = req.params;
    const zones = await agent.refreshCurrentOccupancy(facilityId);

    if (!zones.length) {
      return res.json({
        success: true,
        data: { occupancyRatePct: 0, activeVisitors: 0, workspaceEfficiency: null },
      });
    }

    const totalCapacity = zones.reduce((sum, z) => sum + z.maxCapacity, 0);
    const totalOccupancy = zones.reduce((sum, z) => sum + z.currentOccupancy, 0);
    const occupancyRatePct = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

    // No dedicated visitor check-in system yet - total people currently
    // across all zones is used as a proxy for "active visitors" in the
    // building right now. Documented here rather than left implicit.
    const activeVisitors = totalOccupancy;

    const workspaceEfficiency = agent.calculateWorkspaceEfficiency(zones);

    res.json({ success: true, data: { occupancyRatePct, activeVisitors, workspaceEfficiency } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/occupancy/:facilityId/zones
 * Per-zone occupancy rates, for the Zone Occupancy Distribution bars.
 */
async function getZones(req, res) {
  try {
    const { facilityId } = req.params;
    const zones = await agent.refreshCurrentOccupancy(facilityId);
    const monitored = agent.monitorOccupancy(zones);
    res.json({ success: true, count: monitored.length, data: monitored });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/occupancy/:facilityId/heatmap?range=
 * Hour/day utilization buckets for the heatmap grid.
 */
async function getHeatmap(req, res) {
  try {
    const { facilityId } = req.params;
    const rangeDays = _rangeToDays(req.query.range);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const [logs, zones] = await Promise.all([
      OccupancyLog.find({ facilityId, timestamp: { $gte: since } }).lean(),
      Zone.find({ facilityId }).lean(),
    ]);

    const zoneMap = new Map(zones.map((z) => [z.zoneId, z]));
    const joinedLogs = logs
      .filter((log) => zoneMap.has(log.zoneId))
      .map((log) => ({
        zoneId: log.zoneId,
        zoneName: zoneMap.get(log.zoneId).name,
        maxCapacity: zoneMap.get(log.zoneId).maxCapacity,
        recordedOccupancy: log.recordedOccupancy,
        timestamp: log.timestamp,
      }));

    const result = agent.analyzeUtilization(joinedLogs);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/occupancy/:facilityId/recommendations
 */
async function getRecommendations(req, res) {
  try {
    const { facilityId } = req.params;
    const zones = await agent.refreshCurrentOccupancy(facilityId);
    const monitored = agent.monitorOccupancy(zones);
    const workspaceEfficiency = agent.calculateWorkspaceEfficiency(zones);
    const recommendations = agent.generateRecommendations({ monitored, workspaceEfficiency });
    res.json({ success: true, data: recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/occupancy/:facilityId/run-cycle
 * Full cycle: refresh from logs -> monitor -> detect overcrowding
 * (writes Alerts) -> recommendations. Used by "Run Occupancy Scan".
 */
async function runOccupancyCycle(req, res) {
  try {
    const { facilityId } = req.params;
    const result = await agent.runOccupancyCycle(facilityId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/occupancy/:facilityId/seed?append=
 * Seeds the 4 canonical zones (or tops up history for existing ones)
 * plus a history of hourly OccupancyLog entries, then runs one cycle.
 */
async function seedFacilityZones(req, res) {
  try {
    const { facilityId } = req.params;
    const append = req.query.append === 'true';
    const days = parseInt(req.query.days, 10) || 14;

    const existingCount = await Zone.countDocuments({ facilityId });
    if (existingCount > 0 && !append) {
      return res.status(409).json({
        success: false,
        message: `Facility already has ${existingCount} zones. Pass ?append=true to add history, or delete the existing zones first.`,
      });
    }

    let zones;
    if (existingCount > 0) {
      zones = await Zone.find({ facilityId }).lean();
    } else {
      const zoneDefs = generateZonesForFacility(facilityId);
      zones = await Zone.insertMany(zoneDefs);
    }

    const logs = generateOccupancyLogsForZones(zones, days);
    await OccupancyLog.insertMany(logs);

    const cycleResult = await agent.runOccupancyCycle(facilityId);

    res.status(201).json({
      success: true,
      message: `Seeded ${zones.length} zone(s) and ${logs.length} occupancy log(s) for facility ${facilityId}`,
      zoneCount: zones.length,
      logCount: logs.length,
      cycleResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function _rangeToDays(range) {
  switch (range) {
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    default:
      return 7;
  }
}

module.exports = {
  getSummary,
  getZones,
  getHeatmap,
  getRecommendations,
  runOccupancyCycle,
  seedFacilityZones,
};

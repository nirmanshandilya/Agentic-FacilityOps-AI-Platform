const EnergyUsage = require('../models/EnergyUsage');
const Alert = require('../models/Alert');
const Facility = require('../models/Facility');
const EnergyAgent = require('../agents/EnergyAgent');
const { generateReadingsForFacility } = require('../seed/mockDataGenerator');

const agent = new EnergyAgent();

const CARBON_FACTOR_KG_PER_KWH = 0.417; // grid-average emissions factor
const RATE_USD_PER_KWH = 0.14; // blended commercial utility rate

/**
 * @route GET /api/energy/:facilityId/usage?range=24h|7d|30d
 * Raw time-series usage for charts.
 */
async function getUsage(req, res) {
  try {
    const { facilityId } = req.params;
    const rangeDays = _rangeToDays(req.query.range);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const usage = await EnergyUsage.find({ facilityId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();

    res.json({ success: true, count: usage.length, data: usage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/energy/:facilityId/summary
 * Aggregated KPI cards: total energy, cost, efficiency score, carbon reduction.
 */
async function getSummary(req, res) {
  try {
    const { facilityId } = req.params;
    const rangeDays = _rangeToDays(req.query.range);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const usage = await EnergyUsage.find({ facilityId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();

    if (!usage.length) {
      return res.json({
        success: true,
        data: {
          totalEnergyKwh: 0,
          totalCostUsd: 0,
          costSavingsUsd: 0,
          efficiencyScore: null,
          carbonReductionPct: 0,
          totalCarbonKg: 0,
          distribution: { hvacPct: 0, lightingPct: 0, equipmentPct: 0, otherPct: 0 },
        },
      });
    }

    const totalElectricity = usage.reduce((sum, u) => sum + u.electricityUsage, 0);
    const totalHvac = usage.reduce((sum, u) => sum + u.hvacPowerUsage, 0);
    const totalLighting = usage.reduce((sum, u) => sum + u.lightingPowerUsage, 0);
    const totalEquipment = usage.reduce((sum, u) => sum + (u.equipmentPowerUsage || 0), 0);
    const totalCarbon = usage.reduce((sum, u) => sum + u.carbonEmissions, 0);

    const otherLoad = Math.max(0, totalElectricity - totalHvac - totalLighting - totalEquipment);
    const distribution = _distributionPct(totalHvac, totalLighting, totalEquipment, otherLoad);

    const { efficiencyScore } = await agent.calculateEfficiencyScore(facilityId);

    // Cost savings modeled against a facility's expected baseline cost.
    const facility = await Facility.findOne({ facilityId }).lean();
    const expectedDailyKwh = facility?.baseline?.expectedElectricityKwh || 500;
    const expectedTotalKwh = expectedDailyKwh * (rangeDays >= 1 ? rangeDays : 1);
    const savingsKwh = Math.max(0, expectedTotalKwh - totalElectricity);
    const costSavingsUsd = savingsKwh * RATE_USD_PER_KWH;

    const baselineCarbon = expectedTotalKwh * CARBON_FACTOR_KG_PER_KWH;
    const carbonReductionPct = baselineCarbon > 0 ? Math.max(0, Math.round(((baselineCarbon - totalCarbon) / baselineCarbon) * 100)) : 0;

    res.json({
      success: true,
      data: {
        totalEnergyKwh: Number(totalElectricity.toFixed(2)),
        totalCostUsd: Number((totalElectricity * RATE_USD_PER_KWH).toFixed(2)),
        costSavingsUsd: Number(costSavingsUsd.toFixed(2)),
        efficiencyScore,
        carbonReductionPct,
        totalCarbonKg: Number(totalCarbon.toFixed(2)),
        distribution,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/energy/:facilityId/anomalies
 * Runs the agent's anomaly detector on demand and returns/persists alerts.
 */
async function getAnomalies(req, res) {
  try {
    const { facilityId } = req.params;
    const result = await agent.detectAnomalies(facilityId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/energy/:facilityId/forecast
 */
async function getForecast(req, res) {
  try {
    const { facilityId } = req.params;
    const result = await agent.forecastDemand(null, facilityId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/energy/:facilityId/recommendations
 * Combines efficiency score + distribution + anomalies + forecast into
 * the agent's recommendation engine.
 */
async function getRecommendations(req, res) {
  try {
    const { facilityId } = req.params;

    const [{ efficiencyScore }, anomalyResult, forecastResult, summaryRes] = await Promise.all([
      agent.calculateEfficiencyScore(facilityId),
      agent.detectAnomalies(facilityId),
      agent.forecastDemand(null, facilityId),
      _computeDistribution(facilityId),
    ]);

    const recommendations = agent.generateRecommendations({
      efficiencyScore,
      distribution: summaryRes,
      anomalies: anomalyResult.anomalies || [],
      forecast: forecastResult,
    });

    res.json({ success: true, data: recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/energy/:facilityId/alerts
 */
async function getAlerts(req, res) {
  try {
    const { facilityId } = req.params;
    const { status } = req.query;
    const filter = { facilityId };
    if (status) filter.status = status;

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route PATCH /api/energy/alerts/:alertId
 * Acknowledge / resolve / dismiss an alert (frontend Accept/Dismiss actions).
 */
async function updateAlertStatus(req, res) {
  try {
    const { alertId } = req.params;
    const { status } = req.body;

    if (!['Active', 'Acknowledged', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const alert = await Alert.findOneAndUpdate({ alertId }, { $set: { status } }, { new: true });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/energy/:facilityId/seed
 * Seeds realistic streaming IoT sensor data for a facility (dashboard toggle).
 */
async function seedFacilityData(req, res) {
  try {
    const { facilityId } = req.params;
    const days = parseInt(req.query.days, 10) || 14;

    const facility = await Facility.findOne({ facilityId }).lean();
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' });
    }

    const readings = generateReadingsForFacility(facilityId, days);
    await EnergyUsage.insertMany(readings);

    res.status(201).json({
      success: true,
      message: `Seeded ${readings.length} readings for facility ${facilityId}`,
      count: readings.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ---------- helpers ----------

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

function _distributionPct(hvac, lighting, equipment, other) {
  const total = hvac + lighting + equipment + other;
  if (total === 0) return { hvacPct: 0, lightingPct: 0, equipmentPct: 0, otherPct: 0 };
  return {
    hvacPct: Math.round((hvac / total) * 100),
    lightingPct: Math.round((lighting / total) * 100),
    equipmentPct: Math.round((equipment / total) * 100),
    otherPct: Math.round((other / total) * 100),
  };
}

async function _computeDistribution(facilityId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const usage = await EnergyUsage.find({ facilityId, timestamp: { $gte: since } }).lean();
  if (!usage.length) return { hvacPct: 0, lightingPct: 0, equipmentPct: 0, otherPct: 0 };

  const totalHvac = usage.reduce((s, u) => s + u.hvacPowerUsage, 0);
  const totalLighting = usage.reduce((s, u) => s + u.lightingPowerUsage, 0);
  const totalEquipment = usage.reduce((s, u) => s + (u.equipmentPowerUsage || 0), 0);
  const totalElectricity = usage.reduce((s, u) => s + u.electricityUsage, 0);
  const otherLoad = Math.max(0, totalElectricity - totalHvac - totalLighting - totalEquipment);

  return _distributionPct(totalHvac, totalLighting, totalEquipment, otherLoad);
}

module.exports = {
  getUsage,
  getSummary,
  getAnomalies,
  getForecast,
  getRecommendations,
  getAlerts,
  updateAlertStatus,
  seedFacilityData,
};

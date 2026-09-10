require('dotenv').config();

/**
 * Centralized environment configuration.
 * All modules (agents, controllers, seed scripts) should read tunable
 * values from here rather than calling process.env directly, so future
 * agents (Maintenance, Security, Occupancy, Cost) share one source of truth.
 */
const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/facilityops',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  agents: {
    energy: {
      anomalyStdThreshold: parseFloat(process.env.ENERGY_ANOMALY_STD_THRESHOLD) || 2.0,
      baselineWindowDays: parseInt(process.env.ENERGY_BASELINE_WINDOW_DAYS, 10) || 14,
      forecastHorizonHours: parseInt(process.env.ENERGY_FORECAST_HORIZON_HOURS, 10) || 24,
    },
    maintenance: {
      // healthScore >= warningThreshold -> Operational
      healthWarningThreshold: parseInt(process.env.MAINT_HEALTH_WARNING_THRESHOLD, 10) || 75,
      // healthScore below this -> Critical (between warning and critical -> Warning)
      healthCriticalThreshold: parseInt(process.env.MAINT_HEALTH_CRITICAL_THRESHOLD, 10) || 50,
      // assets scoring below this are included in failure predictions at all
      failureRiskThreshold: parseInt(process.env.MAINT_FAILURE_RISK_THRESHOLD, 10) || 65,
      // baseline health-points-lost-per-day used to project a failure date
      baseDecayRatePerDay: parseFloat(process.env.MAINT_BASE_DECAY_RATE) || 0.6,
      // lead time (days) subtracted from the predicted failure date when
      // scheduling a proactive work order's maintenanceDate
      workOrderLeadTimeDays: parseInt(process.env.MAINT_WORK_ORDER_LEAD_DAYS, 10) || 3,
      // only auto-generate work orders for High/Critical risk predictions
      // whose countdown falls within this many days
      workOrderWindowDays: parseInt(process.env.MAINT_WORK_ORDER_WINDOW_DAYS, 10) || 21,
    },
  },
};

module.exports = env;

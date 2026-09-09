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
  },
};

module.exports = env;

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const AlertSchema = new Schema(
  {
    alertId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    facilityId: {
      type: String,
      ref: 'Facility',
      required: true,
      index: true,
    },
    alertType: {
      type: String,
      enum: [
        // Energy Agent (Module 1)
        'ENERGY_ANOMALY',
        'HVAC_INEFFICIENCY',
        'WATER_ANOMALY',
        'LOW_EFFICIENCY_SCORE',
        'FORECAST_PEAK_WARNING',
        // Maintenance Agent (Module 2)
        'ASSET_HEALTH_CRITICAL',
        'PREDICTED_FAILURE_RISK',
        'MAINTENANCE_OVERDUE',
        // Occupancy Agent (Module 3)
        'ZONE_OVERCROWDING',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
    },
    message: { type: String, required: true },
    // Structured payload so the frontend / future agents can act on the
    // alert programmatically instead of parsing the message string.
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['Active', 'Acknowledged', 'Resolved'],
      default: 'Active',
    },
    sourceAgent: { type: String, default: 'System' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

AlertSchema.index({ facilityId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);

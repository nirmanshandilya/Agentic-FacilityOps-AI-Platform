const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const EnergyUsageSchema = new Schema(
  {
    energyId: {
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
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    electricityUsage: { type: Number, required: true, min: 0 }, // kWh
    waterUsage: { type: Number, required: true, min: 0 }, // Gallons
    hvacPowerUsage: { type: Number, required: true, min: 0 }, // kWh
    lightingPowerUsage: { type: Number, required: true, min: 0 }, // kWh
    equipmentPowerUsage: { type: Number, default: 0, min: 0 }, // kWh (other plug loads)
    carbonEmissions: { type: Number, required: true, min: 0 }, // kgCO2
  },
  { timestamps: true }
);

// Compound index: fast time-series queries scoped to a facility.
EnergyUsageSchema.index({ facilityId: 1, timestamp: -1 });

module.exports = mongoose.model('EnergyUsage', EnergyUsageSchema);

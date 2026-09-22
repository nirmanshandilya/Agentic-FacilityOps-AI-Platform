const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const OccupancyLogSchema = new Schema(
  {
    logId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    zoneId: {
      type: String,
      ref: 'Zone',
      required: true,
      index: true,
    },
    // Denormalized for the same reason as MaintenanceRecord.facilityId in
    // Module 2 - lets the controller query a facility's full occupancy
    // history in one indexed query instead of joining through Zone first.
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
    recordedOccupancy: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

OccupancyLogSchema.index({ facilityId: 1, zoneId: 1, timestamp: -1 });

module.exports = mongoose.model('OccupancyLog', OccupancyLogSchema);

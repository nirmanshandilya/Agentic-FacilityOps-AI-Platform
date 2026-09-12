const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const ZoneSchema = new Schema(
  {
    zoneId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    // Not in the original spec, but every other domain model in this app
    // (Asset, EnergyUsage, MaintenanceRecord) scopes by facilityId - kept
    // for the same reason: multi-facility queries and dashboard filtering.
    facilityId: {
      type: String,
      ref: 'Facility',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    // Not in the original spec either. Added so Workspace Efficiency can
    // be scoped to actual workspace zones rather than averaging in
    // parking/common areas, which have very different "ideal" utilization.
    zoneType: {
      type: String,
      enum: ['Workspace', 'Meeting Room', 'Common Area', 'Parking'],
      default: 'Workspace',
    },
    maxCapacity: { type: Number, required: true, min: 1 },
    // Live snapshot, kept in sync with the latest OccupancyLog entry by
    // OccupancyAgent.refreshCurrentOccupancy() - OccupancyLog is the
    // source of truth, this field just avoids a join on every dashboard read.
    currentOccupancy: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ZoneSchema.index({ facilityId: 1, zoneType: 1 });

module.exports = mongoose.model('Zone', ZoneSchema);

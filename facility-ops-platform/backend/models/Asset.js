const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const AssetSchema = new Schema(
  {
    assetId: {
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
    assetName: {
      type: String,
      required: [true, 'assetName is required'],
      trim: true,
    },
    assetType: {
      type: String,
      required: [true, 'assetType is required'],
      trim: true,
    },
    installDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Operational', 'Warning', 'Critical', 'Offline'],
      default: 'Operational',
    },
    healthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    // Timestamp of the last time the MaintenanceAgent recomputed
    // healthScore/status for this asset - lets the frontend show staleness.
    lastEvaluatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AssetSchema.index({ facilityId: 1, status: 1 });

module.exports = mongoose.model('Asset', AssetSchema);

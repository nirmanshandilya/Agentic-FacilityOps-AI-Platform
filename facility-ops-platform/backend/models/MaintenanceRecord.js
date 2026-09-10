const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const MaintenanceRecordSchema = new Schema(
  {
    maintenanceId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    assetId: {
      type: String,
      ref: 'Asset',
      required: true,
      index: true,
    },
    // Denormalized for fast facility-scoped queries without populating
    // through Asset on every dashboard request (same pattern as Alert).
    facilityId: {
      type: String,
      ref: 'Facility',
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      required: [true, 'issueType is required'],
      trim: true,
    },
    maintenanceDate: {
      type: Date,
      required: true,
    },
    predictedFailureDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending',
    },
    // Structured context, mirroring Alert.metadata - e.g. healthScore at
    // creation time, risk level, days remaining when the work order was raised.
    metadata: { type: Schema.Types.Mixed, default: {} },
    sourceAgent: { type: String, default: 'MaintenanceAgent' },
  },
  { timestamps: true }
);

MaintenanceRecordSchema.index({ facilityId: 1, status: 1, maintenanceDate: 1 });
MaintenanceRecordSchema.index({ assetId: 1, status: 1 });

module.exports = mongoose.model('MaintenanceRecord', MaintenanceRecordSchema);

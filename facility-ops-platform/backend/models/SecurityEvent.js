const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const SecurityEventSchema = new Schema(
  {
    eventId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    // Not in the original spec, but every other domain model in this app
    // scopes by facilityId - kept for the same reason (multi-facility
    // queries, dashboard filtering).
    facilityId: {
      type: String,
      ref: 'Facility',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'CCTV_ANOMALY',
        'UNAUTHORIZED_ACCESS',
        'TAILGATING',
        // Two additions beyond the spec's examples, needed for a
        // believable access-control log (see monitorAccess/detectBreach).
        'BADGE_DENIED',
        'DOOR_FORCED_OPEN',
      ],
      required: true,
    },
    location: { type: String, required: true, trim: true },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
    },
    // Not in the original spec. Added so events have a resolution
    // lifecycle - same Open/Investigating/Resolved shape conceptually as
    // MaintenanceRecord's Pending/In Progress/Completed - and so the
    // dashboard's "Initiate Zone Lockdown" / "Dispatch Security Guard"
    // actions have something real to update.
    status: {
      type: String,
      enum: ['Open', 'Investigating', 'Resolved'],
      default: 'Open',
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

SecurityEventSchema.index({ facilityId: 1, status: 1, timestamp: -1 });

module.exports = mongoose.model('SecurityEvent', SecurityEventSchema);

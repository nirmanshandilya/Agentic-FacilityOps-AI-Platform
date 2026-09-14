const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const VisitorSchema = new Schema(
  {
    visitorId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    // Not in the original spec - same facility-scoping reason as SecurityEvent.
    facilityId: {
      type: String,
      ref: 'Facility',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    checkInTime: { type: Date, required: true, default: Date.now },
    expectedCheckOut: { type: Date, required: true },
    // Not in the original spec. Needed to actually record when a visitor
    // leaves, rather than only ever knowing when they were expected to.
    actualCheckOutTime: { type: Date, default: null },
    // Free-text zone/area name (e.g. "Office Floors") rather than a hard
    // ref to Zone - keeps this model usable even for facilities that
    // haven't seeded Module 3 zone data.
    currentLocation: { type: String, default: null },
    status: {
      type: String,
      enum: ['CheckedIn', 'CheckedOut', 'Overstayed'],
      default: 'CheckedIn',
    },
  },
  { timestamps: true }
);

VisitorSchema.index({ facilityId: 1, status: 1 });

module.exports = mongoose.model('Visitor', VisitorSchema);

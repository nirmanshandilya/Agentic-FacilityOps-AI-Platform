const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const FacilitySchema = new Schema(
  {
    facilityId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    facilityName: {
      type: String,
      required: [true, 'facilityName is required'],
      trim: true,
    },
    facilityType: {
      type: String,
      enum: ['Office', 'IT Park', 'Hospital', 'University'],
      required: [true, 'facilityType is required'],
    },
    location: {
      type: String,
      required: [true, 'location is required'],
      trim: true,
    },
    // Optional operating parameters used by the Energy Agent as a fallback
    // baseline when there isn't yet enough historical data.
    baseline: {
      expectedElectricityKwh: { type: Number, default: 500 },
      expectedWaterUsage: { type: Number, default: 2000 },
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

module.exports = mongoose.model('Facility', FacilitySchema);

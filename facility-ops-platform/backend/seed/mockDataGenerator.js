const { v4: uuidv4 } = require('uuid');

const CARBON_FACTOR_KG_PER_KWH = 0.417;

/**
 * Generates a realistic hourly time-series of IoT/utility readings for a
 * facility, including a daily occupancy-driven load curve, weekday/weekend
 * variation, and a small number of injected anomaly spikes so the
 * EnergyAgent's anomaly detector has something meaningful to catch.
 *
 * @param {string} facilityId
 * @param {number} days number of days of hourly history to generate
 * @returns {Array} EnergyUsage-shaped documents (without _id)
 */
function generateReadingsForFacility(facilityId, days = 14) {
  const readings = [];
  const now = new Date();
  const totalHours = days * 24;

  // Randomize a per-facility "personality" so seeded facilities don't all
  // look identical.
  const baseLoadKwh = 15 + Math.random() * 10; // overnight baseline
  const peakLoadKwh = 55 + Math.random() * 25; // occupied-hours peak
  const anomalyCount = Math.max(2, Math.round(totalHours * 0.015)); // ~1.5% of readings
  const anomalyIndices = new Set();
  while (anomalyIndices.size < anomalyCount) {
    anomalyIndices.add(Math.floor(Math.random() * totalHours));
  }

  for (let i = 0; i < totalHours; i += 1) {
    const timestamp = new Date(now.getTime() - (totalHours - i) * 60 * 60 * 1000);
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay(); // 0 = Sunday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Occupancy-shaped daily curve: ramps up ~7am, peaks midday, tapers by 7pm.
    const occupancyFactor = _occupancyCurve(hour) * (isWeekend ? 0.35 : 1);

    let electricityUsage = baseLoadKwh + (peakLoadKwh - baseLoadKwh) * occupancyFactor;
    // Natural sensor noise.
    electricityUsage += (Math.random() - 0.5) * 4;

    const hvacShare = 0.42 + Math.random() * 0.08; // ~42-50% of load
    const lightingShare = 0.24 + Math.random() * 0.06; // ~24-30%
    const equipmentShare = 1 - hvacShare - lightingShare;

    let hvacPowerUsage = electricityUsage * hvacShare;
    let lightingPowerUsage = electricityUsage * lightingShare;
    const equipmentPowerUsage = Math.max(0, electricityUsage * equipmentShare);

    // Inject anomaly spikes/drops on selected indices.
    if (anomalyIndices.has(i)) {
      const spike = Math.random() > 0.25; // mostly spikes, occasionally drops
      const magnitude = 1.6 + Math.random() * 1.2; // 1.6x - 2.8x
      if (spike) {
        electricityUsage *= magnitude;
        hvacPowerUsage *= magnitude;
      } else {
        electricityUsage *= 0.3;
        hvacPowerUsage *= 0.3;
      }
    }

    electricityUsage = Math.max(2, electricityUsage);
    hvacPowerUsage = Math.max(0, hvacPowerUsage);
    lightingPowerUsage = Math.max(0, lightingPowerUsage);

    const waterUsage = 80 + occupancyFactor * 220 + (Math.random() - 0.5) * 20;
    const carbonEmissions = electricityUsage * CARBON_FACTOR_KG_PER_KWH;

    readings.push({
      energyId: uuidv4(),
      facilityId,
      timestamp,
      electricityUsage: Number(electricityUsage.toFixed(2)),
      waterUsage: Number(Math.max(10, waterUsage).toFixed(2)),
      hvacPowerUsage: Number(hvacPowerUsage.toFixed(2)),
      lightingPowerUsage: Number(lightingPowerUsage.toFixed(2)),
      equipmentPowerUsage: Number(equipmentPowerUsage.toFixed(2)),
      carbonEmissions: Number(carbonEmissions.toFixed(2)),
    });
  }

  return readings;
}

function _occupancyCurve(hour) {
  // Smooth bell-shaped curve peaking around 1-2 PM, near-zero at 2-4 AM.
  const peakHour = 13;
  const spread = 5.5;
  const value = Math.exp(-((hour - peakHour) ** 2) / (2 * spread ** 2));
  return Math.max(0.08, value); // small nighttime baseline load
}

/**
 * Standalone CLI seeding entrypoint: `npm run seed`.
 * Creates a handful of demo facilities (if none exist) and populates
 * 14 days of hourly energy history for each.
 */
async function runStandaloneSeed() {
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');
  const Facility = require('../models/Facility');
  const EnergyUsage = require('../models/EnergyUsage');

  await connectDB();

  const demoFacilities = [
    { facilityName: 'Riverside Tech Campus', facilityType: 'IT Park', location: 'Austin, TX' },
    { facilityName: 'Midtown Corporate Tower', facilityType: 'Office', location: 'Chicago, IL' },
    { facilityName: 'Lakeside General Hospital', facilityType: 'Hospital', location: 'Portland, OR' },
  ];

  for (const def of demoFacilities) {
    let facility = await Facility.findOne({ facilityName: def.facilityName });
    if (!facility) {
      facility = await Facility.create(def);
      console.log(`[seed] Created facility: ${facility.facilityName} (${facility.facilityId})`);
    }

    const existingCount = await EnergyUsage.countDocuments({ facilityId: facility.facilityId });
    if (existingCount > 0) {
      console.log(`[seed] Skipping ${facility.facilityName}, already has ${existingCount} readings`);
      continue;
    }

    const readings = generateReadingsForFacility(facility.facilityId, 14);
    await EnergyUsage.insertMany(readings);
    console.log(`[seed] Inserted ${readings.length} readings for ${facility.facilityName}`);
  }

  console.log('[seed] Done.');
  await mongoose.connection.close();
  process.exit(0);
}

module.exports = { generateReadingsForFacility, runStandaloneSeed };

// Allow `node seed/mockDataGenerator.js` to run the standalone seed directly.
if (require.main === module) {
  runStandaloneSeed().catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });
}

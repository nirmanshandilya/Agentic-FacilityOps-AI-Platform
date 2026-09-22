const express = require('express');
const {
  getUsage,
  getSummary,
  getAnomalies,
  getForecast,
  getRecommendations,
  getAlerts,
  updateAlertStatus,
  seedFacilityData,
} = require('../controllers/energyController');

const router = express.Router();

router.get('/:facilityId/usage', getUsage);
router.get('/:facilityId/summary', getSummary);
router.get('/:facilityId/anomalies', getAnomalies);
router.get('/:facilityId/forecast', getForecast);
router.get('/:facilityId/recommendations', getRecommendations);
router.get('/:facilityId/alerts', getAlerts);
router.post('/:facilityId/seed', seedFacilityData);

// Alert status is not scoped by facility in the path since alertId is unique.
router.patch('/alerts/:alertId', updateAlertStatus);

module.exports = router;

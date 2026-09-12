const express = require('express');
const {
  getSummary,
  getZones,
  getHeatmap,
  getRecommendations,
  runOccupancyCycle,
  seedFacilityZones,
} = require('../controllers/occupancyController');

const router = express.Router();

router.get('/:facilityId/summary', getSummary);
router.get('/:facilityId/zones', getZones);
router.get('/:facilityId/heatmap', getHeatmap);
router.get('/:facilityId/recommendations', getRecommendations);
router.post('/:facilityId/run-cycle', runOccupancyCycle);
router.post('/:facilityId/seed', seedFacilityZones);

module.exports = router;

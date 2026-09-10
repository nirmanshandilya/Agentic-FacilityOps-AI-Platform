const express = require('express');
const {
  getSummary,
  getAssets,
  getPredictions,
  getRecommendations,
  runPredictiveCycle,
  createWorkOrder,
  getWorkOrders,
  updateWorkOrderStatus,
  seedFacilityAssets,
} = require('../controllers/maintenanceController');

const router = express.Router();

router.get('/:facilityId/summary', getSummary);
router.get('/:facilityId/assets', getAssets);
router.get('/:facilityId/predictions', getPredictions);
router.get('/:facilityId/recommendations', getRecommendations);
router.post('/:facilityId/run-cycle', runPredictiveCycle);
router.post('/:facilityId/assets/:assetId/work-order', createWorkOrder);
router.get('/:facilityId/work-orders', getWorkOrders);
router.post('/:facilityId/seed', seedFacilityAssets);

// Work order status is not scoped by facility in the path since
// maintenanceId is unique (same pattern as Alert routes in Module 1).
router.patch('/work-orders/:maintenanceId', updateWorkOrderStatus);

module.exports = router;

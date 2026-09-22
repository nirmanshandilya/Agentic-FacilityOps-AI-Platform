const express = require('express');
const {
  getSummary,
  getEvents,
  getVisitors,
  getCctvFeed,
  getAccessLogs,
  getRecommendations,
  runSecurityCycle,
  updateEventStatus,
  seedFacilitySecurity,
} = require('../controllers/securityController');

const router = express.Router();

router.get('/:facilityId/summary', getSummary);
router.get('/:facilityId/events', getEvents);
router.get('/:facilityId/visitors', getVisitors);
router.get('/:facilityId/cctv-feed', getCctvFeed);
router.get('/:facilityId/access-logs', getAccessLogs);
router.get('/:facilityId/recommendations', getRecommendations);
router.post('/:facilityId/run-cycle', runSecurityCycle);
router.post('/:facilityId/seed', seedFacilitySecurity);

// Event status is not scoped by facility in the path since eventId is
// unique (same pattern as Alert/MaintenanceRecord status routes).
router.patch('/events/:eventId', updateEventStatus);

module.exports = router;

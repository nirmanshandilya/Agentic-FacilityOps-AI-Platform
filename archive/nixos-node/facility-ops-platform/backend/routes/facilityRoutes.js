const express = require('express');
const {
  listFacilities,
  getFacility,
  createFacility,
  updateFacility,
  deleteFacility,
} = require('../controllers/facilityController');

const router = express.Router();

router.route('/').get(listFacilities).post(createFacility);

router
  .route('/:facilityId')
  .get(getFacility)
  .put(updateFacility)
  .delete(deleteFacility);

module.exports = router;

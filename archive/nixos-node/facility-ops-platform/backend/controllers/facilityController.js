const Facility = require('../models/Facility');

/**
 * @route GET /api/facilities
 */
async function listFacilities(req, res) {
  try {
    const facilities = await Facility.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: facilities.length, data: facilities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/facilities/:facilityId
 */
async function getFacility(req, res) {
  try {
    const facility = await Facility.findOne({ facilityId: req.params.facilityId }).lean();
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' });
    }
    res.json({ success: true, data: facility });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/facilities
 */
async function createFacility(req, res) {
  try {
    const { facilityName, facilityType, location, baseline } = req.body;

    if (!facilityName || !facilityType || !location) {
      return res.status(400).json({
        success: false,
        message: 'facilityName, facilityType, and location are required',
      });
    }

    const facility = await Facility.create({ facilityName, facilityType, location, baseline });
    res.status(201).json({ success: true, data: facility });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * @route PUT /api/facilities/:facilityId
 */
async function updateFacility(req, res) {
  try {
    const facility = await Facility.findOneAndUpdate(
      { facilityId: req.params.facilityId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' });
    }
    res.json({ success: true, data: facility });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * @route DELETE /api/facilities/:facilityId
 */
async function deleteFacility(req, res) {
  try {
    const facility = await Facility.findOneAndDelete({ facilityId: req.params.facilityId });
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Facility not found' });
    }
    res.json({ success: true, message: 'Facility deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listFacilities,
  getFacility,
  createFacility,
  updateFacility,
  deleteFacility,
};

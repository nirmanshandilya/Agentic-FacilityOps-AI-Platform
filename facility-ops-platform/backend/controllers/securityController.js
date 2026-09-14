const SecurityEvent = require('../models/SecurityEvent');
const Visitor = require('../models/Visitor');
const SecurityAgent = require('../agents/SecurityAgent');
const { generateSecurityEventsForFacility, generateVisitorsForFacility } = require('../seed/mockDataGenerator');

const agent = new SecurityAgent();

/**
 * @route GET /api/security/:facilityId/summary
 * KPI cards: Security Events, Unauthorized Access, Active Visitors, CCTV Coverage.
 */
async function getSummary(req, res) {
  try {
    const { facilityId } = req.params;

    const [securityEventsCount, unauthorizedAccessCount, activeVisitors, cameraRoster] = await Promise.all([
      SecurityEvent.countDocuments({ facilityId, status: { $in: ['Open', 'Investigating'] } }),
      SecurityEvent.countDocuments({
        facilityId,
        eventType: { $in: ['UNAUTHORIZED_ACCESS', 'TAILGATING'] },
        status: { $in: ['Open', 'Investigating'] },
      }),
      Visitor.countDocuments({ facilityId, status: { $in: ['CheckedIn', 'Overstayed'] } }),
      agent.getCameraRoster(facilityId),
    ]);

    const cctvResults = agent.analyzeCCTV(cameraRoster);
    const onlineCount = cctvResults.filter((c) => c.isOnline).length;
    const cctvCoveragePct = cctvResults.length ? Math.round((onlineCount / cctvResults.length) * 100) : 0;

    res.json({
      success: true,
      data: { securityEventsCount, unauthorizedAccessCount, activeVisitors, cctvCoveragePct },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/security/:facilityId/events?status=&severity=
 */
async function getEvents(req, res) {
  try {
    const { facilityId } = req.params;
    const { status, severity } = req.query;
    const filter = { facilityId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const events = await SecurityEvent.find(filter).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ success: true, count: events.length, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/security/:facilityId/visitors?status=
 */
async function getVisitors(req, res) {
  try {
    const { facilityId } = req.params;
    const { status } = req.query;
    const filter = { facilityId };
    if (status) filter.status = status;

    const visitors = await Visitor.find(filter).sort({ checkInTime: -1 }).limit(100).lean();
    res.json({ success: true, count: visitors.length, data: visitors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/security/:facilityId/cctv-feed
 * Simulated live camera grid for the dashboard.
 */
async function getCctvFeed(req, res) {
  try {
    const { facilityId } = req.params;
    const cameraRoster = await agent.getCameraRoster(facilityId);
    const cctvResults = agent.analyzeCCTV(cameraRoster);
    res.json({ success: true, count: cctvResults.length, data: cctvResults });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/security/:facilityId/access-logs
 * Merges recent SecurityEvents + Visitor check-in/out activity into one
 * normalized, timestamp-sorted feed for the Access Logs table.
 */
async function getAccessLogs(req, res) {
  try {
    const { facilityId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 30;

    const [events, visitors] = await Promise.all([
      SecurityEvent.find({ facilityId }).sort({ timestamp: -1 }).limit(limit).lean(),
      Visitor.find({ facilityId }).sort({ checkInTime: -1 }).limit(limit).lean(),
    ]);

    const eventRows = events.map((e) => ({
      id: e.eventId,
      type: e.eventType === 'BADGE_DENIED' || e.eventType === 'DOOR_FORCED_OPEN' ? 'Access Denial' : 'Security Event',
      description: `${e.eventType.replace(/_/g, ' ')} at ${e.location}`,
      location: e.location,
      timestamp: e.timestamp,
      severity: e.severity,
      status: e.status,
    }));

    const visitorRows = [];
    visitors.forEach((v) => {
      visitorRows.push({
        id: `${v.visitorId}-checkin`,
        type: 'Visitor Movement',
        description: `${v.name} checked in${v.currentLocation ? ` — ${v.currentLocation}` : ''}`,
        location: v.currentLocation || '—',
        timestamp: v.checkInTime,
        severity: null,
        status: v.status,
      });
      if (v.actualCheckOutTime) {
        visitorRows.push({
          id: `${v.visitorId}-checkout`,
          type: 'Visitor Movement',
          description: `${v.name} checked out`,
          location: v.currentLocation || '—',
          timestamp: v.actualCheckOutTime,
          severity: null,
          status: 'CheckedOut',
        });
      }
    });

    const merged = [...eventRows, ...visitorRows]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    res.json({ success: true, count: merged.length, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route GET /api/security/:facilityId/recommendations
 */
async function getRecommendations(req, res) {
  try {
    const { facilityId } = req.params;
    const result = await agent.runSecurityCycle(facilityId);
    res.json({ success: true, data: result.recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/security/:facilityId/run-cycle
 */
async function runSecurityCycle(req, res) {
  try {
    const { facilityId } = req.params;
    const result = await agent.runSecurityCycle(facilityId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route PATCH /api/security/events/:eventId
 * Backs the "Initiate Zone Lockdown" / "Dispatch Security Guard" actions -
 * there's no physical lockdown system to call, so these mark the event as
 * being actively handled (Investigating) or closed out (Resolved).
 */
async function updateEventStatus(req, res) {
  try {
    const { eventId } = req.params;
    const { status } = req.body;

    if (!['Open', 'Investigating', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const event = await SecurityEvent.findOneAndUpdate({ eventId }, { $set: { status } }, { new: true });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Security event not found' });
    }
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @route POST /api/security/:facilityId/seed?append=
 * Seeds SecurityEvent history + a visitor roster, then runs one cycle.
 */
async function seedFacilitySecurity(req, res) {
  try {
    const { facilityId } = req.params;
    const append = req.query.append === 'true';
    const days = parseInt(req.query.days, 10) || 14;

    const existingCount = await SecurityEvent.countDocuments({ facilityId });
    if (existingCount > 0 && !append) {
      return res.status(409).json({
        success: false,
        message: `Facility already has ${existingCount} security events. Pass ?append=true to add more history.`,
      });
    }

    const eventDefs = generateSecurityEventsForFacility(facilityId, days);
    const events = await SecurityEvent.insertMany(eventDefs);

    let visitors = [];
    const existingVisitorCount = await Visitor.countDocuments({ facilityId });
    if (existingVisitorCount === 0) {
      const visitorDefs = generateVisitorsForFacility(facilityId, 8);
      visitors = await Visitor.insertMany(visitorDefs);
    }

    const cycleResult = await agent.runSecurityCycle(facilityId);

    res.status(201).json({
      success: true,
      message: `Seeded ${events.length} security event(s)${visitors.length ? ` and ${visitors.length} visitor(s)` : ''} for facility ${facilityId}`,
      eventCount: events.length,
      visitorCount: visitors.length,
      cycleResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSummary,
  getEvents,
  getVisitors,
  getCctvFeed,
  getAccessLogs,
  getRecommendations,
  runSecurityCycle,
  updateEventStatus,
  seedFacilitySecurity,
};

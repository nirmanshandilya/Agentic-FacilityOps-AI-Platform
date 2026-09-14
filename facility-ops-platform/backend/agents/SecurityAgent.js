const crypto = require('crypto');
const SecurityEvent = require('../models/SecurityEvent');
const Visitor = require('../models/Visitor');
const Alert = require('../models/Alert');
const env = require('../config/env');

const BREACH_EVENT_TYPES = ['UNAUTHORIZED_ACCESS', 'TAILGATING'];

/**
 * SecurityAgent
 * ------------------------------------------------------------------
 * Autonomous agent for the Security domain. Same shape as the other
 * three agents: stateless/functional, config from config/env.js, DB
 * writes only inside methods that need to persist (detectBreach writes
 * Alerts, refreshVisitorStatuses writes Visitors).
 *
 * Core spec methods:
 *  - monitorAccess : validates a batch of badge/visitor access records
 *  - detectBreach  : flags unauthorized access / tailgating, writes Alerts
 *  - analyzeCCTV   : simulates per-camera vision analysis
 *
 * Supporting methods (needed to actually power the dashboard):
 *  - refreshVisitorStatuses
 *  - generateRecommendations
 *  - runSecurityCycle (orchestrates all of the above for one facility)
 * ------------------------------------------------------------------
 */
class SecurityAgent {
  constructor(config = {}) {
    this.offHoursStartHour = config.offHoursStartHour ?? env.agents.security.offHoursStartHour;
    this.offHoursEndHour = config.offHoursEndHour ?? env.agents.security.offHoursEndHour;
    this.cctvOfflineProbabilityPct = config.cctvOfflineProbabilityPct ?? env.agents.security.cctvOfflineProbabilityPct;
    this.overstayGraceMinutes = config.overstayGraceMinutes ?? env.agents.security.overstayGraceMinutes;
    this.eventLookbackDays = config.eventLookbackDays ?? env.agents.security.eventLookbackDays;
  }

  /**
   * monitorAccess(eventData): validates a batch of raw badge-swipe /
   * visitor-tracking records - pure function, no DB access, so it can
   * run against live incoming events or a seeded batch alike. Flags
   * structurally invalid entries (missing fields, timestamps in the
   * future) rather than trying to interpret their meaning - that's
   * detectBreach's job once they're persisted as SecurityEvents.
   *
   * Expected shape per entry: { type: 'badge'|'visitor', status:
   * 'granted'|'denied', location, timestamp }
   */
  monitorAccess(eventData = []) {
    const now = Date.now();
    let grantedCount = 0;
    let deniedCount = 0;
    const invalidEntries = [];

    eventData.forEach((entry, index) => {
      const hasRequiredFields = entry && entry.type && entry.status && entry.location && entry.timestamp;
      const timestampValid = hasRequiredFields && new Date(entry.timestamp).getTime() <= now;

      if (!hasRequiredFields || !timestampValid) {
        invalidEntries.push({ index, reason: !hasRequiredFields ? 'missing required field' : 'timestamp in the future' });
        return;
      }

      if (entry.status === 'granted') grantedCount += 1;
      else if (entry.status === 'denied') deniedCount += 1;
    });

    const totalValid = grantedCount + deniedCount;

    return {
      totalEvents: eventData.length,
      grantedCount,
      deniedCount,
      invalidEntries,
      deniedRatePct: totalValid > 0 ? Math.round((deniedCount / totalValid) * 100) : 0,
    };
  }

  /**
   * detectBreach(events): flags SecurityEvent docs whose type indicates
   * an actual breach attempt (unauthorized access / tailgating) rather
   * than a routine denial, and writes a Critical SECURITY_BREACH Alert -
   * idempotent against an existing Active alert for the same event, so
   * re-scanning doesn't spam duplicates.
   *
   * @param {Array} events SecurityEvent-shaped docs (already fetched)
   */
  async detectBreach(events = []) {
    const breaches = events.filter((e) => BREACH_EVENT_TYPES.includes(e.eventType) && e.status !== 'Resolved');

    const createdAlerts = [];
    for (const event of breaches) {
      const existing = await Alert.findOne({
        facilityId: event.facilityId,
        alertType: 'SECURITY_BREACH',
        status: 'Active',
        'metadata.eventId': event.eventId,
      }).lean();
      if (existing) continue;

      const alert = await Alert.create({
        facilityId: event.facilityId,
        alertType: 'SECURITY_BREACH',
        severity: 'Critical',
        message: `${event.eventType === 'TAILGATING' ? 'Tailgating' : 'Unauthorized access'} detected at ${event.location} at ${new Date(event.timestamp).toLocaleString()}.`,
        metadata: { eventId: event.eventId, eventType: event.eventType, location: event.location },
        sourceAgent: 'SecurityAgent',
      });
      createdAlerts.push(alert);
    }

    return { breaches, alertsCreated: createdAlerts.length };
  }

  /**
   * analyzeCCTV(feedData): SIMULATED vision analysis - there's no real
   * camera feed, so this deterministically hashes each camera's ID
   * together with the current hour so results are stable within an
   * hour (not flickering on every request) but still change over time,
   * same "deterministic pseudo-randomness" approach as
   * MaintenanceAgent's per-asset stress factor.
   *
   * @param {Array} feedData [{ cameraId, zoneName, location }]
   */
  analyzeCCTV(feedData = []) {
    const now = new Date();
    const hourBucket = `${now.toISOString().slice(0, 13)}`; // stable per hour
    const hour = now.getHours();
    const isOffHours = this._isOffHours(hour);

    return feedData.map((camera) => {
      const seed = SecurityAgent._hashToUnitInterval(`${camera.cameraId}-${hourBucket}`);
      const isOnline = seed * 100 >= this.cctvOfflineProbabilityPct;

      if (!isOnline) {
        return { ...camera, isOnline: false, status: 'Offline', confidencePct: 0, timestamp: now.toISOString() };
      }

      // Second, independent hash for the detection outcome itself.
      const detectionSeed = SecurityAgent._hashToUnitInterval(`${camera.cameraId}-${hourBucket}-detection`);
      let status = 'Clear';
      let confidencePct = 90 + Math.round(detectionSeed * 9);

      if (detectionSeed > 0.94) {
        status = 'Unattended Object';
        confidencePct = 70 + Math.round(detectionSeed * 20);
      } else if (detectionSeed > 0.85) {
        status = isOffHours ? 'Off-Hours Activity' : 'Motion Detected';
        confidencePct = 75 + Math.round(detectionSeed * 20);
      } else if (isOffHours && detectionSeed > 0.7) {
        // Off-hours makes even moderate motion worth flagging.
        status = 'Off-Hours Activity';
        confidencePct = 65 + Math.round(detectionSeed * 20);
      }

      return { ...camera, isOnline: true, status, confidencePct, timestamp: now.toISOString() };
    });
  }

  /**
   * refreshVisitorStatuses(facilityId): marks any CheckedIn visitor whose
   * expectedCheckOut (plus a grace period) has passed as Overstayed, and
   * raises a low-severity Alert per newly-flagged visitor. Visitor
   * records are the source of truth here - this just keeps `status` in
   * sync with the clock.
   */
  async refreshVisitorStatuses(facilityId) {
    const graceMs = this.overstayGraceMinutes * 60 * 1000;
    const cutoff = new Date(Date.now() - graceMs);

    const overdue = await Visitor.find({
      facilityId,
      status: 'CheckedIn',
      expectedCheckOut: { $lt: cutoff },
    });

    const overstayed = [];
    for (const visitor of overdue) {
      visitor.status = 'Overstayed';
      await visitor.save();
      overstayed.push(visitor);

      const existing = await Alert.findOne({
        facilityId,
        alertType: 'VISITOR_OVERSTAY',
        status: 'Active',
        'metadata.visitorId': visitor.visitorId,
      }).lean();
      if (!existing) {
        await Alert.create({
          facilityId,
          alertType: 'VISITOR_OVERSTAY',
          severity: 'Low',
          message: `${visitor.name} has overstayed their expected checkout time (was expected by ${visitor.expectedCheckOut.toLocaleString()}).`,
          metadata: { visitorId: visitor.visitorId, expectedCheckOut: visitor.expectedCheckOut },
          sourceAgent: 'SecurityAgent',
        });
      }
    }

    return overstayed;
  }

  /**
   * generateRecommendations(metrics): turns breach/CCTV/visitor outputs
   * into actionable cards - same {id, category, title, detail, priority}
   * shape as the other three agents, plus an `actionType` +
   * `eventId`/`cameraId` the frontend uses to wire the "Initiate Zone
   * Lockdown" / "Dispatch Security Guard" buttons to a real endpoint.
   */
  generateRecommendations(metrics = {}) {
    const { breaches = [], cctvResults = [], overstayed = [] } = metrics;
    const recommendations = [];

    breaches.forEach((event) => {
      recommendations.push({
        id: `lockdown-${event.eventId}`,
        category: 'Breach Response',
        title: `Initiate Zone Lockdown — ${event.location}`,
        detail: `${event.eventType === 'TAILGATING' ? 'Tailgating' : 'Unauthorized access'} detected at ${event.location}. Recommend locking down the zone and reviewing badge logs immediately.`,
        priority: 'Critical',
        actionType: 'lockdown',
        eventId: event.eventId,
      });
    });

    cctvResults
      .filter((c) => c.status === 'Unattended Object' || c.status === 'Off-Hours Activity')
      .forEach((c) => {
        recommendations.push({
          id: `dispatch-${c.cameraId}`,
          category: 'CCTV Alert',
          title: `Dispatch Security Guard — ${c.location}`,
          detail: `Camera ${c.cameraId} flagged "${c.status}" at ${c.location} (${c.confidencePct}% confidence). Recommend dispatching a guard to verify in person.`,
          priority: c.status === 'Unattended Object' ? 'Critical' : 'High',
          actionType: 'dispatch',
          cameraId: c.cameraId,
        });
      });

    if (overstayed.length) {
      recommendations.push({
        id: 'visitor-followup',
        category: 'Visitor Management',
        title: `Follow up on ${overstayed.length} overstayed visitor(s)`,
        detail: `${overstayed.map((v) => v.name).join(', ')} ${overstayed.length === 1 ? 'has' : 'have'} passed their expected checkout time. Confirm they're still authorized on-site.`,
        priority: 'Medium',
        actionType: 'followup',
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: 'security-nominal',
        category: 'General',
        title: 'No active security concerns',
        detail: 'No breaches, flagged camera activity, or overstayed visitors detected on this scan.',
        priority: 'Low',
      });
    }

    return recommendations;
  }

  /**
   * getCameraRoster(facilityId): derives a simulated camera list from the
   * facility's distinct SecurityEvent locations (or a sensible default
   * roster if none exist yet). Public because both getSummary and
   * getCctvFeed in the controller need it directly, not just
   * runSecurityCycle.
   */
  async getCameraRoster(facilityId) {
    const distinctLocations = await SecurityEvent.distinct('location', { facilityId });
    const locations = distinctLocations.length ? distinctLocations : ['Main Entrance', 'Lobby', 'Parking Garage', 'Loading Dock'];
    return locations.map((location, i) => ({
      cameraId: `CAM-${String(i + 1).padStart(2, '0')}`,
      zoneName: location,
      location,
    }));
  }

  /**
   * runSecurityCycle(facilityId): orchestrates a full pass - refresh
   * visitor statuses, detect breaches from recent unresolved events,
   * run simulated CCTV analysis, generate recommendations. Used by the
   * seed flow and the dashboard's "Run Security Scan" action.
   *
   * @param {Array} cameras optional camera roster; if omitted, one is
   *   derived from the facility's SecurityEvent locations seen recently
   */
  async runSecurityCycle(facilityId, cameras = null) {
    const overstayed = await this.refreshVisitorStatuses(facilityId);

    const since = new Date(Date.now() - this.eventLookbackDays * 24 * 60 * 60 * 1000);
    const recentEvents = await SecurityEvent.find({
      facilityId,
      timestamp: { $gte: since },
      status: { $ne: 'Resolved' },
    }).lean();

    const { breaches, alertsCreated } = await this.detectBreach(recentEvents);

    const cameraRoster = cameras || (await this.getCameraRoster(facilityId));
    const cctvResults = this.analyzeCCTV(cameraRoster);

    const recommendations = this.generateRecommendations({ breaches, cctvResults, overstayed });

    return { overstayed, breaches, alertsCreated, cctvResults, recommendations };
  }

  // ---------- internal helpers ----------

  _isOffHours(hour) {
    if (this.offHoursStartHour === this.offHoursEndHour) return false;
    if (this.offHoursStartHour < this.offHoursEndHour) {
      return hour >= this.offHoursStartHour && hour < this.offHoursEndHour;
    }
    // window wraps past midnight, e.g. 20 -> 6
    return hour >= this.offHoursStartHour || hour < this.offHoursEndHour;
  }

  static _hashToUnitInterval(str) {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    const intVal = parseInt(hash.slice(0, 8), 16);
    return intVal / 0xffffffff;
  }
}

module.exports = SecurityAgent;
module.exports.SecurityAgent = SecurityAgent;

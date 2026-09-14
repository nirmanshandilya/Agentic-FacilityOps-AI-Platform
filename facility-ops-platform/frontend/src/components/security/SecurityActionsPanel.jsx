import React, { useState } from 'react';
import { ShieldAlert, Video, UserCheck, Gauge, Loader2, CheckCircle2, Check, X } from 'lucide-react';
import MetricBadge from '../common/MetricBadge';
import { updateSecurityEventStatus } from '../../services/api';

const CATEGORY_ICON = {
  'Breach Response': ShieldAlert,
  'CCTV Alert': Video,
  'Visitor Management': UserCheck,
  General: Gauge,
};

/**
 * Agent Actions panel. Recommendations come in three flavors, handled
 * differently because only one of them maps to a real persisted record:
 *  - "lockdown" (actionType) ties to a real SecurityEvent -> the button
 *    calls the API and actually updates that event's status.
 *  - "dispatch" comes from a simulated CCTV detection, which isn't
 *    persisted anywhere (there's no real camera feed) - so this is a
 *    local-only acknowledgment, same as Energy's Accept/Dismiss pattern.
 *  - "followup"/general recommendations are also local-only Accept/Dismiss.
 */
export default function SecurityActionsPanel({ recommendations = [], loading, onEventUpdated }) {
  const [pendingId, setPendingId] = useState(null);
  const [resolvedIds, setResolvedIds] = useState({}); // id -> 'lockdown' | 'dispatched' | 'accepted' | 'dismissed'

  async function handleLockdown(rec) {
    setPendingId(rec.id);
    try {
      await updateSecurityEventStatus(rec.eventId, 'Investigating');
      setResolvedIds((prev) => ({ ...prev, [rec.id]: 'lockdown' }));
      onEventUpdated?.();
    } catch (err) {
      console.error('Failed to update security event:', err);
    } finally {
      setPendingId(null);
    }
  }

  function handleLocalAction(id, decision) {
    setResolvedIds((prev) => ({ ...prev, [id]: decision }));
  }

  return (
    <div className="panel p-panel">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-7 w-7 rounded-md bg-status-criticalMuted flex items-center justify-center text-status-critical">
          <ShieldAlert size={14} />
        </span>
        <h3 className="text-sm font-heading font-semibold text-text-primary">Agent Actions</h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Scanning for security concerns…</p>}
      {!loading && recommendations.length === 0 && (
        <p className="text-xs text-text-muted">No security actions recommended right now.</p>
      )}

      <ul className="space-y-3">
        {recommendations.map((rec) => {
          const Icon = CATEGORY_ICON[rec.category] || Gauge;
          const resolution = resolvedIds[rec.id];
          const isPending = pendingId === rec.id;

          return (
            <li key={rec.id} className="rounded-md border border-border-muted bg-surface-elevated/60 p-3.5">
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 shrink-0 rounded-md bg-surface-sunken flex items-center justify-center text-status-critical">
                  <Icon size={15} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm text-text-primary font-medium">{rec.title}</p>
                    {rec.priority && <MetricBadge label={rec.priority} variant={rec.priority} />}
                  </div>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{rec.detail}</p>

                  <div className="flex items-center justify-end mt-3">
                    {resolution ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-status-success">
                        <CheckCircle2 size={12} />
                        {resolution === 'lockdown' && 'Lockdown initiated'}
                        {resolution === 'dispatched' && 'Guard dispatched'}
                        {resolution === 'accepted' && 'Accepted'}
                        {resolution === 'dismissed' && 'Dismissed'}
                      </span>
                    ) : rec.actionType === 'lockdown' ? (
                      <button
                        type="button"
                        onClick={() => handleLockdown(rec)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-status-criticalMuted text-status-critical hover:brightness-110 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                        {isPending ? 'Initiating…' : 'Initiate Zone Lockdown'}
                      </button>
                    ) : rec.actionType === 'dispatch' ? (
                      <button
                        type="button"
                        onClick={() => handleLocalAction(rec.id, 'dispatched')}
                        className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110"
                      >
                        <UserCheck size={12} /> Dispatch Security Guard
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLocalAction(rec.id, 'accepted')}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-status-successMuted text-status-success hover:brightness-110"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLocalAction(rec.id, 'dismissed')}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-sunken text-text-secondary hover:text-text-primary"
                        >
                          <X size={12} /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

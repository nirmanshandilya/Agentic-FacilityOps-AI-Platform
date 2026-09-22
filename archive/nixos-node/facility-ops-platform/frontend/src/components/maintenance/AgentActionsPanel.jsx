import React, { useState } from 'react';
import { Wrench, Loader2, CheckCircle2 } from 'lucide-react';
import MetricBadge from '../common/MetricBadge';
import { createWorkOrder } from '../../services/api';

/**
 * AI-generated maintenance schedule recommendations, one per at-risk asset,
 * each with a "Generate Work Order" action that calls the Maintenance
 * Agent's single-asset work order endpoint directly (bypassing the
 * automatic risk-window filter, since a human has now reviewed it).
 */
export default function AgentActionsPanel({ facilityId, recommendations = [], loading, onWorkOrderCreated }) {
  const [pendingId, setPendingId] = useState(null);
  const [createdIds, setCreatedIds] = useState({}); // assetId -> maintenanceId

  async function handleGenerate(rec) {
    if (!rec.assetId) return;
    setPendingId(rec.id);
    try {
      const res = await createWorkOrder(facilityId, rec.assetId);
      setCreatedIds((prev) => ({ ...prev, [rec.assetId]: res.data.record.maintenanceId }));
      onWorkOrderCreated?.(res.data);
    } catch (err) {
      console.error('Failed to create work order:', err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="panel p-panel">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-7 w-7 rounded-md bg-brand-accentMuted flex items-center justify-center text-brand-accent">
          <Wrench size={14} />
        </span>
        <h3 className="text-sm font-heading font-semibold text-text-primary">Agent Actions</h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Analyzing asset health…</p>}

      {!loading && recommendations.length === 0 && (
        <p className="text-xs text-text-muted">No maintenance actions recommended right now.</p>
      )}

      <ul className="space-y-3">
        {recommendations.map((rec) => {
          const created = rec.assetId ? createdIds[rec.assetId] : null;
          const isPending = pendingId === rec.id;

          return (
            <li key={rec.id} className="rounded-md border border-border-muted bg-surface-elevated/60 p-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-text-primary font-medium">{rec.title}</p>
                {rec.priority && <MetricBadge label={rec.priority} variant={rec.priority} />}
              </div>

              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{rec.detail}</p>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-text-muted">
                  {rec.daysRemaining !== null && rec.daysRemaining !== undefined
                    ? `~${rec.daysRemaining}d to predicted failure`
                    : 'No action needed'}
                  {rec.estimatedDowntimeAvoidedHours > 0 && ` · ~${rec.estimatedDowntimeAvoidedHours}h downtime avoidable`}
                </span>

                {rec.assetId && (
                  created ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-status-success">
                      <CheckCircle2 size={12} /> Work order created
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerate(rec)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                      {isPending ? 'Creating…' : 'Generate Work Order'}
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

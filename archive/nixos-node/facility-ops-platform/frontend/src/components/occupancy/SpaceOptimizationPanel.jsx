import React, { useState } from 'react';
import { Sparkles, Users, LayoutGrid, Gauge, Check, X } from 'lucide-react';
import MetricBadge from '../common/MetricBadge';

const CATEGORY_ICON = {
  Overcrowding: Users,
  'Space Utilization': LayoutGrid,
  General: Gauge,
};

/**
 * Feed of OccupancyAgent-generated space optimization recommendations.
 * Same Accept/Dismiss interaction as Energy's AIRecommendationsCard -
 * there's no single-click "act on it" API call here (unlike Maintenance's
 * "Generate Work Order"), since space reallocation is a human planning
 * decision, not something the agent can execute directly.
 */
export default function SpaceOptimizationPanel({ recommendations = [], loading }) {
  const [decisions, setDecisions] = useState({}); // id -> 'accepted' | 'dismissed'

  function decide(id, decision) {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  }

  return (
    <div className="panel p-panel">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-7 w-7 rounded-md bg-brand-accentMuted flex items-center justify-center text-brand-accent">
          <Sparkles size={14} />
        </span>
        <h3 className="text-sm font-heading font-semibold text-text-primary">Agent Actions</h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Analyzing space utilization…</p>}

      {!loading && recommendations.length === 0 && (
        <p className="text-xs text-text-muted">No space optimization actions recommended right now.</p>
      )}

      <ul className="space-y-3">
        {recommendations.map((rec) => {
          const Icon = CATEGORY_ICON[rec.category] || Gauge;
          const decision = decisions[rec.id];

          return (
            <li
              key={rec.id}
              className={[
                'rounded-md border border-border-muted bg-surface-elevated/60 p-3.5 flex gap-3 transition-opacity',
                decision === 'dismissed' ? 'opacity-40' : 'opacity-100',
              ].join(' ')}
            >
              <span className="h-8 w-8 shrink-0 rounded-md bg-surface-sunken flex items-center justify-center text-brand-secondary">
                <Icon size={15} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-text-primary font-medium">{rec.title}</p>
                  <MetricBadge label={rec.priority} variant={rec.priority} />
                </div>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">{rec.detail}</p>

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-text-muted">{rec.category}</span>

                  {!decision ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => decide(rec.id, 'accepted')}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-status-successMuted text-status-success hover:brightness-110"
                      >
                        <Check size={12} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(rec.id, 'dismissed')}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-sunken text-text-secondary hover:text-text-primary"
                      >
                        <X size={12} /> Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className={`text-[11px] font-medium ${decision === 'accepted' ? 'text-status-success' : 'text-text-muted'}`}>
                      {decision === 'accepted' ? 'Accepted' : 'Dismissed'}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

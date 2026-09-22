import React, { useMemo } from 'react';
import theme from '../../styles/theme';

/**
 * Buckets assets by healthScore into the four tiers shown in the wireframe.
 * Boundaries line up with the MaintenanceAgent's own thresholds (config/env.js):
 * healthWarningThreshold=75 splits Good/Warning, healthCriticalThreshold=50
 * splits Warning/Critical - Excellent is just the top half of "healthy".
 */
const TIERS = [
  { key: 'excellent', label: 'Excellent', min: 90, color: theme.colors.status.success },
  { key: 'good', label: 'Good', min: 75, color: theme.colors.brand.secondary },
  { key: 'warning', label: 'Warning', min: 50, color: theme.colors.status.warning },
  { key: 'critical', label: 'Critical', min: 0, color: theme.colors.status.critical },
];

function bucketFor(healthScore) {
  return TIERS.find((t) => healthScore >= t.min) || TIERS[TIERS.length - 1];
}

export default function HealthDistributionPanel({ assets = [] }) {
  const { counts, total, offlineCount } = useMemo(() => {
    const online = assets.filter((a) => a.status !== 'Offline');
    const tally = { excellent: 0, good: 0, warning: 0, critical: 0 };
    online.forEach((a) => {
      const tier = bucketFor(a.healthScore ?? 0);
      tally[tier.key] += 1;
    });
    return { counts: tally, total: online.length, offlineCount: assets.length - online.length };
  }, [assets]);

  return (
    <div className="panel p-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-semibold text-text-primary">Equipment Health Distribution</h3>
        {offlineCount > 0 && <span className="text-[11px] text-text-muted">{offlineCount} offline (excluded)</span>}
      </div>

      <div className="space-y-4 flex-1">
        {TIERS.map((tier) => {
          const count = counts[tier.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={tier.key}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ background: tier.color }} />
                  {tier.label}
                </span>
                <span className="font-data text-text-primary">
                  {pct}% <span className="text-text-muted">({count})</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: tier.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {total === 0 && <p className="text-xs text-text-muted mt-2">No assets seeded for this facility yet.</p>}
    </div>
  );
}

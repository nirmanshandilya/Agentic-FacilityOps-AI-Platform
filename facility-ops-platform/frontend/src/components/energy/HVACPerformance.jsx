import React, { useMemo } from 'react';
import theme from '../../styles/theme';

const SUBSYSTEMS = ['Chiller Plant', 'AHU — Floor 1', 'AHU — Floor 2', 'Cooling Tower'];

function statusFromScore(score) {
  if (score === null || score === undefined) return { label: 'No Data', color: theme.colors.text.muted };
  if (score >= 80) return { label: 'Optimal', color: theme.colors.status.success };
  if (score >= 60) return { label: 'Watch', color: theme.colors.status.warning };
  return { label: 'Critical', color: theme.colors.status.critical };
}

/**
 * HVAC efficiency status matrix. The overall gauge reflects the Energy
 * Agent's calculated efficiency score; per-subsystem rows apply a small,
 * deterministic variance around that score (seeded by name) so the
 * matrix is stable across renders rather than randomly flickering.
 */
export default function HVACPerformance({ efficiencyScore, hvacAnomalyActive }) {
  const overall = statusFromScore(efficiencyScore);

  const subsystemRows = useMemo(() => {
    return SUBSYSTEMS.map((name, i) => {
      const variance = ((i * 37) % 11) - 5; // deterministic -5..+5 spread
      const score = efficiencyScore === null || efficiencyScore === undefined ? null : Math.max(0, Math.min(100, efficiencyScore + variance));
      const flagged = hvacAnomalyActive && i === 0; // surface the anomaly on the primary chiller plant row
      return { name, score, status: flagged ? { label: 'Alert', color: theme.colors.status.critical } : statusFromScore(score) };
    });
  }, [efficiencyScore, hvacAnomalyActive]);

  const gaugeAngle = efficiencyScore ? (efficiencyScore / 100) * 270 : 0;

  return (
    <div className="panel p-panel h-[320px] flex flex-col">
      <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">HVAC Efficiency Status</h3>

      <div className="flex items-center gap-5 mb-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[135deg]">
            <circle cx="50" cy="50" r="42" fill="none" stroke={theme.colors.surface.sunken} strokeWidth="9" strokeDasharray="197 264" strokeLinecap="round" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={overall.color}
              strokeWidth="9"
              strokeDasharray={`${(gaugeAngle / 360) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-data text-lg font-semibold text-text-primary">
              {efficiencyScore ?? '—'}{efficiencyScore !== null && efficiencyScore !== undefined ? '%' : ''}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Overall status</p>
          <p className="text-sm font-medium" style={{ color: overall.color }}>{overall.label}</p>
          <p className="text-xs text-text-muted mt-1">Baseline vs. actual load comparison</p>
        </div>
      </div>

      <ul className="space-y-2 flex-1 overflow-auto">
        {subsystemRows.map((row) => (
          <li key={row.name} className="flex items-center justify-between text-xs border-t border-border-muted pt-2 first:border-t-0 first:pt-0">
            <span className="text-text-secondary">{row.name}</span>
            <span className="flex items-center gap-2">
              <span className="font-data text-text-primary">{row.score !== null ? `${Math.round(row.score)}%` : '—'}</span>
              <span className="pill" style={{ color: row.status.color, backgroundColor: `${row.status.color}22` }}>
                {row.status.label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

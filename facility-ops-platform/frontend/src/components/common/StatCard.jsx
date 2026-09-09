import React from 'react';

const ACCENT_CLASSES = {
  amber: { icon: 'text-brand-primary', ring: 'bg-brand-primaryMuted' },
  teal: { icon: 'text-brand-secondary', ring: 'bg-brand-secondaryMuted' },
  indigo: { icon: 'text-brand-accent', ring: 'bg-brand-accentMuted' },
  success: { icon: 'text-status-success', ring: 'bg-status-successMuted' },
};

/**
 * KPI card used across the top of every dashboard (Total Energy, Cost
 * Savings, Efficiency Score, Carbon Reduction, ...). Purely presentational -
 * all styling comes from Tailwind tokens sourced from theme.js.
 */
export default function StatCard({ icon: Icon, label, value, unit, subtext, accent = 'amber', trend }) {
  const colors = ACCENT_CLASSES[accent] || ACCENT_CLASSES.amber;

  return (
    <div className="kpi-card p-card flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {Icon && (
          <span className={`h-8 w-8 rounded-md flex items-center justify-center ${colors.ring}`}>
            <Icon size={16} className={colors.icon} strokeWidth={2} />
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-data text-2xl font-semibold text-text-primary tracking-tight">{value}</span>
        {unit && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>

      {(subtext || trend) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span className={trend.direction === 'up' ? 'text-status-success' : 'text-status-critical'}>
              {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
            </span>
          )}
          {subtext && <span className="text-text-muted">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

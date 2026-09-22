import React from 'react';
import { ChevronDown, Radio } from 'lucide-react';

const RANGE_OPTIONS = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

export default function Navbar({
  facilities,
  selectedFacilityId,
  onFacilityChange,
  range,
  onRangeChange,
  isLive,
  title = 'Energy Intelligence',
  showRangeFilter = true,
}) {
  const selected = facilities.find((f) => f.facilityId === selectedFacilityId);

  return (
    <header className="border-b border-border bg-surface-card px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-lg font-heading font-semibold text-text-primary leading-tight">{title}</h1>
        <p className="text-xs text-text-muted mt-0.5">Agentic FacilityOps AI Platform</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Facility selector */}
        <div className="relative">
          <select
            value={selectedFacilityId || ''}
            onChange={(e) => onFacilityChange(e.target.value)}
            className="appearance-none bg-surface-elevated border border-border text-sm text-text-primary rounded-md pl-3 pr-8 py-2 focus:outline-none focus-visible:outline-brand-accent min-w-[190px]"
          >
            {facilities.map((f) => (
              <option key={f.facilityId} value={f.facilityId}>
                {f.facilityName}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Date range filter - hidden on pages with no time-range-scoped data (e.g. Maintenance) */}
        {showRangeFilter && (
          <div className="flex items-center bg-surface-elevated border border-border rounded-md p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onRangeChange(opt.key)}
                className={[
                  'px-3 py-1.5 text-xs rounded-[6px] transition-colors font-data',
                  range === opt.key ? 'bg-brand-primaryMuted text-brand-primary' : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Live monitoring indicator */}
        <div className="flex items-center gap-2 text-xs text-status-success bg-status-successMuted rounded-full px-3 py-1.5">
          <Radio size={12} className="hidden sm:block" />
          <span className={`h-1.5 w-1.5 rounded-full bg-status-success ${isLive ? 'live-dot' : ''}`} />
          {isLive ? 'Live Monitoring' : 'Idle'}
        </div>
      </div>

      {selected && (
        <p className="w-full text-xs text-text-muted -mt-1">
          {selected.facilityType} · {selected.location}
        </p>
      )}
    </header>
  );
}

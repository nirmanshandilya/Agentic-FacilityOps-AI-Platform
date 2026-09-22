import React from 'react';
import theme from '../../styles/theme';

/**
 * Same color-by-severity logic as the rest of the app's status badges:
 * green under warning range, amber approaching the overcrowding
 * threshold, red at/above it. Threshold itself lives on the backend
 * (OccupancyAgent) - this is just a presentation-side approximation
 * using the same 90% cutoff so the bar color and the Alert agree.
 */
function colorForRate(rate) {
  if (rate >= 90) return theme.colors.status.critical;
  if (rate >= 70) return theme.colors.status.warning;
  return theme.colors.brand.secondary;
}

export default function ZoneDistributionPanel({ zones = [] }) {
  return (
    <div className="panel p-panel h-full flex flex-col">
      <h3 className="text-sm font-heading font-semibold text-text-primary mb-4">Zone Occupancy Distribution</h3>

      {!zones.length && <p className="text-xs text-text-muted">No zones seeded for this facility yet.</p>}

      <div className="space-y-4 flex-1">
        {zones.map((zone) => {
          const color = colorForRate(zone.occupancyRate);
          return (
            <div key={zone.zoneId}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-text-secondary">{zone.name}</span>
                <span className="font-data text-text-primary">
                  {zone.occupancyRate}%{' '}
                  <span className="text-text-muted">
                    ({zone.currentOccupancy}/{zone.maxCapacity})
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, zone.occupancyRate)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

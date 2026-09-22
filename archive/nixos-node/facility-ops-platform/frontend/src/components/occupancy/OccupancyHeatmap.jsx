import React, { useMemo } from 'react';
import theme from '../../styles/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21];

/**
 * Renders the {day, hour, avgUtilizationPct} buckets returned by
 * OccupancyAgent.analyzeUtilization(). Same 3-hour x day-of-week grid
 * shape as Energy's HeatmapView, but colored teal (brand.secondary)
 * instead of amber to keep the two heatmaps visually distinct at a glance.
 */
export default function OccupancyHeatmap({ buckets = [] }) {
  const { bucketMap, max } = useMemo(() => {
    const map = new Map();
    let maxVal = 0;
    buckets.forEach((b) => {
      map.set(`${b.day}-${b.hour}`, b.avgUtilizationPct);
      maxVal = Math.max(maxVal, b.avgUtilizationPct);
    });
    return { bucketMap: map, max: maxVal || 1 };
  }, [buckets]);

  function intensityColor(value) {
    if (value === undefined) return theme.colors.surface.sunken;
    const ratio = Math.min(1, value / Math.max(max, 100));
    const alpha = 0.15 + ratio * 0.85;
    return `rgba(34, 211, 184, ${alpha.toFixed(2)})`; // brand.secondary (teal)
  }

  return (
    <div className="panel p-panel h-[320px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-text-primary">Occupancy Heatmap</h3>
        <span className="text-[11px] text-text-muted">avg. utilization by day / time block</span>
      </div>

      {!buckets.length ? (
        <p className="text-xs text-text-muted">No occupancy history yet — seed data to populate the heatmap.</p>
      ) : (
        <div className="flex-1 flex flex-col justify-between min-h-0">
          <div className="grid" style={{ gridTemplateColumns: `40px repeat(${HOUR_BUCKETS.length}, 1fr)`, gap: 4 }}>
            <div />
            {HOUR_BUCKETS.map((h) => (
              <div key={h} className="text-[10px] text-text-muted text-center font-data">
                {h.toString().padStart(2, '0')}h
              </div>
            ))}

            {DAYS.map((day, dayIdx) => (
              <React.Fragment key={day}>
                <div className="text-[10px] text-text-muted flex items-center">{day}</div>
                {HOUR_BUCKETS.map((h) => {
                  const value = bucketMap.get(`${dayIdx}-${h}`);
                  return (
                    <div
                      key={`${day}-${h}`}
                      title={value !== undefined ? `${day} ${h}:00 — ${value}% avg. utilization` : 'No data'}
                      className="h-5 rounded-[4px] transition-colors"
                      style={{ backgroundColor: intensityColor(value) }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3 text-[10px] text-text-muted">
            <span>Low</span>
            <div
              className="flex-1 h-1.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, rgba(34,211,184,0.15), rgba(34,211,184,1))' }}
            />
            <span>High</span>
          </div>
        </div>
      )}
    </div>
  );
}

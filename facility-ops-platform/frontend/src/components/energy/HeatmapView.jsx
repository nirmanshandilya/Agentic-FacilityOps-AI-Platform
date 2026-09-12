import React, { useMemo } from 'react';
import theme from '../../styles/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21]; // 3-hour buckets across a day

/**
 * Energy intensity heatmap: rows = day of week, columns = 3-hour buckets.
 * Cell color intensity communicates relative electricity load, giving
 * facility managers a fast read on when consumption concentrates.
 */
export default function HeatmapView({ usage = [] }) {
  const grid = useMemo(() => {
    const buckets = {};
    let max = 0;

    usage.forEach((u) => {
      const d = new Date(u.timestamp);
      const day = d.getDay();
      const bucketStart = HOUR_BUCKETS.filter((h) => h <= d.getHours()).pop() ?? 0;
      const key = `${day}-${bucketStart}`;
      buckets[key] = (buckets[key] || 0) + u.electricityUsage;
      max = Math.max(max, buckets[key]);
    });

    return { buckets, max: max || 1 };
  }, [usage]);

  function intensityColor(value) {
    if (!value) return theme.colors.surface.sunken;
    const ratio = Math.min(1, value / grid.max);
    // Interpolate from muted amber -> full brand amber.
    const alpha = 0.15 + ratio * 0.85;
    return `rgba(245, 166, 35, ${alpha.toFixed(2)})`;
  }

  return (
    <div className="panel p-panel h-[320px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-text-primary">Energy Load Heatmap</h3>
        <span className="text-[11px] text-text-muted">kWh intensity by day / time block</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
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
                const value = grid.buckets[`${dayIdx}-${h}`] || 0;
                return (
                  <div
                    key={`${day}-${h}`}
                    title={`${day} ${h}:00 — ${value.toFixed(1)} kWh`}
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
          <div className="flex-1 h-1.5 rounded-full" style={{
            background: 'linear-gradient(90deg, rgba(245,166,35,0.15), rgba(245,166,35,1))',
          }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

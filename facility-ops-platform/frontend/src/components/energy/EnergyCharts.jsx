import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import theme from '../../styles/theme';

const chartColors = theme.colors.chart;
const brand = theme.colors.brand;
const surface = theme.colors.surface;

function formatHour(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ChartTooltip({ active, payload, label, unit = 'kWh' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2 text-xs">
      <p className="text-text-muted mb-1">{formatHour(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-data" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed ? p.value.toFixed(1) : p.value} {unit}
        </p>
      ))}
    </div>
  );
}

/**
 * Real-time electricity consumption vs. expected baseline.
 */
export function ElectricityTrendChart({ usage = [], baselineKwh }) {
  const data = useMemo(
    () =>
      usage.map((u) => ({
        timestamp: u.timestamp,
        actual: u.electricityUsage,
        baseline: baselineKwh,
      })),
    [usage, baselineKwh]
  );

  return (
    <div className="panel p-panel h-[320px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-heading font-semibold text-text-primary">Electricity vs. Baseline</h3>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: brand.primary }} /> Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: chartColors.axis }} /> Baseline
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatHour}
            stroke={chartColors.axis}
            tick={{ fontSize: 11, fill: chartColors.axis }}
            minTickGap={40}
          />
          <YAxis stroke={chartColors.axis} tick={{ fontSize: 11, fill: chartColors.axis }} width={40} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="actual" name="Actual" stroke={brand.primary} strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="baseline"
            name="Baseline"
            stroke={chartColors.axis}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Energy distribution breakdown donut chart (HVAC / Lighting / Equipment / Other).
 */
export function EnergyDistributionChart({ distribution }) {
  const data = [
    { name: 'HVAC Systems', value: distribution?.hvacPct ?? 0 },
    { name: 'Lighting', value: distribution?.lightingPct ?? 0 },
    { name: 'Equipment', value: distribution?.equipmentPct ?? 0 },
    { name: 'Other Systems', value: distribution?.otherPct ?? 0 },
  ];
  const colors = chartColors.series;

  return (
    <div className="panel p-panel h-[320px] flex flex-col">
      <h3 className="text-sm font-heading font-semibold text-text-primary mb-2">Energy Distribution</h3>
      <div className="flex-1 flex items-center gap-4">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2} stroke={surface.card}>
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="panel px-3 py-2 text-xs">
                      <span className="font-data">{payload[0].name}: {payload[0].value}%</span>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-1/2 space-y-2.5">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                {d.name}
              </span>
              <span className="font-data text-text-primary">{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Water consumption trend bar chart.
 */
export function WaterUsageChart({ usage = [] }) {
  const data = usage.map((u) => ({ timestamp: u.timestamp, water: u.waterUsage }));

  return (
    <div className="panel p-panel h-[320px] flex flex-col">
      <h3 className="text-sm font-heading font-semibold text-text-primary mb-2">Water Consumption Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatHour}
            stroke={chartColors.axis}
            tick={{ fontSize: 11, fill: chartColors.axis }}
            minTickGap={40}
          />
          <YAxis stroke={chartColors.axis} tick={{ fontSize: 11, fill: chartColors.axis }} width={40} />
          <Tooltip content={<ChartTooltip unit="gal" />} />
          <Bar dataKey="water" name="Water" fill={brand.secondary} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import MetricBadge from '../common/MetricBadge';

function formatDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function countdownColor(days) {
  if (days <= 7) return 'text-status-critical';
  if (days <= 21) return 'text-status-warning';
  return 'text-text-secondary';
}

/**
 * Table of assets currently flagged by MaintenanceAgent.predictFailures(),
 * sorted (by the agent) with the most urgent countdown first.
 */
export default function FailureRiskTable({ predictions = [], loading }) {
  return (
    <div className="panel p-panel h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-7 w-7 rounded-md bg-status-criticalMuted flex items-center justify-center text-status-critical">
          <AlertTriangle size={14} />
        </span>
        <h3 className="text-sm font-heading font-semibold text-text-primary">Failure Risk Predictions</h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Running predictive scan…</p>}

      {!loading && predictions.length === 0 && (
        <p className="text-xs text-text-muted">No assets currently at risk — all equipment within healthy range.</p>
      )}

      {predictions.length > 0 && (
        <div className="overflow-auto -mx-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-muted">
                <th className="font-medium py-2 px-1">Asset</th>
                <th className="font-medium py-2 px-1">Health</th>
                <th className="font-medium py-2 px-1">Risk</th>
                <th className="font-medium py-2 px-1">Countdown</th>
                <th className="font-medium py-2 px-1">Predicted Date</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.assetId} className="border-b border-border-muted last:border-0">
                  <td className="py-2.5 px-1">
                    <p className="text-text-primary font-medium">{p.assetName}</p>
                    <p className="text-text-muted text-[10px]">{p.assetType}</p>
                  </td>
                  <td className="py-2.5 px-1 font-data text-text-primary">{p.healthScore}%</td>
                  <td className="py-2.5 px-1">
                    <MetricBadge label={p.riskLevel} variant={p.riskLevel} />
                  </td>
                  <td className={`py-2.5 px-1 font-data font-medium ${countdownColor(p.daysRemaining)}`}>
                    {p.daysRemaining}d
                  </td>
                  <td className="py-2.5 px-1 text-text-secondary font-data">{formatDate(p.predictedFailureDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

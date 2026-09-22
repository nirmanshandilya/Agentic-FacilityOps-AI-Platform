import React from 'react';
import { ClipboardList } from 'lucide-react';
import MetricBadge from '../common/MetricBadge';

function formatTime(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const TYPE_STYLES = {
  'Access Denial': 'bg-status-criticalMuted text-status-critical',
  'Security Event': 'bg-status-warningMuted text-status-warning',
  'Visitor Movement': 'bg-brand-accentMuted text-brand-accent',
};

/**
 * Renders the merged, normalized feed from GET /security/:facilityId/access-logs
 * (SecurityEvents + Visitor check-in/out activity, already joined and
 * sorted server-side).
 */
export default function AccessLogsTable({ logs = [], loading }) {
  return (
    <div className="panel p-panel h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-7 w-7 rounded-md bg-surface-elevated flex items-center justify-center text-text-secondary">
          <ClipboardList size={14} />
        </span>
        <h3 className="text-sm font-heading font-semibold text-text-primary">Access Logs</h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Loading access logs…</p>}
      {!loading && !logs.length && <p className="text-xs text-text-muted">No access activity recorded yet.</p>}

      {logs.length > 0 && (
        <div className="overflow-auto -mx-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-muted">
                <th className="font-medium py-2 px-1">Type</th>
                <th className="font-medium py-2 px-1">Description</th>
                <th className="font-medium py-2 px-1">Location</th>
                <th className="font-medium py-2 px-1">Time</th>
                <th className="font-medium py-2 px-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border-muted last:border-0">
                  <td className="py-2.5 px-1">
                    <span className={`pill text-[10px] ${TYPE_STYLES[log.type] || 'bg-surface-elevated text-text-secondary'}`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-1 text-text-primary">{log.description}</td>
                  <td className="py-2.5 px-1 text-text-secondary">{log.location}</td>
                  <td className="py-2.5 px-1 text-text-muted font-data">{formatTime(log.timestamp)}</td>
                  <td className="py-2.5 px-1">
                    {log.severity ? (
                      <MetricBadge label={log.severity} variant={log.severity} />
                    ) : (
                      <MetricBadge label={log.status} variant={log.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

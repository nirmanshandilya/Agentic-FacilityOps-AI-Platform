import React from 'react';

const SEVERITY_STYLES = {
  Low: 'bg-status-infoMuted text-status-info',
  Medium: 'bg-status-warningMuted text-status-warning',
  High: 'bg-status-criticalMuted text-status-critical',
  Critical: 'bg-status-criticalMuted text-status-critical',
  Active: 'bg-status-warningMuted text-status-warning',
  Acknowledged: 'bg-status-infoMuted text-status-info',
  Resolved: 'bg-status-successMuted text-status-success',
};

/**
 * Small pill badge for severity levels and alert statuses. Colors are
 * mapped to the theme's status palette so a single token change
 * (theme.js -> colors.status) recolors every badge in the app.
 */
export default function MetricBadge({ label, variant }) {
  const classes = SEVERITY_STYLES[variant] || SEVERITY_STYLES[label] || 'bg-surface-elevated text-text-secondary';
  return <span className={`pill inline-flex items-center ${classes}`}>{label}</span>;
}

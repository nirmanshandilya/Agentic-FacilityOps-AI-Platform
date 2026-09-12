import React from 'react';
import { Zap, Wrench, Users, ShieldCheck, DollarSign, LayoutGrid } from 'lucide-react';

/**
 * Thin icon-rail sidebar. Modules 1, 2 & 3 wire up Energy, Maintenance,
 * and Occupancy; the remaining agent slots (Security, Cost) still render
 * as disabled placeholders - one flip to `enabled: true` plus a new
 * entry in App.jsx's MODULES map is all a future module needs here.
 */
const NAV_ITEMS = [
  { key: 'energy', label: 'Energy', icon: Zap, enabled: true },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, enabled: true },
  { key: 'occupancy', label: 'Occupancy', icon: Users, enabled: true },
  { key: 'security', label: 'Security', icon: ShieldCheck, enabled: false },
  { key: 'cost', label: 'Cost', icon: DollarSign, enabled: false },
];

export default function Sidebar({ active = 'energy', onNavigate = () => {} }) {
  return (
    <aside className="w-[76px] shrink-0 h-screen sticky top-0 border-r border-border bg-surface-card flex flex-col items-center py-5 gap-6">
      <div className="h-9 w-9 rounded-md bg-brand-primaryMuted flex items-center justify-center text-brand-primary">
        <LayoutGrid size={18} strokeWidth={2.25} />
      </div>

      <nav className="flex flex-col gap-1.5 w-full px-2">
        {NAV_ITEMS.map(({ key, label, icon: Icon, enabled }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && onNavigate(key)}
              title={enabled ? label : `${label} — coming in a later module`}
              className={[
                'group flex flex-col items-center gap-1 rounded-md py-2.5 transition-colors',
                isActive ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/60',
                enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-35',
              ].join(' ')}
            >
              <Icon size={18} strokeWidth={2} className={isActive ? 'text-brand-primary' : 'text-text-secondary'} />
              <span className={`text-[10px] ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

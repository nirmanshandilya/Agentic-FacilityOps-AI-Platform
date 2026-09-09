import React from 'react';
import { Zap, Wrench, Users, ShieldCheck, DollarSign, LayoutGrid } from 'lucide-react';

/**
 * Thin icon-rail sidebar. Module 1 only wires up the Energy Agent, so the
 * remaining agent slots (Maintenance, Occupancy, Security, Cost) render as
 * disabled placeholders - this keeps the nav structure stable for later
 * modules instead of requiring a rebuild when they land.
 */
const NAV_ITEMS = [
  { key: 'energy', label: 'Energy', icon: Zap, enabled: true },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, enabled: false },
  { key: 'occupancy', label: 'Occupancy', icon: Users, enabled: false },
  { key: 'security', label: 'Security', icon: ShieldCheck, enabled: false },
  { key: 'cost', label: 'Cost', icon: DollarSign, enabled: false },
];

export default function Sidebar({ active = 'energy' }) {
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

import React, { useState } from 'react';
import EnergyDashboardPage from './pages/EnergyDashboardPage';
import MaintenanceDashboardPage from './pages/MaintenanceDashboardPage';

/**
 * Lightweight module switcher. Each dashboard page owns its own Sidebar +
 * Navbar internally and receives `onNavigate` to change the active module -
 * this avoids a routing dependency for now. When a real router is
 * introduced (Occupancy/Security/Cost modules will make that worthwhile),
 * `activeModule` becomes the route param and this switch becomes route
 * definitions instead.
 */
const MODULES = {
  energy: EnergyDashboardPage,
  maintenance: MaintenanceDashboardPage,
};

export default function App() {
  const [activeModule, setActiveModule] = useState('energy');

  const ActivePage = MODULES[activeModule] || EnergyDashboardPage;

  return <ActivePage onNavigate={setActiveModule} />;
}

import React, { useState } from 'react';
import EnergyDashboardPage from './pages/EnergyDashboardPage';
import MaintenanceDashboardPage from './pages/MaintenanceDashboardPage';
import OccupancyDashboardPage from './pages/OccupancyDashboardPage';
import SecurityDashboardPage from './pages/SecurityDashboardPage';

/**
 * Lightweight module switcher. Each dashboard page owns its own Sidebar +
 * Navbar internally and receives `onNavigate` to change the active module -
 * this avoids a routing dependency for now. When a real router is
 * introduced (Cost will make that worthwhile), `activeModule` becomes
 * the route param and this switch becomes route definitions instead.
 */
const MODULES = {
  energy: EnergyDashboardPage,
  maintenance: MaintenanceDashboardPage,
  occupancy: OccupancyDashboardPage,
  security: SecurityDashboardPage,
};

export default function App() {
  const [activeModule, setActiveModule] = useState('energy');

  const ActivePage = MODULES[activeModule] || EnergyDashboardPage;

  return <ActivePage onNavigate={setActiveModule} />;
}

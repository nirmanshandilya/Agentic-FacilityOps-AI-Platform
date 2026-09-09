import React from 'react';
import EnergyDashboardPage from './pages/EnergyDashboardPage';

/**
 * Module 1 only ships the Energy Intelligence dashboard. Future modules
 * will introduce client-side routing (react-router) to switch between
 * Energy / Maintenance / Occupancy / Security / Cost pages via the
 * Sidebar nav without restructuring this component.
 */
export default function App() {
  return <EnergyDashboardPage />;
}

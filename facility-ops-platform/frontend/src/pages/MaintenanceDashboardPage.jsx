import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, ClipboardList, AlertTriangle, TrendingDown, Database, Loader2, RefreshCcw } from 'lucide-react';

import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import StatCard from '../components/common/StatCard';
import HealthDistributionPanel from '../components/maintenance/HealthDistributionPanel';
import FailureRiskTable from '../components/maintenance/FailureRiskTable';
import AgentActionsPanel from '../components/maintenance/AgentActionsPanel';

import {
  fetchFacilities,
  fetchMaintenanceSummary,
  fetchAssets,
  fetchPredictions,
  fetchMaintenanceRecommendations,
  runPredictiveCycle,
  seedMaintenanceData,
} from '../services/api';

export default function MaintenanceDashboardPage({ onNavigate }) {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const [summary, setSummary] = useState(null);
  const [assets, setAssets] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Load facility list once (same facilities used by the Energy module).
  useEffect(() => {
    fetchFacilities()
      .then((res) => {
        setFacilities(res.data);
        if (res.data.length) setSelectedFacilityId(res.data[0].facilityId);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!selectedFacilityId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, assetsRes, predictionsRes, recRes] = await Promise.all([
        fetchMaintenanceSummary(selectedFacilityId),
        fetchAssets(selectedFacilityId),
        fetchPredictions(selectedFacilityId),
        fetchMaintenanceRecommendations(selectedFacilityId),
      ]);
      setSummary(summaryRes.data);
      setAssets(assetsRes.data);
      setPredictions(predictionsRes.data);
      setRecommendations(recRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  async function handleSeed() {
    if (!selectedFacilityId) return;
    setSeeding(true);
    setError(null);
    try {
      await seedMaintenanceData(selectedFacilityId, 10);
      await loadDashboardData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleRunCycle() {
    if (!selectedFacilityId) return;
    setScanning(true);
    setError(null);
    try {
      await runPredictiveCycle(selectedFacilityId);
      await loadDashboardData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar active="maintenance" onNavigate={onNavigate} />

      <div className="flex-1 min-w-0">
        <Navbar
          title="Predictive Maintenance"
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          onFacilityChange={setSelectedFacilityId}
          showRangeFilter={false}
          isLive={!loading && !!summary}
        />

        <main className="p-6 space-y-5">
          {error && (
            <div className="panel border-status-critical/40 px-4 py-3 text-sm text-status-critical">{error}</div>
          )}

          {!facilities.length && !error && (
            <div className="panel p-panel text-sm text-text-secondary">
              No facilities yet — create one from the Energy dashboard first, then seed assets below.
            </div>
          )}

          {/* Seed / run-cycle actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-text-muted">
              {selectedFacilityId ? `Facility ID: ${selectedFacilityId}` : 'Select a facility to begin'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunCycle}
                disabled={!selectedFacilityId || scanning}
                className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-md bg-surface-elevated text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                {scanning ? 'Scanning…' : 'Run Predictive Scan'}
              </button>
              <button
                type="button"
                onClick={handleSeed}
                disabled={!selectedFacilityId || seeding}
                className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110 disabled:opacity-50"
              >
                {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {seeding ? 'Seeding assets…' : 'Seed Asset Roster'}
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-grid">
            <StatCard
              icon={HardDrive}
              label="Assets Monitored"
              value={summary ? summary.assetsMonitored.toLocaleString() : '—'}
              subtext="across this facility"
              accent="indigo"
            />
            <StatCard
              icon={ClipboardList}
              label="Active Maintenance Tickets"
              value={summary ? summary.activeTickets.toLocaleString() : '—'}
              subtext="pending or in progress"
              accent="teal"
            />
            <StatCard
              icon={AlertTriangle}
              label="Predicted Failures"
              value={summary ? summary.predictedFailures.toLocaleString() : '—'}
              subtext="assets at risk"
              accent="critical"
            />
            <StatCard
              icon={TrendingDown}
              label="Downtime Reduction"
              value={summary ? summary.downtimeReductionPct : '—'}
              unit={summary ? '%' : ''}
              subtext="vs. reactive baseline"
              accent="success"
            />
          </div>

          {/* Health distribution + failure risk table */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-grid">
            <div className="xl:col-span-1">
              <HealthDistributionPanel assets={assets} />
            </div>
            <div className="xl:col-span-2">
              <FailureRiskTable predictions={predictions} loading={loading} />
            </div>
          </div>

          {/* Agent actions */}
          <AgentActionsPanel
            facilityId={selectedFacilityId}
            recommendations={recommendations}
            loading={loading}
            onWorkOrderCreated={loadDashboardData}
          />
        </main>
      </div>
    </div>
  );
}

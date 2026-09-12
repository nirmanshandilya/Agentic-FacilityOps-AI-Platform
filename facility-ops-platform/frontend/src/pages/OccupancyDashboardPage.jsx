import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Users, Gauge, Loader2, Database, RefreshCcw } from 'lucide-react';

import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import StatCard from '../components/common/StatCard';
import ZoneDistributionPanel from '../components/occupancy/ZoneDistributionPanel';
import OccupancyHeatmap from '../components/occupancy/OccupancyHeatmap';
import SpaceOptimizationPanel from '../components/occupancy/SpaceOptimizationPanel';

import {
  fetchFacilities,
  fetchOccupancySummary,
  fetchZones,
  fetchOccupancyHeatmap,
  fetchOccupancyRecommendations,
  runOccupancyCycle,
  seedOccupancyData,
} from '../services/api';

export default function OccupancyDashboardPage({ onNavigate }) {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [range, setRange] = useState('7d');

  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);
  const [heatmapBuckets, setHeatmapBuckets] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Same facility list used by Energy and Maintenance.
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
      const [summaryRes, zonesRes, heatmapRes, recRes] = await Promise.all([
        fetchOccupancySummary(selectedFacilityId),
        fetchZones(selectedFacilityId),
        fetchOccupancyHeatmap(selectedFacilityId, range),
        fetchOccupancyRecommendations(selectedFacilityId),
      ]);
      setSummary(summaryRes.data);
      setZones(zonesRes.data);
      setHeatmapBuckets(heatmapRes.data.buckets || []);
      setRecommendations(recRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId, range]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  async function handleSeed() {
    if (!selectedFacilityId) return;
    setSeeding(true);
    setError(null);
    try {
      await seedOccupancyData(selectedFacilityId, zones.length > 0);
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
      await runOccupancyCycle(selectedFacilityId);
      await loadDashboardData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar active="occupancy" onNavigate={onNavigate} />

      <div className="flex-1 min-w-0">
        <Navbar
          title="Occupancy Intelligence"
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          onFacilityChange={setSelectedFacilityId}
          range={range}
          onRangeChange={setRange}
          isLive={!loading && !!summary}
        />

        <main className="p-6 space-y-5">
          {error && (
            <div className="panel border-status-critical/40 px-4 py-3 text-sm text-status-critical">{error}</div>
          )}

          {!facilities.length && !error && (
            <div className="panel p-panel text-sm text-text-secondary">
              No facilities yet — create one from the Energy dashboard first, then seed zone data below.
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
                {scanning ? 'Scanning…' : 'Run Occupancy Scan'}
              </button>
              <button
                type="button"
                onClick={handleSeed}
                disabled={!selectedFacilityId || seeding}
                className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110 disabled:opacity-50"
              >
                {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {seeding ? 'Seeding…' : zones.length > 0 ? 'Refresh Occupancy History' : 'Seed Zone Data'}
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-grid">
            <StatCard
              icon={Building2}
              label="Zones Monitored"
              value={zones.length || '—'}
              subtext="across this facility"
              accent="indigo"
            />
            <StatCard
              icon={Gauge}
              label="Occupancy Rate"
              value={summary ? summary.occupancyRatePct : '—'}
              unit={summary ? '%' : ''}
              subtext="facility-wide average"
              accent="teal"
            />
            <StatCard
              icon={Users}
              label="Active Visitors"
              value={summary ? summary.activeVisitors.toLocaleString() : '—'}
              subtext="currently in the building"
              accent="amber"
            />
            <StatCard
              icon={Gauge}
              label="Workspace Efficiency"
              value={summary?.workspaceEfficiency ?? '—'}
              unit={summary?.workspaceEfficiency !== null && summary?.workspaceEfficiency !== undefined ? '%' : ''}
              subtext="ideal-utilization score"
              accent="success"
            />
          </div>

          {/* Zone distribution + heatmap */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-grid">
            <ZoneDistributionPanel zones={zones} />
            <OccupancyHeatmap buckets={heatmapBuckets} />
          </div>

          {/* Agent actions */}
          <SpaceOptimizationPanel recommendations={recommendations} loading={loading} />
        </main>
      </div>
    </div>
  );
}

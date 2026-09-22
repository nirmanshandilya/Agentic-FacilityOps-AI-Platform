import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldX, Users, Video, Loader2, Database, RefreshCcw } from 'lucide-react';

import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import StatCard from '../components/common/StatCard';
import LiveSecurityFeedGrid from '../components/security/LiveSecurityFeedGrid';
import AccessLogsTable from '../components/security/AccessLogsTable';
import SecurityActionsPanel from '../components/security/SecurityActionsPanel';

import {
  fetchFacilities,
  fetchSecuritySummary,
  fetchCctvFeed,
  fetchAccessLogs,
  fetchSecurityRecommendations,
  runSecurityCycle,
  seedSecurityData,
} from '../services/api';

export default function SecurityDashboardPage({ onNavigate }) {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const [summary, setSummary] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasSeeded, setHasSeeded] = useState(false);

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
      const [summaryRes, cctvRes, logsRes, recRes] = await Promise.all([
        fetchSecuritySummary(selectedFacilityId),
        fetchCctvFeed(selectedFacilityId),
        fetchAccessLogs(selectedFacilityId, 30),
        fetchSecurityRecommendations(selectedFacilityId),
      ]);
      setSummary(summaryRes.data);
      setCameras(cctvRes.data);
      setAccessLogs(logsRes.data);
      setRecommendations(recRes.data);
      setHasSeeded(logsRes.data.length > 0 || cctvRes.data.length > 0);
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
      await seedSecurityData(selectedFacilityId, hasSeeded);
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
      await runSecurityCycle(selectedFacilityId);
      await loadDashboardData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar active="security" onNavigate={onNavigate} />

      <div className="flex-1 min-w-0">
        <Navbar
          title="Security Intelligence"
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
              No facilities yet — create one from the Energy dashboard first, then seed security data below.
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
                {scanning ? 'Scanning…' : 'Run Security Scan'}
              </button>
              <button
                type="button"
                onClick={handleSeed}
                disabled={!selectedFacilityId || seeding}
                className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110 disabled:opacity-50"
              >
                {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {seeding ? 'Seeding…' : hasSeeded ? 'Add More History' : 'Seed Security Data'}
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-grid">
            <StatCard
              icon={ShieldAlert}
              label="Security Events"
              value={summary ? summary.securityEventsCount : '—'}
              subtext="active this period"
              accent="warning"
            />
            <StatCard
              icon={ShieldX}
              label="Unauthorized Access"
              value={summary ? summary.unauthorizedAccessCount : '—'}
              subtext="breach-type events, active"
              accent="critical"
            />
            <StatCard
              icon={Users}
              label="Active Visitors"
              value={summary ? summary.activeVisitors : '—'}
              subtext="currently on-site"
              accent="indigo"
            />
            <StatCard
              icon={Video}
              label="CCTV Coverage"
              value={summary ? summary.cctvCoveragePct : '—'}
              unit={summary ? '%' : ''}
              subtext="cameras online"
              accent="success"
            />
          </div>

          {/* Live security feed */}
          <LiveSecurityFeedGrid cameras={cameras} loading={loading} />

          {/* Access logs */}
          <AccessLogsTable logs={accessLogs} loading={loading} />

          {/* Agent actions */}
          <SecurityActionsPanel recommendations={recommendations} loading={loading} onEventUpdated={loadDashboardData} />
        </main>
      </div>
    </div>
  );
}

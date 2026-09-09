import React, { useCallback, useEffect, useState } from 'react';
import { Zap, DollarSign, Gauge, Leaf, Database, Loader2 } from 'lucide-react';

import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import StatCard from '../components/common/StatCard';
import { ElectricityTrendChart, EnergyDistributionChart, WaterUsageChart } from '../components/energy/EnergyCharts';
import HeatmapView from '../components/energy/HeatmapView';
import HVACPerformance from '../components/energy/HVACPerformance';
import AIRecommendationsCard from '../components/energy/AIRecommendationsCard';

import {
  fetchFacilities,
  fetchEnergySummary,
  fetchEnergyUsage,
  fetchRecommendations,
  fetchAnomalies,
  seedFacilityData,
} from '../services/api';

export default function EnergyDashboardPage() {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [range, setRange] = useState('7d');

  const [summary, setSummary] = useState(null);
  const [usage, setUsage] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [anomalyState, setAnomalyState] = useState(null);

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);

  // Load facility list once.
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
      const [summaryRes, usageRes, recRes, anomalyRes] = await Promise.all([
        fetchEnergySummary(selectedFacilityId, range),
        fetchEnergyUsage(selectedFacilityId, range),
        fetchRecommendations(selectedFacilityId),
        fetchAnomalies(selectedFacilityId),
      ]);
      setSummary(summaryRes.data);
      setUsage(usageRes.data);
      setRecommendations(recRes.data);
      setAnomalyState(anomalyRes.data);
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
    try {
      await seedFacilityData(selectedFacilityId, 14);
      await loadDashboardData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSeeding(false);
    }
  }

  const hvacAnomalyActive = (anomalyState?.anomalies || []).some((a) => a.type === 'HVAC_INEFFICIENCY');

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar active="energy" />

      <div className="flex-1 min-w-0">
        <Navbar
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
              No facilities yet. Create one via <code className="font-data">POST /api/facilities</code>, then seed data below.
            </div>
          )}

          {/* Seed / real-time toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-text-muted">
              {selectedFacilityId ? `Facility ID: ${selectedFacilityId}` : 'Select a facility to begin'}
            </p>
            <button
              type="button"
              onClick={handleSeed}
              disabled={!selectedFacilityId || seeding}
              className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-md bg-brand-primaryMuted text-brand-primary hover:brightness-110 disabled:opacity-50"
            >
              {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              {seeding ? 'Seeding IoT stream…' : 'Seed Realistic IoT Data'}
            </button>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-grid">
            <StatCard
              icon={Zap}
              label="Total Energy"
              value={summary ? (summary.totalEnergyKwh / 1000).toFixed(2) : '—'}
              unit="MWh"
              subtext={`over ${range}`}
              accent="amber"
            />
            <StatCard
              icon={DollarSign}
              label="Cost Savings"
              value={summary ? `$${summary.costSavingsUsd.toFixed(2)}` : '—'}
              subtext="vs. baseline cost"
              accent="success"
            />
            <StatCard
              icon={Gauge}
              label="Efficiency Score"
              value={summary?.efficiencyScore ?? '—'}
              unit={summary?.efficiencyScore !== null && summary?.efficiencyScore !== undefined ? '%' : ''}
              subtext="baseline vs. actual load"
              accent="indigo"
            />
            <StatCard
              icon={Leaf}
              label="Carbon Reduction"
              value={summary ? summary.carbonReductionPct : '—'}
              unit={summary ? '%' : ''}
              subtext={`${summary?.totalCarbonKg ?? 0} kgCO₂ emitted`}
              accent="teal"
            />
          </div>

          {/* Main visualizations */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-grid">
            <ElectricityTrendChart usage={usage} baselineKwh={summary ? summary.totalEnergyKwh / Math.max(usage.length, 1) : 0} />
            <EnergyDistributionChart distribution={summary?.distribution} />
            <WaterUsageChart usage={usage} />
            <HeatmapView usage={usage} />
          </div>

          {/* HVAC status + AI recommendations */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-grid">
            <div className="xl:col-span-1">
              <HVACPerformance efficiencyScore={summary?.efficiencyScore} hvacAnomalyActive={hvacAnomalyActive} />
            </div>
            <div className="xl:col-span-2">
              <AIRecommendationsCard recommendations={recommendations} loading={loading} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

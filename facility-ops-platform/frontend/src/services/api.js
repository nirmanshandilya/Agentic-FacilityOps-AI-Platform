import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Facilities
export const fetchFacilities = () => api.get('/facilities').then((r) => r.data);
export const createFacility = (payload) => api.post('/facilities', payload).then((r) => r.data);

// Energy Intelligence Agent
export const fetchEnergySummary = (facilityId, range = '7d') =>
  api.get(`/energy/${facilityId}/summary`, { params: { range } }).then((r) => r.data);

export const fetchEnergyUsage = (facilityId, range = '7d') =>
  api.get(`/energy/${facilityId}/usage`, { params: { range } }).then((r) => r.data);

export const fetchAnomalies = (facilityId) => api.get(`/energy/${facilityId}/anomalies`).then((r) => r.data);

export const fetchForecast = (facilityId) => api.get(`/energy/${facilityId}/forecast`).then((r) => r.data);

export const fetchRecommendations = (facilityId) =>
  api.get(`/energy/${facilityId}/recommendations`).then((r) => r.data);

export const fetchAlerts = (facilityId, status) =>
  api.get(`/energy/${facilityId}/alerts`, { params: status ? { status } : {} }).then((r) => r.data);

export const updateAlertStatus = (alertId, status) =>
  api.patch(`/energy/alerts/${alertId}`, { status }).then((r) => r.data);

export const seedFacilityData = (facilityId, days = 14) =>
  api.post(`/energy/${facilityId}/seed`, undefined, { params: { days } }).then((r) => r.data);

// Maintenance Agent
export const fetchMaintenanceSummary = (facilityId) =>
  api.get(`/maintenance/${facilityId}/summary`).then((r) => r.data);

export const fetchAssets = (facilityId, status) =>
  api.get(`/maintenance/${facilityId}/assets`, { params: status ? { status } : {} }).then((r) => r.data);

export const fetchPredictions = (facilityId) =>
  api.get(`/maintenance/${facilityId}/predictions`).then((r) => r.data);

export const fetchMaintenanceRecommendations = (facilityId) =>
  api.get(`/maintenance/${facilityId}/recommendations`).then((r) => r.data);

export const runPredictiveCycle = (facilityId) =>
  api.post(`/maintenance/${facilityId}/run-cycle`).then((r) => r.data);

export const createWorkOrder = (facilityId, assetId) =>
  api.post(`/maintenance/${facilityId}/assets/${assetId}/work-order`).then((r) => r.data);

export const fetchWorkOrders = (facilityId, status) =>
  api.get(`/maintenance/${facilityId}/work-orders`, { params: status ? { status } : {} }).then((r) => r.data);

export const updateWorkOrderStatus = (maintenanceId, status) =>
  api.patch(`/maintenance/work-orders/${maintenanceId}`, { status }).then((r) => r.data);

export const seedMaintenanceData = (facilityId, count = 10) =>
  api.post(`/maintenance/${facilityId}/seed`, undefined, { params: { count } }).then((r) => r.data);

export default api;

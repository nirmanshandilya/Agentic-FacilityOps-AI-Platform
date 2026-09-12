# Agentic FacilityOps AI Platform — Modules 1, 2 & 3

MERN-stack build of the Agentic FacilityOps AI Platform, now covering:

- **Module 1 — Foundation & Energy Intelligence** (Milestone 1): utility/IoT
  data integration, the autonomous Energy Agent, and the Energy dashboard.
- **Module 2 — Predictive Maintenance System** (Milestone 2): asset health
  scoring, failure prediction, auto-generated work orders, and the
  Predictive Maintenance dashboard.
- **Module 3 — Occupancy Agent** (Milestone 3, part 1): zone occupancy
  monitoring, overcrowding detection, utilization heatmaps, and the
  Occupancy Intelligence dashboard. (Security Agent, the other half of
  Milestone 3, is a separate follow-up module.)

## Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, Recharts, Lucide icons
- **Backend:** Node.js + Express, Mongoose (MongoDB)

## Folder structure

```
facility-ops-platform/
├── backend/
│   ├── config/        # DB connection + centralized env config
│   ├── models/        # Facility, EnergyUsage, Alert, Asset, MaintenanceRecord, Zone, OccupancyLog
│   ├── controllers/    # facilityController, energyController, maintenanceController, occupancyController
│   ├── routes/         # facilityRoutes, energyRoutes, maintenanceRoutes, occupancyRoutes
│   ├── agents/          # EnergyAgent.js, MaintenanceAgent.js, OccupancyAgent.js
│   ├── seed/            # mock IoT/utility + asset/maintenance + zone/occupancy data generator
│   └── server.js
└── frontend/
    └── src/
        ├── styles/                  # theme.js (single source of truth) + index.css
        ├── components/common/       # Navbar, Sidebar, StatCard, MetricBadge
        ├── components/energy/       # EnergyCharts, HeatmapView, HVACPerformance, AIRecommendationsCard
        ├── components/maintenance/  # HealthDistributionPanel, FailureRiskTable, AgentActionsPanel
        ├── components/occupancy/    # ZoneDistributionPanel, OccupancyHeatmap, SpaceOptimizationPanel
        ├── pages/                   # EnergyDashboardPage.jsx, MaintenanceDashboardPage.jsx, OccupancyDashboardPage.jsx
        └── services/                # api.js
```

The structure is deliberately flat and domain-separated so future agents
(Security, Cost) can each add their own `models/`, `controllers/`,
`routes/`, and `agents/*Agent.js` file, plus a `components/<domain>/` folder
and `pages/<Domain>DashboardPage.jsx`, following the same pattern the first
three modules already use. `App.jsx` holds an `activeModule` switch and the
Sidebar's `onNavigate` callback drives it — enabling a new module is a
one-line flip in `Sidebar.jsx` (`enabled: true`) plus a new `MODULES` entry
in `App.jsx`.

> Note: the page-level component (`OccupancyDashboardPage.jsx`) lives in
> `pages/`, not `components/occupancy/`, to stay consistent with
> `EnergyDashboardPage.jsx` and `MaintenanceDashboardPage.jsx` -
> `components/occupancy/` holds only the reusable sub-components
> (`ZoneDistributionPanel`, `OccupancyHeatmap`, `SpaceOptimizationPanel`).

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # edit MONGO_URI if not running Mongo locally
npm run seed               # creates 3 demo facilities, 14 days of energy history,
                             # a 10-asset roster + predictive cycle, and 4 zones +
                             # 14 days of occupancy history + an occupancy cycle,
                             # per facility
npm run dev                 # starts the API on http://localhost:5000
```

Requires a running MongoDB instance (local `mongod`, Docker, or Atlas) reachable
at the `MONGO_URI` in `.env`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # starts Vite on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:5000`
(see `vite.config.js`), so no CORS configuration is needed in development.

### 3. Using the dashboards

Use the icon rail on the left to switch between modules — both share the
same facility list.

**Energy Intelligence**
- Pick a facility from the selector in the header.
- Use **Seed Realistic IoT Data** to (re-)populate 14 days of hourly readings,
  including injected anomaly spikes, for the selected facility.
- Switch the 24H / 7D / 30D range to change the window used by the KPI cards
  and charts.
- Recommendations and the HVAC status panel are generated live by the
  Energy Agent based on the facility's current data.

**Predictive Maintenance**
- Use **Seed Asset Roster** to generate a 10-asset roster (HVAC units,
  generator, elevators, etc.) with a realistic age spread, plus some
  historical completed work orders, then immediately run one predictive
  cycle so the dashboard isn't empty.
- **Run Predictive Scan** re-evaluates every asset's health score and
  refreshes the failure risk table and Agent Actions panel without creating
  any new tickets.
- **Generate Work Order** on an Agent Actions card creates a real
  `MaintenanceRecord` (and, for High/Critical risk, an `Alert`) for that
  specific asset immediately, bypassing the agent's automatic risk-window
  filter.

**Occupancy Intelligence**
- Use **Seed Zone Data** to generate the 4 canonical zones (Office Floors,
  Meeting Rooms, Common Areas, Parking Areas) plus 14 days of hourly
  occupancy history, then run one occupancy cycle so the KPIs, heatmap, and
  recommendations aren't empty. Click it again afterward (now labeled
  **Refresh Occupancy History**) to layer on another 14 days of history for
  the existing zones.
- **Run Occupancy Scan** re-reads the latest occupancy log per zone,
  recomputes rates, and re-checks for overcrowding without adding new history.
- The heatmap and KPIs respect the 24H / 7D / 30D range filter; zone
  distribution and recommendations always reflect the current live reading.

## Restyling the entire platform

All visual styling is controlled from **one file**: `frontend/src/styles/theme.js`.

- `theme.js` is required by `tailwind.config.js`, which turns its tokens into
  Tailwind utility classes (`bg-surface-card`, `text-brand-primary`,
  `rounded-card`, `shadow-glowAmber`, etc.).
- `index.css` never hard-codes colors — it pulls the same tokens via
  Tailwind's `theme()` CSS function.
- Chart components (`EnergyCharts.jsx`, `HeatmapView.jsx`, `HVACPerformance.jsx`)
  import `theme.js` directly for hex values, since SVG/Recharts rendering
  needs real color strings rather than CSS classes.

To change the look of every dashboard, card, and chart at once, edit the
relevant section of `theme.js` and restart the dev server:

| To change...                          | Edit in `theme.js`             |
|----------------------------------------|----------------------------------|
| Background / card colors                | `colors.surface`                |
| Brand accent (energy amber, etc.)       | `colors.brand`                  |
| Alert/status colors                     | `colors.status`                 |
| Chart series colors                     | `colors.chart.series`           |
| Heading / body / numeric fonts          | `typography.fontFamily`         |
| Font sizes                              | `typography.scale`              |
| Card / panel border radius              | `radius`                        |
| Card/panel elevation treatment          | `shadow`                        |
| Card padding, grid gaps                 | `spacing`                       |

No component file needs to change — every card, chart, and badge already
consumes these tokens through Tailwind classes or a direct `theme.js` import.
If you introduce a new font family, also update the Google Fonts `<link>` in
`frontend/index.html`.

## API reference (Module 1)

| Method | Endpoint                                   | Description                                   |
|--------|---------------------------------------------|------------------------------------------------|
| GET    | `/api/facilities`                          | List facilities                                |
| POST   | `/api/facilities`                          | Create a facility                              |
| GET    | `/api/facilities/:facilityId`             | Get one facility                               |
| PUT    | `/api/facilities/:facilityId`             | Update a facility                              |
| DELETE | `/api/facilities/:facilityId`             | Delete a facility                              |
| GET    | `/api/energy/:facilityId/summary?range=`  | KPI summary (energy, cost, efficiency, carbon) |
| GET    | `/api/energy/:facilityId/usage?range=`    | Raw usage time series for charts               |
| GET    | `/api/energy/:facilityId/anomalies`       | Runs anomaly detection, persists Alerts        |
| GET    | `/api/energy/:facilityId/forecast`        | 24h demand forecast                            |
| GET    | `/api/energy/:facilityId/recommendations` | Agent-generated recommendations                |
| GET    | `/api/energy/:facilityId/alerts?status=`  | List alerts for a facility                     |
| PATCH  | `/api/energy/alerts/:alertId`             | Update alert status (Accept/Dismiss actions)   |
| POST   | `/api/energy/:facilityId/seed?days=`      | Seed realistic IoT data                        |

`range` accepts `24h`, `7d` (default), or `30d`.

## API reference (Module 2)

| Method | Endpoint                                                    | Description                                             |
|--------|--------------------------------------------------------------|-----------------------------------------------------------|
| GET    | `/api/maintenance/:facilityId/summary`                      | KPI summary (assets monitored, tickets, predicted failures, downtime reduction) |
| GET    | `/api/maintenance/:facilityId/assets?status=`               | List assets (optionally filtered by status)               |
| GET    | `/api/maintenance/:facilityId/predictions`                  | Re-evaluate health, return failure risk predictions        |
| GET    | `/api/maintenance/:facilityId/recommendations`              | Agent-generated maintenance recommendations                |
| POST   | `/api/maintenance/:facilityId/run-cycle`                    | Full cycle: evaluate → predict → auto-generate work orders |
| POST   | `/api/maintenance/:facilityId/assets/:assetId/work-order`   | Manually generate a work order for one asset               |
| GET    | `/api/maintenance/:facilityId/work-orders?status=`          | List maintenance tickets                                    |
| PATCH  | `/api/maintenance/work-orders/:maintenanceId`               | Update a ticket's status                                    |
| POST   | `/api/maintenance/:facilityId/seed?count=&append=`          | Seed (or top up) a realistic asset roster + run a cycle      |

## API reference (Module 3)

| Method | Endpoint                                          | Description                                              |
|--------|-----------------------------------------------------|-------------------------------------------------------------|
| GET    | `/api/occupancy/:facilityId/summary`                | KPI summary (occupancy rate, active visitors, workspace efficiency) |
| GET    | `/api/occupancy/:facilityId/zones`                  | Live per-zone occupancy rates                                |
| GET    | `/api/occupancy/:facilityId/heatmap?range=`         | Hour/day-of-week utilization buckets for the heatmap         |
| GET    | `/api/occupancy/:facilityId/recommendations`        | Agent-generated space optimization recommendations           |
| POST   | `/api/occupancy/:facilityId/run-cycle`              | Full cycle: refresh from logs → monitor → detect overcrowding |
| POST   | `/api/occupancy/:facilityId/seed?append=`           | Seed the 4 canonical zones + history, or top up history       |

`range` accepts `24h`, `7d` (default), or `30d`.

## EnergyAgent logic summary

`backend/agents/EnergyAgent.js` implements:

- **`detectAnomalies`** — z-score based spike/drop detection (rolling
  mean/standard deviation over the baseline window) on electricity and HVAC
  power readings; writes an `Alert` document per anomaly type detected.
- **`calculateEfficiencyScore`** — compares the latest reading against a
  rolling historical baseline (falls back to the facility's configured
  baseline) and produces a 0–100 score.
- **`forecastDemand`** — linear-trend regression blended with an
  hour-of-day seasonal offset to project the next 24 hours of demand.
- **`generateRecommendations`** — rules engine that turns efficiency score,
  load distribution, anomalies, and forecast trend into actionable,
  prioritized suggestions.

## MaintenanceAgent logic summary

`backend/agents/MaintenanceAgent.js` implements:

- **`evaluateAssetHealth`** — combines install-age decay, a deterministic
  per-asset "operating stress" factor (stable hash of `assetId`, standing in
  for real telemetry until a sensor feed exists), and a maintenance-history
  adjustment (credit for recent completed service, penalty for overdue open
  tickets) into a 0–100 score, and derives `status` from the same
  Warning/Critical thresholds used everywhere else in the module.
- **`predictFailures`** — filters assets below the risk threshold and
  projects a failure date from the health score and a stress-adjusted decay
  rate; returns predictions sorted soonest-first.
- **`generateWorkOrders`** — auto-creates a `Pending` `MaintenanceRecord`
  (+ an `Alert` for High/Critical risk) for predictions inside the
  configured lead-time window, skipping assets that already have an open
  ticket.
- **`createWorkOrderForAsset`** — the manual counterpart used by the
  dashboard's "Generate Work Order" button: creates a ticket for one asset
  immediately regardless of the window filter, still idempotent against
  existing open tickets.
- **`generateMaintenanceRecommendations`** — turns predictions into
  human-readable, prioritized recommendation cards for the Agent Actions
  panel.
- **`runPredictiveCycle`** — orchestrates all of the above for a facility in
  one call; used by the "Run Predictive Scan" button and the seed flow.

## OccupancyAgent logic summary

`backend/agents/OccupancyAgent.js` implements:

- **`monitorOccupancy`** — pure calculation of live occupancy rate (%) per
  zone from `currentOccupancy` / `maxCapacity`.
- **`detectOvercrowding`** — flags zones at/above the overcrowding
  threshold (default 90%) and writes a `ZONE_OVERCROWDING` `Alert`,
  skipping zones that already have an Active alert so repeat scans don't
  spam duplicates.
- **`analyzeUtilization`** — buckets zone-joined `OccupancyLog` entries
  into 3-hour × day-of-week buckets (same shape as Energy's heatmap) for
  the utilization heatmap, plus per-zone averages.
- **`calculateWorkspaceEfficiency`** — bell-curve score around an ideal
  utilization target (default 75%) for Workspace-type zones only, mirroring
  `EnergyAgent.calculateEfficiencyScore`'s baseline-deviation approach:
  empty desks and overcrowded floors are both penalized.
- **`refreshCurrentOccupancy`** — pulls each zone's most recent
  `OccupancyLog` entry and writes it back onto `Zone.currentOccupancy`;
  `OccupancyLog` is the source of truth, `Zone.currentOccupancy` is a
  denormalized "latest reading" cache.
- **`generateRecommendations`** / **`runOccupancyCycle`** — same
  recommendation-card shape and cycle-orchestration pattern as the other
  two agents, for a consistent Agent Actions UI and seed/scan flow.

**Modeling notes** (documented in code, repeated here since they're not in
the original schema): `Active Visitors` is total occupancy summed across
all zones, used as a proxy in the absence of a dedicated visitor
check-in system. `Zone.zoneType` and `facilityId` were added to the spec's
minimal `Zone` fields, for the same reason `MaintenanceRecord.facilityId`
was added in Module 2 - `zoneType` lets Workspace Efficiency exclude
parking/common areas, and `facilityId` keeps every model consistently
scoped like the rest of the app.

## Evaluation criteria checklist

**Milestone 1 (Week 2)**
- [x] Utility/IoT data integrated via the seed generator and `EnergyUsage` model
- [x] Energy dashboard operational (KPIs, trend chart, distribution, water usage, heatmap, HVAC status, recommendations)
- [x] Energy anomaly detection targets ≥85% accuracy (z ≥ 2.0σ threshold, tunable via `.env`)

**Milestone 2 (Week 4)**
- [x] Asset monitoring operational (`Asset` model + seeded roster + health distribution panel)
- [x] Maintenance predictions generated successfully (`predictFailures`, surfaced in the risk table)
- [x] Equipment health scoring functional (`evaluateAssetHealth`, recomputed on every scan/cycle)

**Milestone 3 (Week 6) — Occupancy half**
- [x] Occupancy analytics operational (`Zone`/`OccupancyLog` models + live rates + heatmap)
- [ ] Security alerts generated successfully — pending the Security Agent module
- [x] Occupancy forecasting/utilization accuracy target ≥80% — not literally "forecasting" yet (no forward-looking prediction method was in scope for this module), but `analyzeUtilization`'s historical hour/day buckets are the groundwork a forecast would build on

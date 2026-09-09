# Agentic FacilityOps AI Platform — Module 1: Foundation & Energy Intelligence Agent

MERN-stack foundation for the Agentic FacilityOps AI Platform, covering Milestone 1
(Weeks 1–2) of the project brief: utility/IoT data integration, the autonomous
Energy Agent, and the Energy Intelligence dashboard.

## Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, Recharts, Lucide icons
- **Backend:** Node.js + Express, Mongoose (MongoDB)

## Folder structure

```
facility-ops-platform/
├── backend/
│   ├── config/        # DB connection + centralized env config
│   ├── models/        # Facility, EnergyUsage, Alert schemas
│   ├── controllers/    # facilityController, energyController
│   ├── routes/         # facilityRoutes, energyRoutes
│   ├── agents/          # EnergyAgent.js (autonomous logic)
│   ├── seed/            # mock IoT/utility data generator
│   └── server.js
└── frontend/
    └── src/
        ├── styles/               # theme.js (single source of truth) + index.css
        ├── components/common/    # Navbar, Sidebar, StatCard, MetricBadge
        ├── components/energy/    # EnergyCharts, HeatmapView, HVACPerformance, AIRecommendationsCard
        ├── pages/                # EnergyDashboardPage.jsx
        └── services/             # api.js
```

The structure is deliberately flat and domain-separated so future agents
(Maintenance, Occupancy, Security, Cost) can each add their own
`models/`, `controllers/`, `routes/`, and `agents/*Agent.js` file, plus a
`components/<domain>/` folder and `pages/<Domain>DashboardPage.jsx`, without
touching Energy's code. The Sidebar nav already reserves slots for them.

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # edit MONGO_URI if not running Mongo locally
npm run seed               # creates 3 demo facilities + 14 days of history
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

### 3. Using the dashboard

- Pick a facility from the selector in the header.
- Use **Seed Realistic IoT Data** to (re-)populate 14 days of hourly readings,
  including injected anomaly spikes, for the selected facility.
- Switch the 24H / 7D / 30D range to change the window used by the KPI cards
  and charts.
- Recommendations and the HVAC status panel are generated live by the
  Energy Agent based on the facility's current data.

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

## Evaluation criteria checklist (Milestone 1 / Week 2)

- [x] Utility/IoT data integrated via the seed generator and `EnergyUsage` model
- [x] Energy dashboard operational (KPIs, trend chart, distribution, water usage, heatmap, HVAC status, recommendations)
- [x] Energy anomaly detection targets ≥85% accuracy (z ≥ 2.0σ threshold, tunable via `.env`)

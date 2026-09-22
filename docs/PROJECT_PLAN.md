# Agentic FacilityOps AI Platform — Project Plan

Reference: `Agentic_AI_for_Smart_Facility_Operations_and_Optimization.pdf` (Infosys Springboard 7.0)

Stack: Python (venv + pip) · FastAPI · Streamlit · SQLAlchemy · SQLite (→ PostgreSQL in M4) · scikit-learn / Prophet

---

## Repo layout
```
agentic-facilityops-ai/
├── .venv/                  # gitignored
├── data/
│   ├── raw/                # generated/ingested CSVs
│   └── processed/          # cleaned, feature-engineered data
├── notebooks/               # exploration only — logic graduates into src/
├── src/
│   ├── agents/              # one module per agent (energy_agent.py, maintenance_agent.py, ...)
│   ├── api/                 # FastAPI app, one router per agent
│   ├── dashboards/          # one Streamlit page per dashboard
│   ├── db/                  # SQLAlchemy models + session/engine
│   └── common/              # shared utils (config, logging, schemas)
├── scripts/                 # one-off scripts (data generation, seeding, migration)
├── tests/
└── docs/
    └── PROJECT_PLAN.md      # this file
```

## Milestone 1 (Weeks 1–2) — Energy Intelligence & Monitoring
**Week 1**
- Days 1–2: scaffold repo, venv, git, DB models for `FACILITIES` + `ENERGY_USAGE`
- Days 3–4: synthetic energy/utility/IoT data (`scripts/generate_energy_data.py`)
- Days 5–7: EDA notebook — consumption patterns, HVAC load, wastage signatures

**Week 2**
- Days 1–3: Energy Agent — anomaly detection (Isolation Forest) + demand forecasting (Prophet)
- Days 4–5: FastAPI endpoints (`/energy/summary`, `/energy/anomalies`, `/energy/forecast`)
- Days 6–7: Streamlit Energy Dashboard (Total Energy, Cost Savings, Efficiency Score, Carbon Reduction, HVAC/Lighting/Equipment split — matches PDF mockup)

**Evaluation gate (PDF §6):** utility data integrated · dashboard operational · anomaly detection accuracy ≥ 85%

---

## Milestone 2 (Weeks 3–4) — Predictive Maintenance System
- Build Maintenance Agent, integrate asset monitoring data
- Equipment health scoring (rule-based + ML classifier)
- Maintenance schedule prediction, alert generation
- **Gate:** asset monitoring operational · maintenance predictions generated · health scoring functional

## Milestone 3 (Weeks 5–6) — Occupancy & Security Intelligence
- Build Occupancy Agent + Security Agent
- Occupancy analytics, heatmaps, access monitoring workflows
- **Gate:** security alerts generated · occupancy forecasting accuracy ≥ 80%

## Milestone 4 (Weeks 7–8) — Cost Optimization & Enterprise Deployment
- Build Cost Optimization Agent
- Executive dashboards, cross-agent orchestration (Facility Intelligence Engine)
- Migrate SQLite → PostgreSQL
- Deploy production-ready platform
- **Gate:** cost recommendations generated · executive dashboards operational · end-to-end system deployed

---

## Conventions
- Every agent exposes a plain Python class with a `run()` method returning a dict — this becomes the FastAPI response body directly.
- Ground-truth/label columns used only for internal accuracy validation (e.g. `is_anomaly` in synthetic data) are never fed to the model as a feature — drop them before training.
- Each milestone gets its own notebook in `notebooks/` for exploration, but production logic lives in `src/agents/`.

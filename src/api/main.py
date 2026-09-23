"""
FastAPI app -- Milestone 1 (Energy Agent only for now; more routers get
added here as Maintenance/Occupancy/Security/Cost agents come online).

Run:
    uvicorn src.api.main:app --reload --port 8000

Then:
    http://127.0.0.1:8000/docs   <- interactive API docs (auto-generated)
    http://127.0.0.1:8000/energy/summary
"""

from functools import lru_cache
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.agents.energy_agent import EnergyAgent

app = FastAPI(title="Agentic FacilityOps AI Platform", version="0.1.0")

# Streamlit runs on a different port -- CORS needed so the dashboard can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for local dev; tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_energy_agent() -> EnergyAgent:
    """Fit once, cache in memory. Retraining on every request would be slow
    and pointless for a demo -- restart the server to pick up new data."""
    agent = EnergyAgent()
    agent.fit()
    return agent


@app.get("/")
def root():
    return {"status": "ok", "message": "Agentic FacilityOps AI Platform API"}


@app.get("/energy/summary")
def energy_summary():
    try:
        agent = get_energy_agent()
        return agent.run()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/energy/anomalies")
def energy_anomalies(limit: int = 20):
    agent = get_energy_agent()
    result = agent.run()
    return {"anomalies": result["recent_anomalies"][:limit]}


@app.get("/energy/forecast/{facility_id}")
def energy_forecast(facility_id: int):
    agent = get_energy_agent()
    result = agent.run()
    forecast = result["forecast_next_24h"].get(facility_id)
    if forecast is None:
        raise HTTPException(status_code=404, detail=f"No forecast for facility_id={facility_id}")
    return {"facility_id": facility_id, "forecast": forecast}

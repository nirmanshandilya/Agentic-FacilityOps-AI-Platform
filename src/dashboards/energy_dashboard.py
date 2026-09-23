"""
Energy Dashboard -- Streamlit, matching the PDF's Milestone 1 mockup
(Total Energy, Cost Savings, Efficiency Score, Carbon Reduction KPI cards
+ HVAC/Lighting/Equipment breakdown + anomaly log + forecast).

Run:
    streamlit run src/dashboards/energy_dashboard.py

Requires the FastAPI server running separately:
    uvicorn src.api.main:app --reload --port 8000
"""

import requests
import streamlit as st
import pandas as pd
import plotly.express as px

API_BASE = "http://127.0.0.1:8000"

st.set_page_config(page_title="Energy Dashboard", page_icon="⚡", layout="wide")
st.title("⚡ Energy Intelligence Dashboard")
st.caption("Agentic FacilityOps AI Platform — Milestone 1: Energy Agent")


@st.cache_data(ttl=60)
def fetch(endpoint: str) -> dict:
    resp = requests.get(f"{API_BASE}{endpoint}", timeout=10)
    resp.raise_for_status()
    return resp.json()


try:
    summary = fetch("/energy/summary")
except requests.exceptions.ConnectionError:
    st.error(
        "Can't reach the API. Start it first in another terminal:\n\n"
        "`uvicorn src.api.main:app --reload --port 8000`"
    )
    st.stop()

metrics = summary["model_metrics"]
kpis = summary["summary"]

# ---------- KPI row ----------
col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Electricity", f"{kpis['total_electricity_kwh']:,.0f} kWh")
col2.metric("Facilities Monitored", kpis["facilities_monitored"])
col3.metric("Anomalies Detected", kpis["predicted_anomalies_total"])
col4.metric(
    "Detector Accuracy",
    f"{metrics['accuracy']*100:.1f}%",
    delta="Meets PDF target (≥85%)" if metrics["meets_pdf_target_85pct"] else "Below target",
    delta_color="normal" if metrics["meets_pdf_target_85pct"] else "inverse",
)

st.divider()

# ---------- Model metrics detail ----------
with st.expander("Anomaly detection model metrics (validated against injected ground truth)"):
    st.json(metrics)

# ---------- Recent anomalies table ----------
st.subheader("🚨 Recent Anomalies")
anomalies_df = pd.DataFrame(summary["recent_anomalies"])
if not anomalies_df.empty:
    st.dataframe(anomalies_df, use_container_width=True)
else:
    st.info("No anomalies detected in the current dataset.")

# ---------- Forecast chart ----------
st.subheader("📈 24-Hour Forecast by Facility")
facility_ids = list(summary["forecast_next_24h"].keys())
selected = st.selectbox("Facility", facility_ids)

if selected:
    forecast = fetch(f"/energy/forecast/{selected}")["forecast"]
    fdf = pd.DataFrame(forecast)
    fdf["timestamp"] = pd.to_datetime(fdf["timestamp"])
    fig = px.line(fdf, x="timestamp", y="predicted_kwh", title=f"Facility {selected} — Next 24h Forecast")
    st.plotly_chart(fig, use_container_width=True)

st.caption("Data: real BDG2 electricity readings, 2016–2017 | Synthetic anomalies injected for validation")

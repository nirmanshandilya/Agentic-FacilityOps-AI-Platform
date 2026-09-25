"""
Executive Dashboard -- Streamlit. Milestone 4 capstone view.
Run: streamlit run src/dashboards/executive_dashboard.py
Requires: uvicorn src.api.main:app --reload --port 8000
"""

import requests
import streamlit as st
import pandas as pd
import plotly.express as px

API_BASE = "http://127.0.0.1:8000"

st.set_page_config(page_title="Executive Dashboard", page_icon="🏢", layout="wide")
st.title("🏢 Facility Intelligence — Executive Dashboard")
st.caption("Agentic FacilityOps AI Platform — Milestone 4: Cost Optimization + Cross-Agent Orchestration")


@st.cache_data(ttl=60)
def fetch(endpoint: str) -> dict:
    resp = requests.get(f"{API_BASE}{endpoint}", timeout=15)
    resp.raise_for_status()
    return resp.json()


try:
    data = fetch("/executive/summary")
except requests.exceptions.ConnectionError:
    st.error("Can't reach the API. Start it: `uvicorn src.api.main:app --reload --port 8000`")
    st.stop()

cost = data["cost_summary"]
breakdown = data["cost_breakdown"]

# ---------- Top KPI row ----------
col1, col2, col3 = st.columns(3)
col1.metric("Portfolio Health Score", f"{data['portfolio_avg_health_score']}/100")
col2.metric("Estimated Savings", f"${cost['total_estimated_savings_usd']:,.0f}")
col3.metric("Space Opportunity", f"${cost['total_opportunity_usd']:,.0f}")

st.info(
    "💡 Dollar figures use **assumed illustrative unit costs** (electricity rate, "
    "avoided-downtime cost, etc.) — not real financial data. See the Assumptions "
    "expander below for the exact rates used.",
    icon="ℹ️",
)

st.divider()

# ---------- Facility health scores ----------
st.subheader("🏗️ Facility Health Scores")
scores_df = pd.DataFrame(data["facility_health_scores"]).T.reset_index().rename(columns={"index": "facility_id"})
if not scores_df.empty:
    col_a, col_b = st.columns([1, 1])
    with col_a:
        fig = px.bar(
            scores_df.sort_values("composite_health_score"),
            x="facility_id", y="composite_health_score",
            color="composite_health_score", color_continuous_scale="RdYlGn",
            range_color=[0, 100], labels={"composite_health_score": "Health Score"},
        )
        st.plotly_chart(fig, use_container_width=True)
    with col_b:
        st.dataframe(scores_df, use_container_width=True, hide_index=True)

st.divider()

# ---------- Cost breakdown ----------
col_c, col_d = st.columns([1, 1])
with col_c:
    st.subheader("💰 Savings Breakdown by Domain")
    bd_df = pd.DataFrame({"domain": list(breakdown.keys()), "usd": list(breakdown.values())})
    fig = px.pie(bd_df, names="domain", values="usd")
    st.plotly_chart(fig, use_container_width=True)

with col_d:
    st.subheader("📋 Prioritized Recommendations")
    for i, rec in enumerate(data["recommendations"][:6], 1):
        st.markdown(f"**{i}.** {rec}")

st.divider()

# ---------- Per-agent summary strip ----------
st.subheader("🤖 Agent Status Summary")
agent_cols = st.columns(4)
agent_names = ["energy", "maintenance", "occupancy", "security"]
icons = {"energy": "⚡", "maintenance": "🔧", "occupancy": "👥", "security": "🛡️"}
for col, name in zip(agent_cols, agent_names):
    with col:
        st.markdown(f"**{icons[name]} {name.title()} Agent**")
        st.json(data["agent_summaries"][name])

with st.expander("💵 Cost assumptions used (illustrative, not real financial data)"):
    cost_detail = fetch("/cost/summary")
    st.json(cost_detail["assumptions"])
    st.caption(cost_detail["summary"]["roi_note"])

st.caption(
    "Cross-agent orchestration by the Facility Intelligence Engine — composite score = "
    "equal-weighted average of Energy, Maintenance, Occupancy, and Security subscores per facility."
)

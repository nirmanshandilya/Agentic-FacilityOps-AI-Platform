"""
Cost Optimization Agent (Milestone 4)

Matches the PDF spec (section 4.5): analyze operational expenditure,
identify cost-saving opportunities, generate ROI reports.

IMPORTANT -- read before presenting this: there is no real financial/
vendor dataset in this project. Every dollar figure below is derived
from ASSUMED_UNIT_COSTS, clearly separated at the top of this file so
they're easy to point to and explain as illustrative assumptions, not
real budget data. The *logic* connecting agent outputs to cost impact
is real; the *rates* are placeholders you'd replace with a facility's
actual utility rates / labor costs / incident cost data in production.

Usage:
    from src.agents.cost_agent import CostAgent
    agent = CostAgent()
    summary = agent.run()
"""

from src.agents.energy_agent import EnergyAgent
from src.agents.maintenance_agent import MaintenanceAgent
from src.agents.occupancy_agent import OccupancyAgent
from src.agents.security_agent import SecurityAgent

# ---------------------------------------------------------------
# ASSUMED UNIT COSTS -- illustrative only, not real financial data.
# Swap these for a facility's actual rates in a real deployment.
# ---------------------------------------------------------------
ASSUMED_UNIT_COSTS = {
    "electricity_usd_per_kwh": 0.14,          # avg US commercial rate, ballpark
    "avoided_downtime_usd_per_workorder": 4500,  # typical cost of unplanned HVAC/elevator failure vs. planned service
    "underutilized_space_usd_per_pct_per_facility_month": 800,  # illustrative lease/overhead opportunity cost
    "security_incident_avoided_usd": 1200,    # illustrative avg cost of an unaddressed security incident
}


class CostAgent:
    def __init__(self):
        self.energy = EnergyAgent()
        self.maintenance = MaintenanceAgent()
        self.occupancy = OccupancyAgent()
        self.security = SecurityAgent()
        self._results: dict = {}

    def run(self) -> dict:
        energy_r = self.energy.run()
        maintenance_r = self.maintenance.run()
        occupancy_r = self.occupancy.run()
        security_r = self.security.run()
        self._results = {"energy": energy_r, "maintenance": maintenance_r,
                          "occupancy": occupancy_r, "security": security_r}

        rates = ASSUMED_UNIT_COSTS

        # Energy: cost of the anomalous consumption itself (the "waste" being caught)
        anomalous_kwh_estimate = energy_r["summary"]["predicted_anomalies_total"] * 50  # ~50 kWh excess per flagged anomaly, illustrative
        energy_savings = anomalous_kwh_estimate * rates["electricity_usd_per_kwh"]

        # Maintenance: avoided downtime cost per proactively-caught work order
        maintenance_savings = maintenance_r["summary"]["work_orders_generated"] * rates["avoided_downtime_usd_per_workorder"]

        # Occupancy: opportunity cost of significantly underutilized space
        avg_occ = occupancy_r["summary"]["avg_occupancy_rate_pct"]
        underutilization_pct = max(0, 65 - avg_occ)  # illustrative target utilization of 65%, matches Facility Intelligence Engine
        occupancy_opportunity = (
            underutilization_pct * rates["underutilized_space_usd_per_pct_per_facility_month"]
            * occupancy_r["summary"]["facilities_monitored"]
        )

        # Security: cost avoided by catching incidents before escalation
        security_savings = security_r["summary"]["alerts_generated"] * rates["security_incident_avoided_usd"]

        total_savings = energy_savings + maintenance_savings + security_savings
        total_opportunity = occupancy_opportunity  # opportunity, not realized savings -- kept separate

        recommendations = []
        if energy_r["summary"]["predicted_anomalies_total"] > 0:
            recommendations.append(
                f"Investigate {energy_r['summary']['predicted_anomalies_total']} flagged energy anomalies "
                f"-- estimated ${energy_savings:,.0f}/period in avoidable waste."
            )
        if maintenance_r["summary"]["work_orders_generated"] > 0:
            recommendations.append(
                f"Action {maintenance_r['summary']['work_orders_generated']} predictive maintenance work orders "
                f"before failure -- estimated ${maintenance_savings:,.0f} in avoided unplanned downtime."
            )
        if underutilization_pct > 0:
            recommendations.append(
                f"Average occupancy is {avg_occ:.1f}%, below the {65}% target -- "
                f"${occupancy_opportunity:,.0f}/month in space consolidation opportunity."
            )
        if security_r["summary"]["alerts_generated"] > 0:
            recommendations.append(
                f"Review {security_r['summary']['alerts_generated']} security alerts -- "
                f"estimated ${security_savings:,.0f} in avoided incident cost."
            )

        return {
            "agent": "cost_optimization_agent",
            "assumptions": ASSUMED_UNIT_COSTS,
            "summary": {
                "total_estimated_savings_usd": round(total_savings, 2),
                "total_opportunity_usd": round(total_opportunity, 2),
                "roi_note": "Estimated using assumed unit costs -- see 'assumptions' field. "
                            "Replace with real utility/labor/incident rates for production use.",
            },
            "breakdown": {
                "energy_savings_usd": round(energy_savings, 2),
                "maintenance_savings_usd": round(maintenance_savings, 2),
                "occupancy_opportunity_usd": round(occupancy_opportunity, 2),
                "security_savings_usd": round(security_savings, 2),
            },
            "recommendations": recommendations,
        }

    def get_agent_results(self) -> dict:
        """Exposes the underlying per-agent run() outputs, so the Facility
        Intelligence Engine doesn't have to re-instantiate/re-fit every agent."""
        if not self._results:
            self.run()
        return self._results


if __name__ == "__main__":
    agent = CostAgent()
    result = agent.run()
    print("Breakdown:", result["breakdown"])
    print("Summary:", result["summary"])
    print("\nRecommendations:")
    for r in result["recommendations"]:
        print(f"  - {r}")

"""
Facility Intelligence Engine (Milestone 4)

Matches the PDF spec (section 4.6): aggregate insights from all agents,
generate facility health scores, support decision-making through
AI recommendations. This is the cross-agent orchestration layer the
Executive Dashboard reads from.

Composite Facility Health Score (0-100) = average of 4 per-domain
subscores, computed per facility_id:
  - energy_score:      100, minus a penalty scaled by that facility's
                        anomaly rate
  - maintenance_score:  average asset health score for that facility
  - occupancy_score:    penalizes occupancy far from a healthy ~65%
                        utilization target (too low = wasted space,
                        too high = overcrowding risk)
  - security_score:     100, minus a penalty scaled by that facility's
                        alert rate

This weighting (equal 25% each) is a reasonable default, not a
PDF-mandated formula -- worth saying so if asked in the demo.

Usage:
    from src.agents.facility_intelligence_engine import FacilityIntelligenceEngine
    engine = FacilityIntelligenceEngine()
    summary = engine.run()
"""

import numpy as np
from src.agents.cost_agent import CostAgent


class FacilityIntelligenceEngine:
    def __init__(self):
        self.cost_agent = CostAgent()

    def run(self) -> dict:
        cost_result = self.cost_agent.run()
        agents = self.cost_agent.get_agent_results()

        energy_df = self.cost_agent.energy.df
        maint_readings = self.cost_agent.maintenance.readings
        assets = self.cost_agent.maintenance.assets
        occ_df = self.cost_agent.occupancy.df
        sec_df = self.cost_agent.security.df

        facility_ids = sorted(set(energy_df["facility_id"]).union(assets["facility_id"]))
        facility_scores = {}

        for fid in facility_ids:
            # Energy subscore: penalize by this facility's anomaly rate
            fac_energy = energy_df[energy_df["facility_id"] == fid]
            energy_anomaly_rate = fac_energy["predicted_anomaly"].mean() if len(fac_energy) else 0
            energy_score = max(0, 100 - energy_anomaly_rate * 100 * 3)  # 3x penalty multiplier

            # Maintenance subscore: latest reading per asset in this facility
            fac_asset_ids = assets[assets["facility_id"] == fid]["asset_id"]
            fac_readings = maint_readings[maint_readings["asset_id"].isin(fac_asset_ids)]
            if len(fac_readings) and "failure_risk" in fac_readings.columns:
                latest = fac_readings.sort_values("date").groupby("asset_id").tail(1)
                maintenance_score = float((1 - latest["failure_risk"]).mean() * 100)
            else:
                maintenance_score = 100.0

            # Occupancy subscore: distance from healthy ~65% utilization target
            fac_occ = occ_df[occ_df["facility_id"] == fid]
            avg_occ_pct = fac_occ["occupancy_rate"].mean() * 100 if len(fac_occ) else 65
            occupancy_score = max(0, 100 - abs(avg_occ_pct - 65) * 2)

            # Security subscore: penalize by this facility's alert rate
            fac_sec = sec_df[sec_df["facility_id"] == fid]
            sec_alert_rate = fac_sec["predicted_anomaly"].mean() if len(fac_sec) else 0
            security_score = max(0, 100 - sec_alert_rate * 100 * 3)

            composite = np.mean([energy_score, maintenance_score, occupancy_score, security_score])

            facility_scores[int(fid)] = {
                "composite_health_score": round(float(composite), 1),
                "energy_score": round(float(energy_score), 1),
                "maintenance_score": round(float(maintenance_score), 1),
                "occupancy_score": round(float(occupancy_score), 1),
                "security_score": round(float(security_score), 1),
            }

        ranked = sorted(facility_scores.items(), key=lambda kv: kv[1]["composite_health_score"])
        lowest_facility = ranked[0] if ranked else None

        overall_recommendations = list(cost_result["recommendations"])
        if lowest_facility:
            fid, scores = lowest_facility
            overall_recommendations.insert(
                0,
                f"Facility {fid} has the lowest composite health score ({scores['composite_health_score']}/100) "
                f"-- prioritize review across its lowest-scoring domain."
            )

        return {
            "engine": "facility_intelligence_engine",
            "facility_health_scores": facility_scores,
            "portfolio_avg_health_score": round(
                float(np.mean([s["composite_health_score"] for s in facility_scores.values()])), 1
            ) if facility_scores else None,
            "cost_summary": cost_result["summary"],
            "cost_breakdown": cost_result["breakdown"],
            "agent_summaries": {
                "energy": agents["energy"]["summary"],
                "maintenance": agents["maintenance"]["summary"],
                "occupancy": agents["occupancy"]["summary"],
                "security": agents["security"]["summary"],
            },
            "recommendations": overall_recommendations,
        }


if __name__ == "__main__":
    engine = FacilityIntelligenceEngine()
    result = engine.run()
    print("Portfolio avg health score:", result["portfolio_avg_health_score"])
    print("\nPer-facility scores:")
    for fid, scores in result["facility_health_scores"].items():
        print(f"  Facility {fid}: {scores}")
    print("\nTop recommendations:")
    for r in result["recommendations"][:5]:
        print(f"  - {r}")

"""
Occupancy Agent (Milestone 3)

Two responsibilities, matching the PDF spec (section 4.3):
  - Space utilization analytics: occupancy rate per zone/facility.
  - Forecasting: next-day occupancy per zone, validated with a
    tolerance-based "accuracy" metric (% of forecasts within 15% of
    actual capacity-normalized occupancy) against the PDF's >=80% target.
    Plain classification accuracy doesn't apply to a continuous
    forecast, so this tolerance-band definition is the standard
    substitute -- worth mentioning explicitly if asked in the demo.

Usage:
    from src.agents.occupancy_agent import OccupancyAgent
    agent = OccupancyAgent()
    agent.fit()
    summary = agent.run()
"""

from pathlib import Path
import pandas as pd
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"
TOLERANCE = 0.15  # forecast counts as "accurate" if within 15% of capacity


class OccupancyAgent:
    def __init__(self):
        self.df: pd.DataFrame | None = None
        self.metrics: dict = {}

    def load_data(self):
        self.df = pd.read_csv(DATA_DIR / "occupancy_records.csv", parse_dates=["timestamp"])
        self.df["occupancy_rate"] = self.df["occupancy_count"] / self.df["capacity"]
        self.df["hour"] = self.df["timestamp"].dt.hour
        self.df["weekday"] = self.df["timestamp"].dt.weekday
        return self

    def fit(self) -> "OccupancyAgent":
        if self.df is None:
            self.load_data()

        split_ts = self.df["timestamp"].quantile(0.75)
        train = self.df[self.df["timestamp"] <= split_ts]
        test = self.df[self.df["timestamp"] > split_ts].copy()

        profile = train.groupby(["facility_id", "zone", "weekday", "hour"])["occupancy_count"].mean()

        def predict_row(row):
            key = (row["facility_id"], row["zone"], row["weekday"], row["hour"])
            return profile.get(key, train["occupancy_count"].mean())

        test["predicted_count"] = test.apply(predict_row, axis=1)
        test["abs_error_pct_capacity"] = (test["predicted_count"] - test["occupancy_count"]).abs() / test["capacity"]
        test["within_tolerance"] = test["abs_error_pct_capacity"] <= TOLERANCE

        self.metrics = {
            "forecast_accuracy": round(test["within_tolerance"].mean(), 4),
            "mean_abs_error_pct_capacity": round(test["abs_error_pct_capacity"].mean(), 4),
            "meets_pdf_target_80pct": bool(test["within_tolerance"].mean() >= 0.80),
            "definition": f"accuracy = % of forecasts within {int(TOLERANCE*100)}% of capacity",
        }
        self._profile = profile
        return self

    def run(self) -> dict:
        if self.df is None:
            self.fit()
        elif not hasattr(self, "_profile"):
            self.fit()

        latest_day = self.df["timestamp"].dt.date.max()
        latest = self.df[self.df["timestamp"].dt.date == latest_day]

        zone_summary = (
            latest.groupby("zone")
            .agg(avg_occupancy_rate=("occupancy_rate", "mean"), total_count=("occupancy_count", "sum"))
            .reset_index()
        )
        zone_summary["avg_occupancy_rate"] = (zone_summary["avg_occupancy_rate"] * 100).round(1)

        facility_summary = (
            latest.groupby("facility_id")["occupancy_rate"].mean().mul(100).round(1).to_dict()
        )

        return {
            "agent": "occupancy_agent",
            "model_metrics": self.metrics,
            "summary": {
                "facilities_monitored": int(self.df["facility_id"].nunique()),
                "zones_monitored": int(self.df["zone"].nunique()),
                "avg_occupancy_rate_pct": round(float(latest["occupancy_rate"].mean() * 100), 1),
            },
            "zone_distribution": zone_summary.to_dict(orient="records"),
            "facility_occupancy_pct": {str(k): v for k, v in facility_summary.items()},
        }


if __name__ == "__main__":
    agent = OccupancyAgent()
    result = agent.run()
    print("Model metrics:", result["model_metrics"])
    print("Summary:", result["summary"])
    print(f"\n{'PASSES' if result['model_metrics']['meets_pdf_target_80pct'] else 'FAILS'} "
          f"PDF's >=80% occupancy forecasting accuracy target")

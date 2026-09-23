"""
Energy Agent (Milestone 1)

Two responsibilities, matching the PDF spec (section 4.1):
  - Anomaly detection: flag electricity readings that deviate from a
    facility's own recent baseline (Isolation Forest).
  - Forecasting: short-horizon demand forecast per facility (simple
    seasonal-naive + trend model -- deliberately lightweight given the
    timeline; swap for Prophet/statsmodels later if you have time).

Usage:
    from src.agents.energy_agent import EnergyAgent
    agent = EnergyAgent()
    agent.fit()
    summary = agent.run()   # -> dict, directly JSON-serializable for FastAPI
"""

from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import accuracy_score, precision_score, recall_score

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
FEATURE_COLS = ["electricity_usage", "hour", "weekday_num", "is_weekend", "deviation_from_baseline"]


class EnergyAgent:
    def __init__(self, contamination: float = 0.015):
        # contamination matches the ~1.5% injected anomaly rate from the loader script
        self.model = IsolationForest(contamination=contamination, random_state=42, n_estimators=200)
        self.df: pd.DataFrame | None = None
        self.metrics: dict = {}

    def load_data(self) -> pd.DataFrame:
        path = DATA_DIR / "processed" / "energy_featured.csv"
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found. Run notebooks/01_energy_eda.py first -- "
                "it produces this featured dataset."
            )
        self.df = pd.read_csv(path, parse_dates=["timestamp"])
        return self.df

    def fit(self) -> "EnergyAgent":
        if self.df is None:
            self.load_data()
        X = self.df[FEATURE_COLS]
        self.model.fit(X)

        # IsolationForest: -1 = anomaly, 1 = normal -> convert to boolean matching our label
        raw_pred = self.model.predict(X)
        self.df["predicted_anomaly"] = raw_pred == -1

        # Validate against the ground-truth labels (only possible because we
        # know which anomalies were injected -- see load_bdg2_data.py)
        y_true = self.df["is_anomaly"]
        y_pred = self.df["predicted_anomaly"]
        self.metrics = {
            "accuracy": round(accuracy_score(y_true, y_pred), 4),
            "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
            "meets_pdf_target_85pct": accuracy_score(y_true, y_pred) >= 0.85,
        }
        return self

    def _forecast_facility(self, facility_df: pd.DataFrame, horizon_hours: int = 24) -> list[dict]:
        """Seasonal-naive forecast: next N hours = same hour-of-week average
        from the last 4 weeks, adjusted by the recent trend. Lightweight but
        genuinely uses real historical seasonality, not a random guess."""
        facility_df = facility_df.sort_values("timestamp")
        last_ts = facility_df["timestamp"].max()
        recent = facility_df[facility_df["timestamp"] >= last_ts - pd.Timedelta(days=28)].copy()
        recent["hour"] = recent["timestamp"].dt.hour
        recent["weekday_num"] = recent["timestamp"].dt.weekday
        hourly_profile = recent.groupby(["weekday_num", "hour"])["electricity_usage"].mean()

        # simple trend: compare last 7 days avg to prior 7 days avg
        last_7d = facility_df[facility_df["timestamp"] >= last_ts - pd.Timedelta(days=7)]["electricity_usage"].mean()
        prior_7d = facility_df[
            (facility_df["timestamp"] >= last_ts - pd.Timedelta(days=14))
            & (facility_df["timestamp"] < last_ts - pd.Timedelta(days=7))
        ]["electricity_usage"].mean()
        trend_factor = (last_7d / prior_7d) if prior_7d and prior_7d > 0 else 1.0
        trend_factor = np.clip(trend_factor, 0.8, 1.2)  # damp extreme swings

        forecast = []
        for h in range(1, horizon_hours + 1):
            ts = last_ts + pd.Timedelta(hours=h)
            key = (ts.weekday(), ts.hour)
            base = hourly_profile.get(key, recent["electricity_usage"].mean())
            forecast.append({
                "timestamp": ts.isoformat(),
                "predicted_kwh": round(float(base * trend_factor), 2),
            })
        return forecast

    def run(self) -> dict:
        if self.df is None or "predicted_anomaly" not in self.df.columns:
            self.fit()

        facilities = self.df["facility_id"].unique()
        recent_anomalies = (
            self.df[self.df["predicted_anomaly"]]
            .sort_values("timestamp", ascending=False)
            .head(10)[["facility_id", "timestamp", "electricity_usage"]]
            .assign(timestamp=lambda d: d["timestamp"].astype(str))
            .to_dict(orient="records")
        )

        total_kwh = self.df["electricity_usage"].sum()
        forecasts = {
            int(fid): self._forecast_facility(self.df[self.df["facility_id"] == fid])
            for fid in facilities
        }

        return {
            "agent": "energy_agent",
            "model_metrics": self.metrics,
            "summary": {
                "total_electricity_kwh": round(float(total_kwh), 2),
                "facilities_monitored": int(len(facilities)),
                "predicted_anomalies_total": int(self.df["predicted_anomaly"].sum()),
            },
            "recent_anomalies": recent_anomalies,
            "forecast_next_24h": forecasts,
        }


if __name__ == "__main__":
    agent = EnergyAgent()
    result = agent.run()
    print("Model metrics:", result["model_metrics"])
    print("Summary:", result["summary"])
    print(f"\n{'PASSES' if result['model_metrics']['meets_pdf_target_85pct'] else 'FAILS'} "
          f"PDF's >=85% anomaly detection accuracy target")

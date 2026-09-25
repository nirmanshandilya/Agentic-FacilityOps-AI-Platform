"""
Maintenance Agent (Milestone 2)

Two responsibilities, matching the PDF spec (section 4.2):
  - Health scoring: 0-100 score per asset from latest sensor readings.
  - Failure prediction: classifier trained on the labeled degradation
    pattern from generate_maintenance_data.py, flags assets at risk of
    failure within 14 days -> generates a maintenance work order.

Usage:
    from src.agents.maintenance_agent import MaintenanceAgent
    agent = MaintenanceAgent()
    agent.fit()
    summary = agent.run()
"""

from pathlib import Path
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"
FEATURE_COLS = ["vibration_mm_s", "temperature_c", "runtime_hours_cumulative"]


class MaintenanceAgent:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42, class_weight="balanced")
        self.assets: pd.DataFrame | None = None
        self.readings: pd.DataFrame | None = None
        self.metrics: dict = {}

    def load_data(self):
        self.assets = pd.read_csv(DATA_DIR / "assets.csv")
        self.readings = pd.read_csv(DATA_DIR / "maintenance_sensor_readings.csv", parse_dates=["date"])
        return self

    def fit(self) -> "MaintenanceAgent":
        if self.readings is None:
            self.load_data()

        X = self.readings[FEATURE_COLS]
        y = self.readings["will_fail_within_14d"]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
        self.model.fit(X_train, y_train)
        y_pred = self.model.predict(X_test)

        self.metrics = {
            "accuracy": round(accuracy_score(y_test, y_pred), 4),
            "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        }

        # score every reading for the health/risk summary (trained model, full dataset)
        self.readings["failure_risk"] = self.model.predict_proba(self.readings[FEATURE_COLS])[:, 1]
        return self

    def _health_score(self, risk: float) -> int:
        """Simple 0-100 inverse-risk score for the dashboard KPI cards."""
        return int(round((1 - risk) * 100))

    def run(self) -> dict:
        if self.readings is None or "failure_risk" not in self.readings.columns:
            self.fit()

        latest = self.readings.sort_values("date").groupby("asset_id").tail(1).copy()
        latest = latest.merge(self.assets[["asset_id", "asset_name", "asset_type", "facility_id"]],
                               on="asset_id", suffixes=("", "_meta"))
        latest["health_score"] = latest["failure_risk"].apply(self._health_score)
        latest["status"] = pd.cut(
            latest["health_score"], bins=[-1, 40, 70, 100], labels=["Critical", "Warning", "Excellent"]
        )

        work_orders = (
            latest[latest["failure_risk"] > 0.5]
            .sort_values("failure_risk", ascending=False)
            [["asset_id", "asset_name", "facility_id", "health_score", "failure_risk"]]
            .to_dict(orient="records")
        )

        health_distribution = latest["status"].value_counts().to_dict()

        return {
            "agent": "maintenance_agent",
            "model_metrics": self.metrics,
            "summary": {
                "assets_monitored": int(len(latest)),
                "work_orders_generated": len(work_orders),
                "avg_health_score": round(float(latest["health_score"].mean()), 1),
            },
            "health_distribution": {str(k): int(v) for k, v in health_distribution.items()},
            "work_orders": work_orders,
        }


if __name__ == "__main__":
    agent = MaintenanceAgent()
    result = agent.run()
    print("Model metrics:", result["model_metrics"])
    print("Summary:", result["summary"])
    print("Health distribution:", result["health_distribution"])

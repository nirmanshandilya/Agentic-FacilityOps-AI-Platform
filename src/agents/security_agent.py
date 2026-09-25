"""
Security Agent (Milestone 3)

Responsibilities, matching the PDF spec (section 4.4):
  - Monitor access control events, detect unauthorized/anomalous access
    (Isolation Forest on hour-of-day + zone + event-type encoding).
  - Generate security alerts for detected incidents.

Usage:
    from src.agents.security_agent import SecurityAgent
    agent = SecurityAgent()
    agent.fit()
    summary = agent.run()
"""

from pathlib import Path
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"


class SecurityAgent:
    def __init__(self, contamination: float = 0.015):
        self.model = IsolationForest(contamination=contamination, random_state=42, n_estimators=200)
        self.df: pd.DataFrame | None = None
        self.metrics: dict = {}
        self._zone_enc = LabelEncoder()
        self._event_enc = LabelEncoder()

    def load_data(self):
        self.df = pd.read_csv(DATA_DIR / "security_events.csv", parse_dates=["timestamp"])
        return self

    def _build_features(self) -> pd.DataFrame:
        df = self.df.copy()
        df["hour"] = df["timestamp"].dt.hour
        df["is_off_hours"] = ((df["hour"] < 6) | (df["hour"] > 20)).astype(int)
        df["zone_enc"] = self._zone_enc.fit_transform(df["zone"])
        df["event_enc"] = self._event_enc.fit_transform(df["event_type"])
        return df[["hour", "is_off_hours", "zone_enc", "event_enc"]]

    def fit(self) -> "SecurityAgent":
        if self.df is None:
            self.load_data()

        X = self._build_features()
        self.model.fit(X)
        raw_pred = self.model.predict(X)
        self.df["predicted_anomaly"] = raw_pred == -1

        y_true = self.df["is_anomaly"]
        y_pred = self.df["predicted_anomaly"]
        self.metrics = {
            "accuracy": round(accuracy_score(y_true, y_pred), 4),
            "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        }
        return self

    def run(self) -> dict:
        if self.df is None or "predicted_anomaly" not in self.df.columns:
            self.fit()

        alerts = (
            self.df[self.df["predicted_anomaly"]]
            .sort_values("timestamp", ascending=False)
            .head(15)
            .assign(timestamp=lambda d: d["timestamp"].astype(str))
            [["facility_id", "zone", "event_type", "severity", "timestamp"]]
            .to_dict(orient="records")
        )

        severity_counts = (
            self.df[self.df["predicted_anomaly"]]["severity"].value_counts().to_dict()
        )

        return {
            "agent": "security_agent",
            "model_metrics": self.metrics,
            "summary": {
                "total_events": int(len(self.df)),
                "alerts_generated": int(self.df["predicted_anomaly"].sum()),
                "facilities_monitored": int(self.df["facility_id"].nunique()),
            },
            "severity_breakdown": {str(k): int(v) for k, v in severity_counts.items()},
            "recent_alerts": alerts,
        }


if __name__ == "__main__":
    agent = SecurityAgent()
    result = agent.run()
    print("Model metrics:", result["model_metrics"])
    print("Summary:", result["summary"])

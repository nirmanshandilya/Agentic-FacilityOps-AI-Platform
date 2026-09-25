"""
Synthetic data generator — Security Agent (Milestone 3)

Produces:
    data/raw/security_events.csv -> matches SECURITY_EVENTS table, with
    an added 'is_anomaly' ground-truth column (badge cloning attempts,
    after-hours unauthorized entry, repeated denied access) for
    validating the Security Agent's incident detection -- same
    validation pattern as the Energy Agent.

Run:
    python scripts/generate_security_data.py
"""

from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(23)
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_FACILITIES = 5
DAYS = 90
START = pd.Timestamp("2026-01-01")
ZONES = ["Main Entrance", "Server Room", "Parking Gate", "Executive Floor", "Loading Dock"]
EVENT_TYPES_NORMAL = ["badge_in", "badge_out"]
EVENT_TYPES_ANOMALOUS = ["denied_access", "after_hours_entry", "tailgating_detected", "badge_anomaly"]

rows = []
event_id = 1

for facility_id in range(1, N_FACILITIES + 1):
    # normal daily badge traffic
    n_normal_events = rng.integers(150, 300) * DAYS // 30  # scale with window length
    for _ in range(n_normal_events):
        day_offset = rng.integers(0, DAYS)
        # normal access clusters around business hours
        hour = int(np.clip(rng.normal(13, 3), 6, 20))
        ts = START + pd.Timedelta(days=int(day_offset), hours=hour, minutes=int(rng.integers(0, 60)))
        rows.append({
            "event_id": event_id,
            "facility_id": facility_id,
            "zone": rng.choice(ZONES, p=[0.4, 0.1, 0.25, 0.15, 0.1]),
            "event_type": rng.choice(EVENT_TYPES_NORMAL),
            "severity": "Info",
            "timestamp": ts,
            "is_anomaly": False,
        })
        event_id += 1

    # injected anomalous events (~1.5% of total volume, same rate convention as Energy Agent)
    n_anomalies = int(n_normal_events * 0.015)
    for _ in range(n_anomalies):
        day_offset = rng.integers(0, DAYS)
        # anomalies skew toward odd hours
        hour = int(rng.choice([1, 2, 3, 4, 22, 23]))
        ts = START + pd.Timedelta(days=int(day_offset), hours=hour, minutes=int(rng.integers(0, 60)))
        event_type = rng.choice(EVENT_TYPES_ANOMALOUS)
        severity = rng.choice(["Medium", "High", "Critical"], p=[0.5, 0.35, 0.15])
        rows.append({
            "event_id": event_id,
            "facility_id": facility_id,
            "zone": rng.choice(ZONES, p=[0.2, 0.3, 0.15, 0.25, 0.1]),
            "event_type": event_type,
            "severity": severity,
            "timestamp": ts,
            "is_anomaly": True,
        })
        event_id += 1

security_df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
security_df["event_id"] = range(1, len(security_df) + 1)
security_df.to_csv(OUT_DIR / "security_events.csv", index=False)
print(f"security_events.csv -> {len(security_df)} rows "
      f"({security_df['is_anomaly'].sum()} labeled anomalous events, "
      f"{security_df['is_anomaly'].mean()*100:.2f}%)")

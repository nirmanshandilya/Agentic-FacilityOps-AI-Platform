"""
Synthetic data generator — Energy Agent (Milestone 1)

Produces two CSVs into data/raw/:
    facilities.csv    -> matches FACILITIES table in the PDF's DB schema
    energy_usage.csv  -> matches ENERGY_USAGE table, plus a hidden
                          'is_anomaly' ground-truth column (drop this
                          column before training/serving — it's only
                          here so you can measure your anomaly
                          detector's accuracy against a known answer,
                          per the PDF's Milestone 1 evaluation
                          criterion: "Energy anomaly detection
                          accuracy >= 85%").

Run:
    python scripts/generate_energy_data.py
"""

from pathlib import Path
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from faker import Faker

fake = Faker()
rng = np.random.default_rng(seed=42)

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_FACILITIES = 5
DAYS = 90                      # ~3 months of hourly data
START = datetime(2026, 1, 1)
FACILITY_TYPES = ["Corporate Office", "IT Park", "University Campus", "Hospital"]

# ---------- 1. Facilities ----------
facilities = []
for i in range(1, N_FACILITIES + 1):
    facilities.append({
        "facility_id": i,
        "facility_name": f"{fake.city()} {rng.choice(FACILITY_TYPES)}",
        "facility_type": rng.choice(FACILITY_TYPES),
        "location": fake.city(),
    })
facilities_df = pd.DataFrame(facilities)
facilities_df.to_csv(OUT_DIR / "facilities.csv", index=False)
print(f"facilities.csv -> {len(facilities_df)} rows")

# ---------- 2. Hourly energy usage per facility ----------
hours = pd.date_range(START, periods=DAYS * 24, freq="h")

rows = []
energy_id = 1
for fid in facilities_df["facility_id"]:
    # each facility gets its own baseline + noise profile so the
    # model has to learn per-facility patterns, not one global curve
    base_kw = rng.uniform(150, 400)
    hvac_share, light_share, equip_share = rng.dirichlet([4, 2, 3])

    for ts in hours:
        hour = ts.hour
        weekday = ts.weekday()  # 0=Mon .. 6=Sun
        is_weekend = weekday >= 5

        # Occupancy-driven daily curve: low at night, peak 9am-6pm
        if 8 <= hour <= 18:
            occ_factor = 1.0
        elif 6 <= hour < 8 or 18 < hour <= 21:
            occ_factor = 0.5
        else:
            occ_factor = 0.2
        if is_weekend:
            occ_factor *= 0.35  # much lower weekend baseline

        seasonal = 1.0 + 0.15 * np.sin(2 * np.pi * ts.dayofyear / 365)  # mild HVAC seasonality
        noise = rng.normal(1.0, 0.05)

        total_kw = base_kw * occ_factor * seasonal * noise

        # Inject anomalies ~1.5% of the time: equipment left running,
        # HVAC fault, or a sensor spike
        is_anomaly = rng.random() < 0.015
        if is_anomaly:
            total_kw *= rng.uniform(1.8, 3.0)

        water_usage = max(0.0, rng.normal(50 * occ_factor, 8))

        rows.append({
            "energy_id": energy_id,
            "facility_id": fid,
            "timestamp": ts,
            "electricity_usage": round(total_kw, 2),
            "water_usage": round(water_usage, 2),
            # extra columns useful for the dashboard breakdown (HVAC/Lighting/Equipment %)
            "hvac_kw": round(total_kw * hvac_share, 2),
            "lighting_kw": round(total_kw * light_share, 2),
            "equipment_kw": round(total_kw * equip_share, 2),
            "is_anomaly": is_anomaly,   # ground truth — drop before training
        })
        energy_id += 1

energy_df = pd.DataFrame(rows)
energy_df.to_csv(OUT_DIR / "energy_usage.csv", index=False)
print(f"energy_usage.csv -> {len(energy_df)} rows "
      f"({energy_df['is_anomaly'].sum()} labeled anomalies, "
      f"{energy_df['is_anomaly'].mean()*100:.2f}%)")

print("\nDone. Files written to:", OUT_DIR)

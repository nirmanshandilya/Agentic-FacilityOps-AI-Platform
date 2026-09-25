"""
Synthetic data generator — Maintenance Agent (Milestone 2)

Produces:
    data/raw/assets.csv              -> matches ASSETS table
    data/raw/maintenance_sensor_readings.csv
        Daily sensor readings (vibration, temperature, runtime_hours) per
        asset, with a simulated gradual-degradation-to-failure pattern for
        a subset of assets. 'will_fail_within_14d' is the ground-truth
        label used to validate the failure-risk classifier -- same
        validation approach as the Energy Agent's injected anomalies.

Run:
    python scripts/generate_maintenance_data.py
"""

from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_FACILITIES = 5
ASSET_TYPES = ["HVAC Unit", "Elevator", "Generator", "Chiller", "Water Pump", "Fire Alarm Panel"]
DAYS = 180
START = pd.Timestamp("2026-01-01")

# ---------- Assets ----------
assets = []
asset_id = 1
for facility_id in range(1, N_FACILITIES + 1):
    n_assets = rng.integers(4, 7)
    for _ in range(n_assets):
        assets.append({
            "asset_id": asset_id,
            "facility_id": facility_id,
            "asset_name": f"{rng.choice(ASSET_TYPES)} #{asset_id}",
            "asset_type": rng.choice(ASSET_TYPES),
            "status": "Active",
        })
        asset_id += 1
assets_df = pd.DataFrame(assets)
assets_df.to_csv(OUT_DIR / "assets.csv", index=False)
print(f"assets.csv -> {len(assets_df)} rows")

# ---------- Sensor readings with degradation-to-failure pattern ----------
# ~25% of assets get a simulated failure event partway through the window;
# in the run-up, vibration/temperature trend upward (real degradation signature)
rows = []
reading_id = 1
dates = pd.date_range(START, periods=DAYS, freq="D")

for _, asset in assets_df.iterrows():
    will_fail = rng.random() < 0.3
    # Projected failure is set just BEYOND the data window (not within it).
    # This models an asset that is currently degrading toward failure --
    # exactly the scenario predictive maintenance is supposed to catch --
    # rather than a failure that already happened and was resolved mid-window.
    # That guarantees the "latest reading" snapshot always shows genuine
    # active risk for these assets, instead of depending on the failure
    # randomly landing on the very last day.
    failure_day = DAYS + rng.integers(1, 15) if will_fail else None

    baseline_vibration = rng.uniform(2.0, 4.0)
    baseline_temp = rng.uniform(45, 60)
    runtime = 0.0

    for day_idx, date in enumerate(dates):
        runtime += rng.uniform(6, 16)  # hours run that day

        if will_fail and failure_day is not None:
            days_to_failure = failure_day - day_idx
            if 0 <= days_to_failure <= 30:
                # degradation ramps up as failure approaches
                ramp = (30 - days_to_failure) / 30
                vibration = baseline_vibration + ramp * rng.uniform(4, 8)
                temperature = baseline_temp + ramp * rng.uniform(10, 20)
            else:
                vibration = baseline_vibration + rng.normal(0, 0.3)
                temperature = baseline_temp + rng.normal(0, 2)
            label = 1 if 0 <= days_to_failure <= 14 else 0
        else:
            vibration = baseline_vibration + rng.normal(0, 0.3)
            temperature = baseline_temp + rng.normal(0, 2)
            label = 0

        rows.append({
            "reading_id": reading_id,
            "asset_id": asset["asset_id"],
            "facility_id": asset["facility_id"],
            "date": date,
            "vibration_mm_s": round(max(0, vibration), 2),
            "temperature_c": round(max(0, temperature), 2),
            "runtime_hours_cumulative": round(runtime, 1),
            "will_fail_within_14d": label,
        })
        reading_id += 1

readings_df = pd.DataFrame(rows)
readings_df.to_csv(OUT_DIR / "maintenance_sensor_readings.csv", index=False)
print(f"maintenance_sensor_readings.csv -> {len(readings_df)} rows "
      f"({readings_df['will_fail_within_14d'].sum()} labeled high-risk readings, "
      f"{readings_df['will_fail_within_14d'].mean()*100:.2f}%)")

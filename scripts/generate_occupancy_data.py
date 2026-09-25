"""
Synthetic data generator — Occupancy Agent (Milestone 3)

Produces:
    data/raw/occupancy_records.csv -> matches OCCUPANCY_RECORDS table,
    with a 'capacity' column added so the dashboard/agent can compute
    occupancy_rate = occupancy_count / capacity, matching the PDF's
    "Zone Occupancy Distribution" mockup (Office Floors, Meeting Rooms,
    Common Areas, Parking Areas).

Run:
    python scripts/generate_occupancy_data.py
"""

from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(11)
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_FACILITIES = 5
DAYS = 90
START = pd.Timestamp("2026-01-01")
ZONES = {
    "Office Floors": 200,
    "Meeting Rooms": 40,
    "Common Areas": 80,
    "Parking Areas": 150,
}

hours = pd.date_range(START, periods=DAYS * 24, freq="h")
rows = []
occupancy_id = 1

for facility_id in range(1, N_FACILITIES + 1):
    for zone, capacity in ZONES.items():
        # each zone/facility gets its own peak-utilization ceiling so
        # facilities don't all look identical
        peak_util = rng.uniform(0.55, 0.9)

        for ts in hours:
            hour = ts.hour
            is_weekend = ts.weekday() >= 5

            if zone == "Parking Areas":
                # parking fills before office hours, empties after
                occ_factor = 1.0 if 7 <= hour <= 17 else 0.15
            elif zone == "Meeting Rooms":
                # bursty -- meetings cluster mid-morning/early-afternoon
                occ_factor = 1.0 if hour in (10, 11, 14, 15) else 0.2
            else:
                occ_factor = 1.0 if 8 <= hour <= 18 else 0.1

            if is_weekend:
                occ_factor *= 0.2

            noise = rng.normal(1.0, 0.1)
            count = int(np.clip(capacity * peak_util * occ_factor * noise, 0, capacity))

            rows.append({
                "occupancy_id": occupancy_id,
                "facility_id": facility_id,
                "zone": zone,
                "capacity": capacity,
                "occupancy_count": count,
                "timestamp": ts,
            })
            occupancy_id += 1

occupancy_df = pd.DataFrame(rows)
occupancy_df.to_csv(OUT_DIR / "occupancy_records.csv", index=False)
print(f"occupancy_records.csv -> {len(occupancy_df)} rows across "
      f"{N_FACILITIES} facilities x {len(ZONES)} zones")

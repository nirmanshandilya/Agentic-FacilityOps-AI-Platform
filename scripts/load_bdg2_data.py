"""
BDG2 real-data loader — Energy Agent (Milestone 1)

Transforms Building Data Genome 2 electricity data (wide format:
one column per building) into this project's ENERGY_USAGE /
FACILITIES schema (long format).

Why synthetic anomalies are injected on top of REAL consumption:
BDG2 has no ground-truth "this reading was anomalous" label. To
still measure your anomaly detector against the PDF's >= 85%
accuracy target, we inject a known number of labeled spikes onto
the real baseline. The underlying consumption pattern is 100% real;
only the anomaly labels are synthetic, and only for validation.

water_usage and the HVAC/Lighting/Equipment split are NOT in BDG2's
electricity file (water is a separate meter file we didn't
download; end-use sub-metering isn't in this dataset at all) -- 
those two are synthesized on top of the real electricity_usage,
same as the original generator. Everything else is real.

Run:
    python scripts\\load_bdg2_data.py
"""

from pathlib import Path
import numpy as np
import pandas as pd

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
rng = np.random.default_rng(seed=42)

# Five real buildings, hand-picked to cover the PDF's facility types.
# building_id must match column names in bdg2_electricity.csv exactly.
SELECTED_BUILDINGS = {
    "Panther_office_Hannah":    "Corporate Office",
    "Fox_office_Israel":        "IT Park",
    "Panther_education_Teofila":"University Campus",
    "Bear_education_Lidia":     "University Campus",
    "Eagle_health_Athena":      "Hospital",
}

# ---------- 1. Facilities table, from real metadata ----------
metadata = pd.read_csv(RAW_DIR / "bdg2_metadata.csv")
meta_subset = metadata[metadata["building_id"].isin(SELECTED_BUILDINGS.keys())].copy()

if len(meta_subset) != len(SELECTED_BUILDINGS):
    missing = set(SELECTED_BUILDINGS) - set(meta_subset["building_id"])
    raise ValueError(
        f"Expected {len(SELECTED_BUILDINGS)} buildings in metadata, found "
        f"{len(meta_subset)}. Missing: {missing}. Check bdg2_metadata.csv "
        f"actually contains these building_id values before re-running."
    )

facility_id_map = {b: i + 1 for i, b in enumerate(SELECTED_BUILDINGS)}

facilities_rows = []
for building_id, facility_type in SELECTED_BUILDINGS.items():
    row = meta_subset.loc[meta_subset["building_id"] == building_id].iloc[0]
    facilities_rows.append({
        "facility_id": facility_id_map[building_id],
        "facility_name": building_id.replace("_", " "),
        "facility_type": facility_type,
        "location": row.get("timezone", "Unknown"),  # BDG2 anonymizes exact address; timezone is the closest real field
    })
facilities_df = pd.DataFrame(facilities_rows)
facilities_df.to_csv(RAW_DIR / "facilities.csv", index=False)
print(f"facilities.csv -> {len(facilities_df)} rows (real BDG2 buildings)")

# ---------- 2. Energy usage, reshaped from real electricity data ----------
usecols = ["timestamp"] + list(SELECTED_BUILDINGS.keys())
elec = pd.read_csv(RAW_DIR / "bdg2_electricity.csv", usecols=usecols, parse_dates=["timestamp"])

# Melt wide -> long
long_df = elec.melt(id_vars="timestamp", var_name="building_id", value_name="electricity_usage")
long_df["facility_id"] = long_df["building_id"].map(facility_id_map)

# Handle missing readings: forward-fill short gaps (<=3 hours), drop what's left
long_df = long_df.sort_values(["facility_id", "timestamp"])
long_df["electricity_usage"] = (
    long_df.groupby("facility_id")["electricity_usage"]
    .transform(lambda s: s.ffill(limit=3))
)
before = len(long_df)
long_df = long_df.dropna(subset=["electricity_usage"])
print(f"Dropped {before - len(long_df)} rows with unrecoverable gaps "
      f"({(before - len(long_df)) / before * 100:.1f}%)")

# ---------- 3. Inject labeled anomalies on top of the real baseline ----------
long_df["is_anomaly"] = False
anomaly_mask = rng.random(len(long_df)) < 0.015  # ~1.5%, same rate as the synthetic generator
long_df.loc[anomaly_mask, "is_anomaly"] = True
long_df.loc[anomaly_mask, "electricity_usage"] *= rng.uniform(1.8, 3.0, size=anomaly_mask.sum())

# ---------- 4. Synthesize water_usage + HVAC/Lighting/Equipment split ----------
# Not present in BDG2's electricity file -- estimated as before, on top of the real total.
hour = long_df["timestamp"].dt.hour
occ_factor = np.select(
    [(hour >= 8) & (hour <= 18), (hour >= 6) & (hour < 8) | (hour > 18) & (hour <= 21)],
    [1.0, 0.5], default=0.2,
)
long_df["water_usage"] = np.maximum(0, rng.normal(50 * occ_factor, 8))

# Per-facility fixed end-use split (Dirichlet, same approach as synthetic generator)
for fid in long_df["facility_id"].unique():
    hvac_share, light_share, equip_share = rng.dirichlet([4, 2, 3])
    m = long_df["facility_id"] == fid
    long_df.loc[m, "hvac_kw"] = long_df.loc[m, "electricity_usage"] * hvac_share
    long_df.loc[m, "lighting_kw"] = long_df.loc[m, "electricity_usage"] * light_share
    long_df.loc[m, "equipment_kw"] = long_df.loc[m, "electricity_usage"] * equip_share

# ---------- 5. Finalize ----------
long_df.insert(0, "energy_id", range(1, len(long_df) + 1))
out_cols = ["energy_id", "facility_id", "timestamp", "electricity_usage", "water_usage",
            "hvac_kw", "lighting_kw", "equipment_kw", "is_anomaly"]
long_df[out_cols].to_csv(RAW_DIR / "energy_usage.csv", index=False)

print(f"energy_usage.csv -> {len(long_df)} rows "
      f"({long_df['is_anomaly'].sum()} labeled anomalies, "
      f"{long_df['is_anomaly'].mean() * 100:.2f}%)")
print(f"\nDate range: {long_df['timestamp'].min()} to {long_df['timestamp'].max()}")
print("Done. Real electricity data from BDG2; water_usage and end-use split are estimated.")

#!/usr/bin/env python3
"""
Kenya Electoral Boundaries Data Pipeline

Loads verified IEBC ward data from Shapefile (Kenya_Wards),
cleans + normalizes it, and exports to JSON + SQL formats ready for Supabase.

Data source: lib/Kenya_Wards/kenya_wards.shp (ESRI Shapefile)
Contains complete Kenya Location data (47 counties, 290 constituencies, 1450 wards)
"""

import json
import re
import sys
import io
from pathlib import Path
from typing import Dict, List

# Fix Windows UTF-8 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Check for shapefile library
try:
    import shapefile
except ImportError:
    print("[ERROR] shapefile library not found. Install: pip install pyshp")
    sys.exit(1)

# ============================================================================
# HELPERS
# ============================================================================

def normalize_name(text: str) -> str:
    """Clean and normalize geographic names."""
    text = str(text).strip()
    text = re.sub(r"[\/']", "", text)  # Remove / and '
    text = re.sub(r"\s+", " ", text)   # Normalize whitespace
    return text.title()

def make_id(prefix: str, name: str) -> str:
    """Generate consistent slugified IDs."""
    slug = normalize_name(name).lower().replace(" ", "-")
    return f"{prefix}_{slug}"

def make_ward_id(const_id: str, ward_name: str) -> str:
    """Generate unique ward ID including constituency to avoid duplicates."""
    ward_slug = normalize_name(ward_name).lower().replace(" ", "-")
    # Include first 10 chars of constituency ID to ensure uniqueness
    const_prefix = const_id.split("_")[1][:8] if "_" in const_id else "unknown"
    return f"ward_{const_prefix}_{ward_slug}"

def generate_sql_insert(table: str, record: dict) -> str:
    """Generate single INSERT statement."""
    cols = ", ".join(record.keys())
    escaped_vals = []
    for v in record.values():
        escaped = str(v).replace("'", "''")
        escaped_vals.append(f"'{escaped}'")
    vals = ", ".join(escaped_vals)
    return f"INSERT INTO {table} ({cols}) VALUES ({vals});"

# ============================================================================
# DATA ACQUISITION
# ============================================================================

print("[STEP 1] Loading verified IEBC ward data from Shapefile...")

lib_dir = Path(__file__).parent.parent / "lib"
shp_path = lib_dir / "Kenya_Wards" / "kenya_wards"

if not (lib_dir / "Kenya_Wards" / "kenya_wards.shp").exists():
    print("[ERROR] Shapefile not found at lib/Kenya_Wards/kenya_wards.shp")
    sys.exit(1)

# Load shapefile
try:
    sf = shapefile.Reader(str(shp_path))
    records = sf.records()
    fields = [f[0] for f in sf.fields[1:]]  # Skip deletion flag
    print(f"[OK] Loaded {len(records)} ward records from shapefile")
    print(f"[OK] Fields: {fields}")
except Exception as e:
    print(f"[ERROR] Failed to read shapefile: {e}")
    sys.exit(1)

# ============================================================================
# DATA PROCESSING
# ============================================================================

print("[STEP 2] Processing & generating IDs...")

# Process records into hierarchical structure
counties: Dict[str, dict] = {}
constituencies: Dict[str, dict] = {}
wards: List[dict] = []
seen_locations = set()

for record in records:
    # Extract fields
    rec_dict = {fields[i]: record[i] for i in range(len(fields))}
    
    county_name = normalize_name(rec_dict.get("county", ""))
    const_name = normalize_name(rec_dict.get("subcounty", ""))
    ward_name = normalize_name(rec_dict.get("ward", ""))
    
    if not county_name or not const_name or not ward_name:
        print(f"[WARN] Skipping incomplete record: {rec_dict}")
        continue
    
    # Generate IDs
    county_id = make_id("county", county_name)
    const_id = make_id("const", const_name)
    ward_id = make_ward_id(const_id, ward_name)  # Use composite ID with constituency
    
    # Add county
    if county_id not in counties:
        counties[county_id] = {
            "id": county_id,
            "name": county_name
        }
    
    # Add constituency
    if const_id not in constituencies:
        constituencies[const_id] = {
            "id": const_id,
            "name": const_name,
            "county_id": county_id
        }
    
    # Add ward (with unique ID from constituency + ward name)
    if ward_id not in seen_locations:
        wards.append({
            "id": ward_id,
            "name": ward_name,
            "constituency_id": const_id
        })
        seen_locations.add(ward_id)

print(f"[OK] Processed data")

# ============================================================================
# VALIDATION
# ============================================================================

print("[STEP 3] Validating data...")
print(f"  Counties: {len(counties)} (expected: 47)")
print(f"  Constituencies: {len(constituencies)} (expected: 290)")
print(f"  Wards: {len(wards)} (expected: 1450)")

if len(counties) != 47:
    print(f"  [WARN] Expected 47 counties, got {len(counties)}")
if len(constituencies) != 290:
    print(f"  [WARN] Expected 290 constituencies, got {len(constituencies)}")
if len(wards) != 1450:
    print(f"  [WARN] Expected 1450 wards, got {len(wards)}")

# ============================================================================
# EXPORT JSON
# ============================================================================

print("[STEP 4] Exporting JSON files...")

counties_export = list(counties.values())
constituencies_export = list(constituencies.values())
wards_export = wards

# Export counties
counties_out = lib_dir / "counties.json"
with open(counties_out, "w", encoding="utf-8") as f:
    json.dump(counties_export, f, indent=2, ensure_ascii=False)
print(f"[JSON] {counties_out.name} ({len(counties_export)} records)")

# Export constituencies
constituencies_out = lib_dir / "constituencies.json"
with open(constituencies_out, "w", encoding="utf-8") as f:
    json.dump(constituencies_export, f, indent=2, ensure_ascii=False)
print(f"[JSON] {constituencies_out.name} ({len(constituencies_export)} records)")

# Export wards
wards_out = lib_dir / "wards.json"
with open(wards_out, "w", encoding="utf-8") as f:
    json.dump(wards_export, f, indent=2, ensure_ascii=False)
print(f"[JSON] {wards_out.name} ({len(wards_export)} records)")

# ============================================================================
# EXPORT SQL
# ============================================================================

print("[STEP 5] Generating SQL seed file...")

sql_lines = [
    "-- Kenya Electoral Boundaries",
    "-- Auto-generated from Kenya_Wards Shapefile (verified IEBC data)",
    "-- 47 Counties | 290 Constituencies | 1450 Wards",
    "-- Source: lib/Kenya_Wards/kenya_wards.shp",
    "",
    "-- COUNTIES",
]

for county in counties_export:
    sql_lines.append(generate_sql_insert("counties", county))

sql_lines.extend([
    "",
    "-- CONSTITUENCIES"
])

for const in constituencies_export:
    sql_lines.append(generate_sql_insert("constituencies", const))

sql_lines.extend([
    "",
    "-- WARDS"
])

for ward in wards_export:
    sql_lines.append(generate_sql_insert("wards", ward))

sql_out = lib_dir / "seed_kenya_locations.sql"
with open(sql_out, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_lines))
print(f"[SQL] {sql_out.name}")

# ============================================================================
# EXPORT TYPESCRIPT
# ============================================================================

print("[STEP 6] Generating TypeScript file...")

# Build nested structure: County -> Constituencies -> Wards
ts_data = {}

for county in counties_export:
    ts_data[county["id"]] = {
        "id": county["id"],
        "name": county["name"],
        "constituencies": []
    }

# Map constituencies to counties
const_by_county = {}
for const in constituencies_export:
    county_id = const["county_id"]
    if county_id not in const_by_county:
        const_by_county[county_id] = []
    const_by_county[county_id].append(const)

# Map wards to constituencies
wards_by_const = {}
for ward in wards_export:
    const_id = ward["constituency_id"]
    if const_id not in wards_by_const:
        wards_by_const[const_id] = []
    wards_by_const[const_id].append(ward)

# Build final structure
for county_id, county_data in ts_data.items():
    for const in const_by_county.get(county_id, []):
        const_data = {
            "id": const["id"],
            "name": const["name"],
            "wards": wards_by_const.get(const["id"], [])
        }
        county_data["constituencies"].append(const_data)

ts_content = f"""// Auto-generated from Kenya_Wards Shapefile verified data
// DO NOT EDIT - regenerate using: python scripts/ingest_kenya_locations.py
// 
// 47 Counties | 290 Constituencies | 1450 Wards
// Source: lib/Kenya_Wards/kenya_wards.shp (ESRI Shapefile)

export const kenyaLocations = {json.dumps(list(ts_data.values()), indent=2)}
"""

ts_out = lib_dir / "kenyaLocations.ts"
with open(ts_out, "w", encoding="utf-8") as f:
    f.write(ts_content)
print(f"[TS] {ts_out.name}")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "="*70)
print("PIPELINE COMPLETE - VERIFIED IEBC SHAPEFILE DATA")
print("="*70)
print(f"""
Counties:       {len(counties_export):>4}
Constituencies: {len(constituencies_export):>4}
Wards:          {len(wards_export):>4}

Output files:
  - {counties_out.name}
  - {constituencies_out.name}
  - {wards_out.name}
  - {sql_out.name}
  - {ts_out.name}

Next steps:
  1. Load to Supabase: psql -f {sql_out.name}
  2. Import in TypeScript: import {{ kenyaLocations }} from '@/lib/kenyaLocations'
  3. Use in queries: getConstituencies(countyId) etc
""")
print("="*70)



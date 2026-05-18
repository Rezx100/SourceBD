import os, json, psycopg

c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None)
cur = c.cursor()

print("=== RSC supplier counts ===")
cur.execute("""
  SELECT
    COUNT(DISTINCT s.id) AS rsc_suppliers,
    COUNT(DISTINCT s.id) FILTER (WHERE s.bkmea_verified) AS overlap_bkmea
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'RSC';
""")
print(cur.fetchone())

print("\n=== rsc_remediation row stats ===")
cur.execute("""
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE fire_pct IS NOT NULL) AS has_fire,
    COUNT(*) FILTER (WHERE structural_pct IS NOT NULL) AS has_struct,
    COUNT(*) FILTER (WHERE electrical_pct IS NOT NULL) AS has_elec,
    COUNT(*) FILTER (WHERE rsc_location IS NOT NULL) AS has_loc
  FROM rsc_remediation;
""")
print(cur.fetchone())

print("\n=== Sample RSC source_records.fields (raw payload) ===")
cur.execute("""
  SELECT s.company_name, sr.fields
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'RSC'
  LIMIT 2;
""")
for name, fields in cur.fetchall():
    print(f"\n--- {name} ---")
    print(json.dumps(fields, indent=2, ensure_ascii=False)[:2500])

print("\n=== Top-level keys frequency in RSC payload ===")
cur.execute("""
  SELECT k, COUNT(*) AS n
  FROM source_records sr JOIN sources src ON src.id=sr.source_id,
       LATERAL jsonb_object_keys(sr.fields) k
  WHERE src.code='RSC'
  GROUP BY k ORDER BY n DESC LIMIT 20;
""")
for r in cur.fetchall():
    print(f"  {r[1]:5d}  {r[0]}")

print("\n=== Keys in nested 'raw' payload (what RSC actually returns) ===")
cur.execute("""
  SELECT k, COUNT(*) AS n
  FROM source_records sr JOIN sources src ON src.id=sr.source_id,
       LATERAL jsonb_object_keys(sr.fields->'raw') k
  WHERE src.code='RSC' AND sr.fields ? 'raw'
  GROUP BY k ORDER BY n DESC LIMIT 40;
""")
for r in cur.fetchall():
    print(f"  {r[1]:5d}  {r[0]}")

c.close()

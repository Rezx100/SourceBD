import os, psycopg
c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None)
cur = c.cursor()

print("=== rsc_remediation NEW column population ===")
cur.execute("""
  SELECT
    COUNT(*) AS total,
    COUNT(progress_pct)              AS has_progress,
    COUNT(workers_count)             AS has_workers,
    COUNT(parent_group_name)         AS has_group,
    COUNT(remediation_status)        AS has_status,
    COUNT(fire_inspection_url)       AS has_fire_url,
    COUNT(structural_inspection_url) AS has_struct_url,
    COUNT(electrical_inspection_url) AS has_elec_url,
    COUNT(boiler_inspection_url)     AS has_boiler_url,
    COUNT(cap_url)                   AS has_cap_url
  FROM rsc_remediation;
""")
cols = ["total","progress","workers","group","status","fire_url","struct_url","elec_url","boiler_url","cap_url"]
print(dict(zip(cols, cur.fetchone())))

print("\n=== Sample rows ===")
cur.execute("""
  SELECT rsc_factory_name, progress_pct, workers_count, parent_group_name,
         remediation_status, training_status,
         (fire_inspection_url IS NOT NULL) AS f,
         (structural_inspection_url IS NOT NULL) AS s,
         (electrical_inspection_url IS NOT NULL) AS e,
         (boiler_inspection_url IS NOT NULL) AS b,
         (cap_url IS NOT NULL) AS c
  FROM rsc_remediation
  ORDER BY workers_count DESC NULLS LAST
  LIMIT 5;
""")
for r in cur.fetchall():
    print(f"  {r[0][:55]:55s}  prog={r[1]}%  workers={r[2]}  group={r[3]}  status={r[4]}/{r[5]}  PDFs(f/s/e/b/cap)={r[6]}/{r[7]}/{r[8]}/{r[9]}/{r[10]}")
c.close()

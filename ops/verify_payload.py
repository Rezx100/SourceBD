import os, json, psycopg

c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None)
cur = c.cursor()

print("=== 3 BKMEA URLs where BOTH email AND phone are missing (for manual verification) ===")
cur.execute("""
  SELECT s.company_name,
         sr.fields->>'bkmea_membership_no' AS membership,
         sr.fields->>'bkmea_detail_url'    AS url
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'BKMEA'
    AND s.email_primary IS NULL
    AND COALESCE(array_length(s.phones,1),0) = 0
  ORDER BY random()
  LIMIT 3;
""")
for r in cur.fetchall():
    print(f"  {r[0]}  ({r[1]})\n    {r[2]}\n")

print("=== Raw payload (fields JSONB) for one fully-enriched supplier ===")
cur.execute("""
  SELECT s.company_name, sr.fields
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'BKMEA' AND s.email_primary IS NOT NULL
  ORDER BY jsonb_array_length(COALESCE(jsonb_path_query_array(sr.fields, '$.*'), '[]'::jsonb)) DESC NULLS LAST
  LIMIT 1;
""")
row = cur.fetchone()
if row:
    print(f"\n--- {row[0]} ---")
    print(json.dumps(row[1], indent=2, ensure_ascii=False)[:4000])

print("\n=== Which payload keys appear most often across all BKMEA records? ===")
cur.execute("""
  SELECT k, COUNT(*) AS n
  FROM source_records sr
  JOIN sources src ON src.id = sr.source_id,
       LATERAL jsonb_object_keys(sr.fields) k
  WHERE src.code = 'BKMEA'
  GROUP BY k
  ORDER BY n DESC;
""")
for r in cur.fetchall():
    print(f"  {r[1]:5d}  {r[0]}")

c.close()

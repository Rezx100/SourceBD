import os, psycopg

c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None)
cur = c.cursor()

print("=== Missing-field breakdown for BKMEA suppliers ===")
cur.execute("""
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE email_primary IS NULL) AS no_email,
    COUNT(*) FILTER (WHERE address_raw IS NULL)  AS no_address,
    COUNT(*) FILTER (WHERE COALESCE(array_length(phones,1),0)=0) AS no_phone,
    COUNT(*) FILTER (WHERE email_primary IS NULL AND COALESCE(array_length(phones,1),0)=0) AS no_email_no_phone
  FROM suppliers WHERE bkmea_verified = TRUE;
""")
print(dict(zip(["total","no_email","no_addr","no_phone","no_email_no_phone"], cur.fetchone())))

print("\n=== Detail-id presence for suppliers still missing email ===")
cur.execute("""
  SELECT
    COUNT(*) FILTER (WHERE sr.fields ? 'bkmea_detail_id') AS has_detail_id,
    COUNT(*) FILTER (WHERE NOT (sr.fields ? 'bkmea_detail_id')) AS no_detail_id,
    COUNT(*) AS total
  FROM source_records sr
  JOIN suppliers s ON s.id = sr.supplier_id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'BKMEA' AND s.email_primary IS NULL;
""")
print(dict(zip(["has_did","no_did","total"], cur.fetchone())))

print("\n=== Sample suppliers still missing email ===")
cur.execute("""
  SELECT s.company_name, s.bkmea_reg_number, sr.source_ref,
         sr.fields->>'bkmea_detail_id' AS did,
         sr.fields->>'bkmea_detail_url' AS url
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'BKMEA' AND s.email_primary IS NULL
  ORDER BY s.id
  LIMIT 10;
""")
for r in cur.fetchall():
    print(r)

print("\n=== Dedup ratio ===")
cur.execute("SELECT COUNT(*) FROM source_records sr JOIN sources src ON src.id=sr.source_id WHERE src.code='BKMEA';")
sr_count = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM suppliers WHERE bkmea_verified = TRUE;")
sup_count = cur.fetchone()[0]
print(f"BKMEA source_records: {sr_count}  |  BKMEA suppliers: {sup_count}  |  diff: {sr_count - sup_count}")

print("\n=== Sample fully-enriched record (payload depth) ===")
cur.execute("""
  SELECT s.company_name, s.email_primary, s.phones, s.contact_name, s.contact_role,
         sr.fields->'employees_total' AS emp,
         sr.fields->'machines_sewing' AS mach_sew,
         sr.fields->'production_capacity' AS cap,
         sr.fields->>'mailing_address' AS mail,
         sr.fields->>'owner_email' AS owner_email
  FROM suppliers s
  JOIN source_records sr ON sr.supplier_id = s.id
  JOIN sources src ON src.id = sr.source_id
  WHERE src.code = 'BKMEA' AND s.email_primary IS NOT NULL
  LIMIT 3;
""")
for r in cur.fetchall():
    print(r)

print("\n=== Districts represented ===")
cur.execute("""
  SELECT COALESCE(district,'(null)') AS d, COUNT(*) FROM suppliers
  WHERE bkmea_verified=TRUE GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
""")
for r in cur.fetchall():
    print(r)

c.close()

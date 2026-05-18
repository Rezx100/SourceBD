import os, psycopg

c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None)
cur = c.cursor()

def show(title, where):
    print(f"\n=== {title} ===")
    cur.execute(f"""
      SELECT s.company_name,
             COALESCE(s.email_primary,'(none)') AS email,
             CASE WHEN COALESCE(array_length(s.phones,1),0)=0 THEN '(none)' ELSE array_to_string(s.phones,', ') END AS phones,
             sr.fields->>'bkmea_membership_no' AS membership,
             sr.fields->>'bkmea_detail_url'    AS url
      FROM suppliers s
      JOIN source_records sr ON sr.supplier_id = s.id
      JOIN sources src ON src.id = sr.source_id
      WHERE src.code = 'BKMEA' AND {where}
      ORDER BY random()
      LIMIT 8;
    """)
    for r in cur.fetchall():
        print(f"  {r[0]}  ({r[3]})")
        print(f"    email: {r[1]}")
        print(f"    phone: {r[2]}")
        print(f"    url:   {r[4]}\n")

show("MISSING BOTH email AND phone",
     "s.email_primary IS NULL AND COALESCE(array_length(s.phones,1),0)=0")

show("HAS phone, MISSING email",
     "s.email_primary IS NULL AND COALESCE(array_length(s.phones,1),0)>0")

show("HAS email, MISSING phone",
     "s.email_primary IS NOT NULL AND COALESCE(array_length(s.phones,1),0)=0")

c.close()

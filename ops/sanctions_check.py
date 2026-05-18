from etl.core.db import db
with db.conn() as c, c.cursor() as cur:
    cur.execute("select count(*) as n from sanctions_screening where active")
    print("active_screenings:", cur.fetchone()["n"])
    cur.execute("select count(*) as n from suppliers where is_sanctioned")
    print("flagged_suppliers:", cur.fetchone()["n"])
    cur.execute("""select supplier_id, list, matched_name, match_score, active
                     from sanctions_screening order by match_score desc""")
    for r in cur.fetchall():
        print(dict(r))

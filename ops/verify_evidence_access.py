"""Security check: the new admin RPCs must refuse an anonymous caller.

The advisor reports these as anon-executable, which matches 71 pre-existing RPCs
in this project. The real control is the `admin_etl_assert_admin()` call inside
each function, per hard rule 7 (the server enforces auth; hiding UI is not a
control). This asserts that control actually holds.
"""
import httpx

from etl.core.config import settings

BASE = settings.supabase_url.rstrip("/")


def anon_key() -> str:
    from pathlib import Path

    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("SUPABASE_ANON_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


ANON = anon_key()
if not ANON:
    raise SystemExit("SUPABASE_ANON_KEY not found in .env")
print(f"anon key loaded ({len(ANON)} chars)")

RPCS = {
    "admin_evidence_summary": {},
    "admin_evidence_by_scraper": {},
    "admin_evidence_problem_claims": {"p_limit": 1},
    "admin_evidence_for_supplier": {"p_supplier_id": "00000000-0000-0000-0000-000000000000"},
    "admin_evidence_claim_decide": {
        "p_claim_id": "00000000-0000-0000-0000-000000000000",
        "p_action": "acknowledge",
    },
    "firecrawl_webhook_record": {
        "p_dedupe_key": "anon-probe",
        "p_event_type": "probe",
        "p_monitor_id": None,
        "p_page_url": None,
        "p_payload": {},
    },
}

print("calling each RPC with the ANON key (nothing should succeed)\n")
h = {"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"}
leaked = []
with httpx.Client(timeout=30, headers=h) as c:
    for fn, args in RPCS.items():
        r = c.post(f"{BASE}/rest/v1/rpc/{fn}", json=args)
        body = r.text[:90].replace("\n", " ")
        blocked = r.status_code >= 400
        print(f"  {'BLOCKED' if blocked else 'LEAKED '}  {fn:34} HTTP {r.status_code}  {body}")
        if not blocked:
            leaked.append(fn)

print("\nverdict:", "all refused" if not leaked else f"LEAKED: {leaked}")

# Direct table reads must be refused too.
print("\ndirect table reads with the ANON key:")
with httpx.Client(timeout=30, headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"}) as c:
    for t in ("evidence_documents", "evidence_claims", "firecrawl_webhook_events"):
        r = c.get(f"{BASE}/rest/v1/{t}", params={"select": "*", "limit": 1})
        print(f"  {'BLOCKED' if r.status_code >= 400 else 'LEAKED '}  {t:26} HTTP {r.status_code}")

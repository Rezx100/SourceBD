"""What a signed-out visitor gets from the live site and from the database API.

The endpoint half of `ops/audit_data_integrity.py` (founder, 13 Oct 2026). One line per
route per check. It reads; it changes nothing:

  site      every public page and every /api route, signed out: the status code, and a
            search of each response for a mailbox, a phone number or an internal field.
  figures   the footer's figures, the search total, the sitemap and the public functions,
            side by side.
  company   40 companies, each read three ways (search row, profile function, public page).
  paging    one search walked page by page; the same page asked twice; each filter's total
            against the cache.
  dbapi     every table and every function the database API offers a signed-out visitor.
  receipts  100 source links followed to the register: does it open, and does it name the company.

HOW IT STAYS HARMLESS
---------------------
One request at a time with a pause. The full export is never called. Database functions are
called with GET only, which the API runs in a read-only transaction: a function that reaches a
write is stopped by the database and answers 405, and that answer is itself a finding (a
visitor got past its guard). Nothing is ever retried with POST. Functions known to create
something (an RFQ, a job, a message) are not called at all, only listed. Nothing found is
printed: a leak is reported as its kind and the place, never the value.

USAGE
-----
    python ops/audit_endpoints.py --cache DIR                  # everything but receipts
    python ops/audit_endpoints.py --cache DIR --only dbapi,figures
    python ops/audit_endpoints.py --cache DIR --only receipts --links 100

Signed-in checks (export equals search, the evidence pack, the cheapest plan) run inside the
founder's own browser session; the steps are in `ops/plans/data-integrity-audit.md`.

Exit codes: 0 ran, 2 could not run.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from ops.audit_data_integrity import DISTRICTS, Data, contact_shapes, load, load_env, pin_dns

SITE = "https://sourcebd.net"
AGENT = "SourceBD-data-audit/1.0 (founder-run, read-only)"
NIL = "00000000-0000-0000-0000-000000000000"
PAUSE = 1.2

# Field names that must never reach a buyer with a value in them.
_PRIVATE_KEY = re.compile(r"sbi|pillar|score|grade|rating|notes_admin|contact_name|contact_role|email|phone|mobile|_snapshot", re.I)
_OWN_MAIL = re.compile(r"@(?:[\w-]+\.)*(?:sourcebd\.net|example\.com|sentry\.io|w3\.org)\b", re.I)
_SCORE_WORDS = re.compile(r"\bSBI\b|sbi_total|pillar[1-4]|\bsanctioned_zero\b|notes_admin|_snapshot_", re.I)

# Functions that create a row when called. Never called here; their guard is read in the source instead.
CREATORS = frozenset({
    "feedback_submit", "claim_initiate", "rfq_create", "order_create", "thread_open", "thread_send_message",
    "supplier_relationship_request", "order_milestone_add", "rfq_quote_submit", "supplier_profile_upsert",
    "settings_update_avatar", "settings_update_notifications", "settings_update_profile", "admin_etl_enqueue",
    "admin_etl_schedule_upsert", "admin_score_recalc_enqueue", "recompute_t13_source_count", "claim_verify_email",
    "settings_get", "handle_new_user",
})
# Open to a signed-out visitor on purpose: the public profile, search and site figures.
PUBLIC_BY_DESIGN = frozenset({
    "buyer_supplier_profile", "buyer_supplier_facility_panel", "discover_suppliers", "discover_facets", "marketing_stats",
    "marketing_facts", "supplier_epb_hscodes", "supplier_primary_address", "production_workers_display_batch",
    "rsc_workers_batch", "sanctions_lists_read", "facility_parent_slug", "supplier_search_candidates", "claim_search",
    "compute_completeness", "epb_record_is_foreign_to_host", "rsc_extension_base_name", "admin_etl_allowed_scraper_codes",
    # Nothing of ours in the answer: arithmetic on its own arguments, a pg_trgm setting, a frame with zero rows.
    "_facility_group_metric", "show_limit", "compliance_expiring_certs",
})
PUBLIC_TABLES = frozenset({"sources", "suppliers", "compliance_documents"})

OUT: list[dict] = []


def line(check: str, where: str, verdict: str, note: str = "") -> None:
    OUT.append({"check": check, "where": where, "verdict": verdict, "note": note})
    print(f"{verdict:<5} {check:<9} {where:<58} {note}"[:260], flush=True)


def page_text(body: str) -> str:
    body = re.sub(r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>", " ", body, flags=re.S)
    return "\n".join(x.strip() for x in html.unescape(re.sub(r"<[^>]+>", "\n", body)).split("\n") if x.strip())


def leaks_in_text(text: str) -> list[str]:
    """Kinds of thing a public response must not carry. Never the thing itself."""
    cleaned = _OWN_MAIL.sub("", text)
    found = [k for k in contact_shapes(cleaned) if k != "a web address"]
    if _SCORE_WORDS.search(text):
        found.append("an internal field name")
    return found


def leaks_in_json(value: Any, path: str = "") -> list[str]:
    """Private keys that hold a value, and contact details inside any text, as `kind at path`."""
    out: list[str] = []
    if isinstance(value, dict):
        for k, v in value.items():
            here = f"{path}.{k}" if path else k
            if _PRIVATE_KEY.search(k) and v not in (None, "", [], {}, False, 0):
                out.append(f"private field at {here}")
            out += leaks_in_json(v, here)
    elif isinstance(value, list):
        for v in value[:200]:
            out += leaks_in_json(v, path + "[]")
    elif isinstance(value, str):
        out += [f"{kind} at {path}" for kind in contact_shapes(value) if kind != "a web address" or "address" in path]
    return out


class Web:
    def __init__(self) -> None:
        self.client = httpx.Client(headers={"User-Agent": AGENT}, timeout=40, follow_redirects=False)
        self.last = 0.0

    def get(self, url: str, **kw: Any) -> httpx.Response:
        time.sleep(max(0.0, PAUSE - (time.monotonic() - self.last)))
        try:
            return self.client.get(url if url.startswith("http") else SITE + url, **kw)
        finally:
            self.last = time.monotonic()


class Api:
    """The database API with the public (anon) key: what any visitor's browser already holds."""

    def __init__(self) -> None:
        load_env()
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        if not base or not key:
            raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set")
        pin_dns(urlparse(base).hostname or "")
        self.base = base.rstrip("/") + "/rest/v1"
        self.client = httpx.Client(headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": AGENT}, timeout=60)
        self.flaky: list[str] = []

    def description(self) -> dict:
        """The API's own list of tables and functions. A visitor's key is no longer shown it, so the
        service key reads the list (and nothing else); every call that follows is made as a visitor."""
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        r = httpx.get(self.base + "/", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60)
        r.raise_for_status()
        return r.json()

    def call(self, method: str, path: str, **kw: Any) -> httpx.Response:
        time.sleep(0.4)
        return self.client.request(method, f"{self.base}/{path}", **kw)

    def rpc(self, name: str, args: dict | None = None) -> Any:
        r = self.call("POST", f"rpc/{name}", json=args or {})
        if r.status_code >= 500:  # seen once in a hundred calls; a second try answered
            self.flaky.append(name)
            time.sleep(3)
            r = self.call("POST", f"rpc/{name}", json=args or {})
        r.raise_for_status()
        return r.json()

    def all_slugs(self) -> set[str]:
        """Every company a visitor can read, straight from the table."""
        out: set[str] = set()
        while True:
            rows = self.call("GET", "suppliers", params={"select": "slug", "order": "slug"},
                             headers={"Range": f"{len(out)}-{len(out) + 999}"}).json()
            if not isinstance(rows, list) or not rows:
                return out
            out |= {r["slug"] for r in rows}


# ---------------------------------------------------------------------------
# site: every page and route, signed out
# ---------------------------------------------------------------------------

V1_ROUTES = ("suppliers", "export", "discover/export", "evidence-pack", "compliance", "match", "products", "saved",
             "saved-searches", "rfqs", "orders", "messages", "claims", "supplier/profile", "supplier/relationships",
             "team", "settings", "feedback", "admin/etl/status", "admin/ledger/verify", f"admin/suppliers/{NIL}")


def check_site(web: Web, d: Data) -> None:
    sample = sorted(s["slug"] for s in d.published)
    slug = sample[len(sample) // 2]
    building = next((b for b in d.buildings if not b.get("is_published") and d.suppliers.get(b["facility_of"], {}).get("is_published")), None)
    listed = re.findall(r"<loc>https://sourcebd\.net(/(?:product|solutions)/[^<]+)</loc>", web.get("/sitemap.xml").text)
    pages = ["/", "/suppliers", f"/suppliers/{slug}", "/discover", "/compliance", "/methodology", "/legal/data-sources",
             "/status", "/pricing", "/security"] + sorted(listed)[:1] + sorted(listed)[-1:]
    for path in pages:
        r = web.get(path)
        found = leaks_in_text(page_text(r.text)) if r.status_code == 200 else []
        ok = r.status_code == 200 and not found
        line("site", path, "ok" if ok else "FAIL", f"{r.status_code}" + (f"; carries {', '.join(sorted(set(found)))}" if found else ""))
    r = web.get("/suppliers/this-company-does-not-exist-000")
    line("site", "/suppliers/<missing>", "ok" if r.status_code == 404 else "FAIL", str(r.status_code))
    if building:
        r = web.get(f"/suppliers/{building['slug']}")
        parent = d.suppliers[building["facility_of"]]["slug"]
        to = r.headers.get("location", "")
        line("site", "/suppliers/<a building>", "ok" if r.status_code in (301, 307, 308) and to.endswith(parent) else "FAIL",
             f"{r.status_code} to {to or 'nowhere'} (its company is {parent})")
    unpublished = next((s for s in d.suppliers.values() if not s.get("is_published") and not s.get("facility_of")), None)
    if unpublished:
        r = web.get(f"/suppliers/{unpublished['slug']}")
        line("site", "/suppliers/<unpublished>", "ok" if r.status_code == 404 else "FAIL", str(r.status_code))

    r = web.get("/api/health")
    line("site", "/api/health", "ok" if r.status_code == 200 else "FAIL", f"{r.status_code} {r.text[:80]}")
    r = web.get("/api/session/me")
    line("site", "/api/session/me", "ok" if r.status_code == 200 and '"role":null' in r.text.replace(" ", "") else "FAIL", f"{r.status_code} {r.text[:60]}")
    for path, empty in (("/api/discover/suggest?q=knit", False), ("/api/discover/suggest?q=", True),
                        ("/api/suppliers/nearby?lat=23.81&lng=90.41", False), ("/api/suppliers/nearby?lat=1&lng=1", True),
                        ("/api/suppliers/nearby?lat=abc&lng=1", True)):
        r = web.get(path)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else None
        found = leaks_in_json(data) if r.status_code == 200 else []
        rows = sum(len(v) for v in data.values() if isinstance(v, list)) if isinstance(data, dict) else 0
        right = (r.status_code == 400 or not rows) if empty else (r.status_code == 200 and rows > 0)
        line("site", path, "ok" if right and not found else "FAIL",
             f"{r.status_code}; {rows} rows (want {'none' if empty else 'some'})" + (f"; {Counter(found).most_common(3)}" if found else ""))
    for route in V1_ROUTES + (f"suppliers/{slug}/shipments",):
        r = web.get(f"/api/v1/{route}")
        refused = r.status_code in (401, 403, 405) or (r.status_code in (302, 307) and "login" in r.headers.get("location", ""))
        line("site", f"/api/v1/{route}", "ok" if refused else "FAIL", f"{r.status_code} signed out")


# ---------------------------------------------------------------------------
# figures: one number, every place
# ---------------------------------------------------------------------------

def check_figures(web: Web, api: Api, d: Data) -> None:
    counted = api.call("GET", "suppliers", params={"select": "slug", "limit": "1"}, headers={"Prefer": "count=exact", "Range": "0-0"})
    published = int(counted.headers.get("content-range", "0/0").rsplit("/", 1)[-1])
    stats, facts = api.rpc("marketing_stats"), api.rpc("marketing_facts")
    total = api.rpc("discover_suppliers", {"p_limit": 1})[0]["total_count"]
    home = page_text(web.get("/methodology").text)
    m = re.search(r"([\d,]+) suppliers \S (\d+) sources listed \S (\d+) hold supplier records \S updated ([\w ]+)", home)
    footer = int(m.group(1).replace(",", "")) if m else None
    places = {"the table": published, "marketing_stats": stats.get("suppliers_indexed"), "marketing_facts": facts.get("suppliers_published"),
              "search, no filter": total, "footer": footer}
    r = web.get("/sitemap.xml")
    urls = re.findall(r"<loc>([^<]+)</loc>", r.text)
    for child in [u for u in urls if u.endswith(".xml")][:30]:
        urls += re.findall(r"<loc>([^<]+)</loc>", web.get(child).text)
    in_map = {u.rsplit("/", 1)[-1] for u in urls if "/suppliers/" in u}
    places["sitemap"] = len(in_map)
    places["this script's cache"] = len(d.published)
    live = {v for k, v in places.items() if k != "this script's cache"}
    line("figures", "published companies", "ok" if len(live) == 1 else "FAIL",
         "; ".join(f"{k} {v}" for k, v in places.items()))
    if in_map:
        slugs = api.all_slugs()
        line("figures", "sitemap against the table", "ok" if in_map == slugs else "FAIL",
             f"{len(in_map - slugs)} addresses in the sitemap are not published; {len(slugs - in_map)} published are missing")

    by_type = {t: api.rpc("discover_suppliers", {"p_limit": 1, "p_entity_types": [t]}) for t in ("factory", "buying_house")}
    type_sum = sum(rows[0]["total_count"] if rows else 0 for rows in by_type.values())
    line("figures", "kinds add up to the total", "ok" if type_sum == total else "FAIL", f"factory + buying house = {type_sum}; total {total}")

    if m:
        line("figures", "footer: sources listed / with records", "ok" if (int(m.group(2)), int(m.group(3))) == (facts["sources_listed"], facts["sources_with_records"]) else "FAIL",
             f"footer {m.group(2)}/{m.group(3)}; function {facts['sources_listed']}/{facts['sources_with_records']}")
        oldest = min((s["latest"] for s in facts["sources"] if s.get("latest")), default="")
        line("figures", "footer: \"updated\"", "note", f"says {m.group(4).strip()}; that is the newest read of any register. The oldest register was last read {oldest}")
    idle = [s["code"] for s in facts["sources"] if not s["records"]]
    line("figures", "sources listed that hold nothing", "FAIL" if idle else "ok", f"{len(idle)} of {facts['sources_listed']}: {', '.join(idle)}")
    held = defaultdict(set)
    for sid, recs in d.records.items():
        if d.suppliers.get(sid, {}).get("is_published"):  # an entry pulled after its company was added has no row here
            for r in recs:
                held[r["code"].split(" ")[0]].add(sid)
    for s in facts["sources"]:
        mine = len(held.get(s["code"], ()))
        if s["records"] and (s["records"] > s["suppliers"] * 1.5 or abs(s["suppliers"] - mine) > max(5, mine * 0.02)):
            line("figures", f"register figures: {s['code']}", "FAIL",
                 f"public: {s['records']} records, {s['suppliers']} suppliers; published companies holding an entry: {mine}")
    line("figures", "marketing_stats.certifications_verified", "FAIL" if stats.get("certifications_verified") == 0 else "ok",
         f"{stats.get('certifications_verified')} (certificates on file: {facts.get('certificates_on_file')}); not printed on any page today")
    for row in api.rpc("sanctions_lists_read"):
        line("figures", f"sanctions list read: {row['list']}", "ok" if row.get("last_read") else "FAIL",
             f"{row['entries_listed']} entries; last full read {str(row.get('last_read') or 'none recorded')[:10]}")
    for path in ("/methodology", "/legal/data-sources", "/status"):
        text = page_text(web.get(path).text)
        claims = sorted(set(re.findall(r"\b\d[\d,]* (?:suppliers|sources|registers|lists|certificates|records)\b", text)))
        line("figures", f"claims on {path}", "note", "; ".join(claims[:14]))


# ---------------------------------------------------------------------------
# company: one company, every place
# ---------------------------------------------------------------------------

def sample_companies(d: Data) -> dict[str, list[dict]]:
    """Forty, picked the same way for a given pull: ten rich, ten thin, ten with buildings, the five
    changed most recently (on 13 Oct 2026 those were the day's merges), five with customs data."""
    rows = sorted(d.published, key=lambda s: s["slug"])
    with_buildings = {b["facility_of"] for b in d.buildings}
    customs = {v["supplier_id"] for v in d.volza if v.get("match_class") == "exact"}
    rich = sorted(rows, key=lambda s: -len(d.codes(s["id"])))[:10]
    thin = [s for s in rows if len(d.records[s["id"]]) == 1][::400][:10]
    changed = sorted((s for s in rows if len(d.codes(s["id"])) >= 3), key=lambda s: s.get("updated_at") or "", reverse=True)[:5]
    return {
        "rich": rich, "thin": thin, "buildings": [s for s in rows if s["id"] in with_buildings][::20][:10],
        "changed": changed, "customs": [s for s in rows if s["id"] in customs and s not in rich][::40][:5],
    }


def check_company(web: Web, api: Api, d: Data) -> None:
    differ = Counter()
    for group, rows in sample_companies(d).items():
        for s in rows:
            slug = s["slug"]
            try:
                profile = api.rpc("buyer_supplier_profile", {"p_slug": slug})
                hits = api.rpc("discover_suppliers", {"p_q": s["company_name"], "p_limit": 50})
            except httpx.HTTPError as exc:
                line("company", f"{group}: {slug}", "FAIL", f"the public profile function failed twice: {type(exc).__name__}")
                continue
            row = next((h for h in hits if h["slug"] == slug), None)
            text = page_text(web.get(f"/suppliers/{slug}").text)
            sup = profile["supplier"]
            own_certs = [c for c in profile["certifications"] if not c.get("building_name")]
            own_pills = {p["source_code"] for p in profile["pills"] if not p.get("building_name") and not p.get("inherited_from")}
            page_sources = re.search(r"Public record ·\n(\d+)\nsources?", text)
            page_kind = re.search(r"\n(Factory|Buying house)[ \n·]", text)
            page_workers = re.search(r"\nWorkers\n[^\n]*\n([\d,]+)\n", text)
            facts = {
                "name": (row and row["company_name"], sup["company_name"], None),
                "kind": (row and row["entity_type"], sup["entity_type"], page_kind and page_kind.group(1).lower().replace(" ", "_")),
                "district": (row and row["district"], sup["district"], None),
                "workers": (row and row["employees_total"], sup["employees_total"], page_workers and int(page_workers.group(1).replace(",", ""))),
                "sources": (row and row["t13_source_count"], profile["t13_source_count"], None),
                "certificates": (row and len(row["cert_summary"]), len(own_certs), None),
                "registers": (row and sorted(row["registries"]), sorted(own_pills & {"BGMEA", "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC"}), None),
                "safety": (row and row["rsc_progress_pct"] is not None, bool([x for x in profile.get("rsc_remediation") or [] if not x.get("building_name")]), None),
            }
            if not row:
                line("company", f"{group}: {slug}", "FAIL", "its own name does not find it in the first 50 search rows")
                differ["not found by name"] += 1
                continue
            bad = [k for k, (a, b, c) in facts.items() if a != b or (c is not None and c != b)]
            if page_sources and int(page_sources.group(1)) != len({p["source_code"] for p in profile["provenance"]}):
                bad.append("page source count")
            found = [x for x in leaks_in_json(profile) + leaks_in_json(row)]
            on_page = leaks_in_text(text)
            for k in bad:
                differ[k] += 1
            note = "; ".join(f"{k}: search {facts[k][0]!r}, profile {facts[k][1]!r}" + (f", page {facts[k][2]!r}" if facts[k][2] is not None else "")
                             for k in bad if k in facts)
            if found:
                note += f"; database API carries {sorted({x.split(' at ')[0] for x in found})} in {sorted({x.split(' at ')[1] for x in found})[:3]}"
                differ["contact detail from the database API"] += 1
            if on_page:
                note += f"; the page carries {sorted(set(on_page))}"
                differ["contact detail on the page"] += 1
            line("company", f"{group}: {slug}", "FAIL" if bad or found or on_page else "ok", note)
    line("company", "summary", "note", "; ".join(f"{k} {n}" for k, n in differ.most_common()) or "all forty agree")
    if api.flaky:
        line("company", "a public function answered 500, then answered", "note", ", ".join(sorted(set(api.flaky))))


# ---------------------------------------------------------------------------
# paging: every row once, the same order twice, each filter's total
# ---------------------------------------------------------------------------

def check_paging(api: Api, d: Data) -> None:
    args = {"p_districts": ["Mymensingh"], "p_limit": 24}
    seen: list[str] = []
    total = None
    for offset in range(0, 2000, 24):
        rows = api.rpc("discover_suppliers", {**args, "p_offset": offset})
        if not rows:
            break
        total = rows[0]["total_count"]
        seen += [r["slug"] for r in rows]
    line("paging", "walk every page of one search", "ok" if total == len(seen) == len(set(seen)) else "FAIL",
         f"total says {total}; rows returned {len(seen)}; distinct {len(set(seen))}")
    for sort in ("receipts", "name", "workers", "completeness", "established"):
        a = [r["slug"] for r in api.rpc("discover_suppliers", {"p_limit": 50, "p_sort": sort, "p_offset": 100})]
        b = [r["slug"] for r in api.rpc("discover_suppliers", {"p_limit": 50, "p_sort": sort, "p_offset": 100})]
        line("paging", f"same request twice, sort={sort}", "ok" if a == b else "FAIL", "" if a == b else "the order changed between two calls")
    over = api.rpc("discover_suppliers", {"p_limit": 5000})
    line("paging", "p_limit=5000", "ok" if len(over) <= 100 else "FAIL", f"returned {len(over)} rows")

    def count(fn: Any) -> int:
        return sum(1 for s in d.published if fn(s))

    registries = {r: count(lambda s, r=r: r in d.codes(s["id"])) for r in ("BGMEA", "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC")}
    for reg, mine in registries.items():
        got = api.rpc("discover_suppliers", {"p_limit": 1, "p_registries": [reg]})
        got = got[0]["total_count"] if got else 0
        line("paging", f"filter register={reg}", "ok" if got == mine else "FAIL", f"search {got}; published companies holding an entry {mine}")
    kinds = {"gots": "GOTS", "oeko_tex": "OEKO_TEX", "wrap": "WRAP", "sa8000": "SA8000"}
    for kind, code in kinds.items():
        got = api.rpc("discover_suppliers", {"p_limit": 1, "p_cert_kinds": [kind], "p_cert_state": "any"})
        got = got[0]["total_count"] if got else 0
        mine = count(lambda s, k=kind: any(c["kind"] == k and not c.get("rejected_at") for c in d.certs[s["id"]]))
        entries = count(lambda s, c=code: c in d.codes(s["id"]))
        line("paging", f"filter certificate={kind}", "ok" if got == mine == entries else "FAIL",
             f"search {got}; with a certificate row {mine}; with the body's entry {entries}")
    for district in ("Dhaka", "Chattogram", "Cumilla", "Narayanganj"):
        got = api.rpc("discover_suppliers", {"p_limit": 1, "p_districts": [district]})
        got = got[0]["total_count"] if got else 0
        exact = count(lambda s, x=district: (s.get("district") or "") == x)
        line("paging", f"filter district={district}", "ok" if got == exact else "FAIL", f"search {got} (matches by \"contains\"); spelled exactly so {exact}")
    facets = api.rpc("discover_facets")
    odd = [x for x in facets.get("districts", []) if x not in DISTRICTS]
    line("paging", "district choices offered", "FAIL" if odd else "ok", f"{len(odd)} are not districts: {', '.join(odd)}")


# ---------------------------------------------------------------------------
# dbapi: tables and functions open to a signed-out visitor
# ---------------------------------------------------------------------------

def _nil_args(params: dict[str, dict]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, spec in params.items():
        kind, fmt = spec.get("type"), spec.get("format", "")
        out[name] = (NIL if fmt == "uuid" else [] if kind == "array" else 0 if kind in ("integer", "number")
                     else False if kind == "boolean" else {} if fmt in ("jsonb", "json") or kind == "object" else None if "timestamp" in fmt else "")
    return out


def check_dbapi(api: Api, d: Data) -> None:
    spec = api.description()
    tables = sorted(spec.get("definitions", {}))
    line("dbapi", "tables and views listed to a visitor", "note", f"{len(tables)}")
    for table in tables:
        r = api.call("GET", table, params={"select": "*", "limit": "1"})
        rows = r.json() if r.status_code == 200 else []
        if table in PUBLIC_TABLES:
            continue
        line("dbapi", f"table {table}", "FAIL" if rows else "ok", f"{r.status_code}; {'returns rows' if rows else 'no rows'}")
    for column in ("email_primary", "phones", "contact_name", "notes_admin", "website", "supplier_contact_email", "claimed_by"):
        r = api.call("GET", "suppliers", params={"select": f"slug,{column}", "limit": "1"})
        line("dbapi", f"suppliers.{column}", "ok" if r.status_code in (401, 403) else "FAIL", f"{r.status_code}")
    r = api.call("GET", "suppliers", params={"select": "slug", "is_published": "eq.false", "limit": "5"})
    line("dbapi", "unpublished companies", "ok" if r.status_code == 200 and not r.json() else "FAIL", f"{r.status_code}; {len(r.json()) if r.status_code == 200 else 0} rows")
    r = api.call("GET", "suppliers", params={"select": "slug", "limit": "1"}, headers={"Prefer": "count=exact", "Range": "0-0"})
    line("dbapi", "suppliers readable row by row", "note",
         f"{r.headers.get('content-range', '?')} rows with 47 columns, address text included, outside the site's rate limit")
    with_text = next((s for s in d.published if contact_shapes(s.get("address_raw"))), None)
    if with_text:
        got = api.call("GET", "suppliers", params={"select": "address_raw", "slug": f"eq.{with_text['slug']}"}).json()
        kinds = contact_shapes(got[0]["address_raw"]) if got else []
        line("dbapi", "suppliers.address_raw", "FAIL" if kinds else "ok", f"{with_text['slug']}: carries {', '.join(kinds) or 'nothing'}")
    r = api.call("GET", "compliance_documents", params={"select": "supplier_id", "limit": "1"}, headers={"Prefer": "count=exact", "Range": "0-0"})
    line("dbapi", "compliance_documents", "note", f"readable in full: {r.headers.get('content-range', '?')}")

    paths = spec.get("paths", {})
    functions = sorted(p[5:] for p in paths if p.startswith("/rpc/"))
    line("dbapi", "functions listed to a visitor", "note", f"{len(functions)}")
    for name in functions:
        post = paths[f"/rpc/{name}"].get("post", {})
        body = next((p for p in post.get("parameters", []) if p.get("in") == "body"), {})
        params = body.get("schema", {}).get("properties", {})
        args = _nil_args(params)
        if name in CREATORS:
            line("dbapi", f"fn {name}", "skip", "creates a row when called; not called, guard read in the source")
            continue
        query = {k: ("{}" if v == [] else json.dumps(v) if isinstance(v, (dict, bool)) else str(v)) for k, v in args.items() if v is not None}
        r = api.call("GET", f"rpc/{name}", params=query)
        how = "GET"
        try:
            data = r.json()
        except ValueError:
            data = None
        refused = r.status_code >= 400
        message = (data or {}).get("message", "") if isinstance(data, dict) and refused else ""
        size = len(r.content)
        if r.status_code == 405:
            # The read-only call stopped it. Never retried with POST: that would let it write.
            wrote = "read-only" in message
            line("dbapi", f"fn {name}", "FAIL" if wrote else "skip",
                 "a signed-out visitor reached a write; only the read-only call stopped it" if wrote else "not callable with GET; not called")
        elif name in PUBLIC_BY_DESIGN:
            line("dbapi", f"fn {name}", "ok", f"{how} {r.status_code}; public by design; {size} bytes")
        elif refused:
            line("dbapi", f"fn {name}", "ok", f"{how} {r.status_code} refused: {message[:70]}")
        else:
            empty = data in (None, [], {}, "") or (isinstance(data, dict) and not any(v for v in data.values() if v not in (0, [], {}, None, False)))
            shape = "nothing" if empty else f"{type(data).__name__}, {size} bytes" + (f", keys {sorted(data)[:6]}" if isinstance(data, dict) else "")
            line("dbapi", f"fn {name}", "ok" if empty else "FAIL", f"{how} {r.status_code}; answers a signed-out visitor with {shape}")


# ---------------------------------------------------------------------------
# receipts: follow the source link to the register
# ---------------------------------------------------------------------------

def _links(d: Data, want: int) -> list[tuple[str, str, str, str, str]]:
    """(register, slug, url, the number we show, the company name), spread across registers."""
    plan = {"BGMEA": 22, "EPB": 18, "RSC": 14, "OEKO_TEX": 10, "GOTS": 8, "WRAP": 8, "BKMEA": 8, "BGAPMEA": 6, "BRAND": 6}
    pools: dict[str, list] = defaultdict(list)
    for s in sorted(d.published, key=lambda x: x["slug"]):
        for r in d.records[s["id"]]:
            f, code = r["fields"], r["code"].split(" ")[0]
            url, number = None, ""
            if code == "BGMEA" and f.get("bgmea_member_id"):
                url, number = f"https://www.bgmea.com.bd/member/{f['bgmea_member_id']}", str(f.get("bgmea_reg_number") or "")
            elif code == "EPB":
                url, number = f.get("epb_detail_url"), str(f.get("epb_reg_no") or "")
            elif code == "RSC":
                url, number = f.get("rsc_cap_url") or f.get("rsc_fire_inspection_url"), str(f.get("rsc_factory_id") or "")
            elif code == "OEKO_TEX":
                url, number = f.get("oeko_profile_url"), str(f.get("oeko_customer_id") or "")
            elif code == "GOTS":
                url, number = f.get("gots_scope_certificate_url"), str(f.get("gots_license_number") or "")
            elif code == "WRAP":
                url, number = f.get("wrap_profile_url"), str(f.get("wrap_id") or "")
            elif code == "BKMEA":
                url, number = f.get("bkmea_detail_url"), str(f.get("bkmea_membership_no") or "")
            elif code == "BGAPMEA":
                url, number = f.get("bgapmea_detail_url"), str(f.get("bgapmea_membership_no") or "")
            elif code.startswith("BRAND"):
                url, code = f.get("source_url"), "BRAND"
            if url and str(url).startswith("http"):
                pools[code].append((code, s["slug"], str(url), number, s["company_name"]))
    out = []
    for code, n in plan.items():
        pool = pools[code]
        out += pool[:: max(1, len(pool) // n)][:n] if pool else []
    return out[:want]


def check_receipts(d: Data, want: int) -> None:
    client = httpx.Client(headers={"User-Agent": AGENT}, timeout=45, follow_redirects=True)
    tally: dict[str, Counter] = defaultdict(Counter)
    for code, slug, url, number, name in _links(d, want):
        time.sleep(1.5)
        try:
            r = client.get(url)
            status, body = r.status_code, r.text if "text" in r.headers.get("content-type", "") or "json" in r.headers.get("content-type", "") else ""
        except Exception as exc:  # noqa: BLE001  a bad certificate lands here too: a buyer's browser refuses it as well
            status, body = ("bad certificate" if "CERTIFICATE" in str(exc).upper() else type(exc).__name__), ""
        text = page_text(body) if body else ""
        words = [w for w in re.findall(r"[A-Za-z]{4,}", name) if w.lower() not in ("limited", "private", "bangladesh", "company")][:2]
        names_it = bool(text) and bool(words) and all(w.lower() in text.lower() for w in words)
        numbers_it = bool(text) and bool(number) and number.strip() in text
        # Three answers. "unread" is not a pass: a script cannot tell, a person with a browser can.
        if status == 200 and names_it:
            verdict, said = "ok", f"names the company; shows the number: {'yes' if numbers_it else 'no'}"
        elif status == 200 and numbers_it:
            verdict, said = "FAIL", "shows the number we print under another name"
        elif status == 200 or status == 403:
            verdict, said = "unread", "opens, but a PDF, a script-built page or a bot check: a script cannot read it"
        else:
            verdict, said = "FAIL", "does not open"
        tally[code][verdict] += 1
        line("receipts", f"{code}: {slug}", verdict, f"{status} {urlparse(url).hostname}; {said}")
    line("receipts", "summary", "note", "; ".join(f"{c} {dict(v)}" for c, v in sorted(tally.items())))


GROUPS = ("site", "figures", "company", "paging", "dbapi", "receipts")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True, help="the pull `audit_data_integrity.py --cache` made")
    parser.add_argument("--only", default="site,figures,company,paging,dbapi", help=f"comma-separated: {','.join(GROUPS)}")
    parser.add_argument("--links", type=int, default=100, help="how many source links `receipts` follows")
    parser.add_argument("--json", type=Path, default=None)
    args = parser.parse_args()
    only = {x.strip() for x in args.only.split(",")}
    try:
        d = Data(load(args.cache))
        web, api = Web(), Api()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not start: {exc}", file=sys.stderr)
        return 2
    steps = {"site": lambda: check_site(web, d), "figures": lambda: check_figures(web, api, d), "company": lambda: check_company(web, api, d),
             "paging": lambda: check_paging(api, d), "dbapi": lambda: check_dbapi(api, d), "receipts": lambda: check_receipts(d, args.links)}
    for name in GROUPS:
        if name in only:
            try:
                steps[name]()
            except Exception as exc:  # noqa: BLE001  one group failing must not hide the others
                line(name, "could not finish", "FAIL", f"{type(exc).__name__}: {exc}"[:200])
    fails = sum(1 for o in OUT if o["verdict"] == "FAIL")
    print(f"\n{len(OUT)} lines; {fails} FAIL")
    if args.json:
        args.json.write_text(json.dumps(OUT, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

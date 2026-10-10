"""Dry run: how many of our garment suppliers Volza holds Bangladesh export records for.

Sandbox key only (VOLZA_SANDBOX_KEY). This script never reads the production key and has
no live mode; live calls live in ops/volza_live_sample.py. X-Credit-Used is the whole
account's total, so the run stops if it rises above the value it found at the start.

Steps (run from the repo root so etl/.env loads):
  candidates  read published RMG suppliers (BGMEA/BKMEA member or EPB HS 61/62) -> JSON
  match       per supplier: bangladesh-exports by name (Q1 2021), resumable
  overview    summary + top 5 for three known exporters, and the filter tests
  summarize   match rate, classes, 50-row hand-check sample, cost table

Raw Volza data stays in etl/raw/volza/ (gitignored); only counts go in the report
ops/plans/volza-export-dry-run.md.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import re
import sys
import time
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.core.normalize import _LEGAL_SUFFIX_RE, normalize_company_name  # noqa: E402

BASE = "https://backend.volza.com/api/v1"
RAW = Path(__file__).resolve().parents[1] / "etl" / "raw" / "volza"
CANDIDATES = RAW / "candidates.json"
MATCH = RAW / "match.jsonl"
OVERVIEWS = RAW / "overviews.json"
WINDOW = ("2021-01-01", "2021-03-31")  # sandbox data is Jan-Mar 2021 only
HS = ["61", "62"]
MIN_GAP = 1.3  # seconds between calls: ~46/min, under the 50/min plan limit

RMG_SQL = """
with rmg as (
  select sr.supplier_id,
    bool_or(s.code = 'BGMEA') bgmea, bool_or(s.code = 'BKMEA') bkmea,
    bool_or(s.code = 'EPB' and exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
        then sr.fields->'epb_hscodes' else '[]' end) h
      where left(h->>'code', 2) in ('61', '62'))) epb_6162,
    array_remove(array_agg(distinct sr.fields->>'scraped_company_name'), null) scraped_names
  from source_records sr join sources s on s.id = sr.source_id
  where sr.status = 'active' and s.code in ('BGMEA', 'BKMEA', 'EPB')
  group by 1)
select su.id::text, su.slug, su.company_name, su.name_display, rmg.bgmea, rmg.bkmea,
       rmg.epb_6162, rmg.scraped_names
from rmg join suppliers su on su.id = rmg.supplier_id
where su.is_published and (rmg.bgmea or rmg.bkmea or rmg.epb_6162)
order by su.slug
"""


def search_name(name: str) -> str:
    """Name without the trailing Ltd/Limited/(Pvt.) part, case and hyphens kept.

    Volza's supplier_name is a contains-match, so "Square Fashions" also finds
    "Square Fashions Ltd" and "Square Fashions Limited"; the suffix only narrows.
    """
    n = re.sub(r"\s*\((?:pvt|private)\.?\)\s*", " ", name or "", flags=re.IGNORECASE)
    n = n.split("(")[0]  # "(FOR UD)", "(Bangladesh) Co." notes: a cut name still contains-matches
    n = re.sub(r"\.(?=[A-Za-z])", ". ", n)  # "Inds.Ltd" -> "Inds. Ltd" so the suffix strips
    n = re.sub(r"\s+", " ", n).strip()
    for _ in range(4):
        new = _LEGAL_SUFFIX_RE.sub("", n.rstrip(" .,()")).strip()
        if new == n:
            break
        n = new
    return n if len(re.sub(r"[^A-Za-z0-9]", "", n)) >= 4 else (name or "").strip()


def variants(row: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for raw in [row["company_name"], row.get("name_display"), *(row.get("scraped_names") or [])]:
        v = search_name(raw or "")
        if len(re.sub(r"[^A-Za-z0-9]", "", v)) >= 4 and v.lower() not in {o.lower() for o in out}:
            out.append(v)
    return out


def sandbox_key() -> str:
    key = os.environ.get("VOLZA_SANDBOX_KEY")
    if not key and sys.platform == "win32":
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
            key = winreg.QueryValueEx(k, "VOLZA_SANDBOX_KEY")[0]
    if not key:
        raise SystemExit("VOLZA_SANDBOX_KEY is not set")
    return key


class Volza:
    def __init__(self) -> None:
        self.http = httpx.Client(
            base_url=BASE, timeout=60, headers={"Authorization": f"Bearer {sandbox_key()}"}
        )
        self.last = 0.0
        self.calls = 0
        self.baseline: float | None = None

    def call(self, method: str, path: str, **kw: Any) -> tuple[int, Any]:
        for _ in range(5):
            wait = MIN_GAP - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            r = self.http.request(method, path, **kw)
            self.calls += 1
            # X-Credit-Used is the whole account's total, so it includes live spending made with
            # the production key; a sandbox call must leave it where the run found it.
            used = r.headers.get("X-Credit-Used")
            if used is not None and self.baseline is None:
                self.baseline = float(used)
            if r.status_code == 402 or (used is not None and float(used) > self.baseline):
                raise SystemExit(f"STOP: credit used on {path} (X-Credit-Used={used}, "
                                 f"was {self.baseline}); tell the founder")
            if r.status_code == 429:
                time.sleep(60)
                continue
            try:
                return r.status_code, r.json()
            except ValueError:
                return r.status_code, {"_text": r.text[:500]}
        return 429, {}

    def exports(self, name: str, n: int = 1, **extra: Any) -> tuple[int, Any]:
        body = {
            "hsn_code": HS, "supplier_name": [name], "start_date": WINDOW[0], "end_date": WINDOW[1],
            "max_count_per_page": n, "sort_by": "trade_value_usd", "sort_order": "DESC", **extra,
        }
        return self.call("POST", "/bangladesh-exports", json=body)

    def search(self, name: str) -> tuple[int, Any]:
        params = {"company_name": name, "country": "Bangladesh", "page_size": 50}
        return self.call("GET", "/companies/search", params=params)


def items(resp: Any) -> list[dict[str, Any]]:
    """First list of objects in a response (the key differs between endpoints)."""
    if isinstance(resp, dict):
        for v in resp.values():
            if isinstance(v, list) and (not v or isinstance(v[0], dict)):
                return v
            if isinstance(v, dict):
                found = items(v)
                if found:
                    return found
    return []


def pick(d: dict[str, Any], *keys: str) -> Any:
    return next((d[k] for k in keys if d.get(k) not in (None, "")), None)


def shipments(resp: Any) -> int:
    s = resp.get("api_summary") if isinstance(resp, dict) else None
    return int((s or {}).get("count_of_shipments") or 0)


def _rest_all(http: httpx.Client, path: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    while True:
        r = http.get(f"{path}&limit=1000&offset={len(out)}")  # past the end: 200 with [], not a 416
        r.raise_for_status()
        if not r.json():  # stop on an empty page, whatever page size the server caps us at
            return out
        out += r.json()


def rmg_rows() -> list[dict[str, Any]]:
    """RMG_SQL over the REST API (the 6543 pooler times out from some networks).

    The report cross-checks this count against RMG_SQL run in the SQL editor.
    """
    from etl.core.config import settings

    key = settings.supabase_service_role_key
    http = httpx.Client(base_url=f"{settings.supabase_url}/rest/v1", timeout=120,
                        headers={"apikey": key, "Authorization": f"Bearer {key}"})
    src = {s["id"]: s["code"] for s in _rest_all(http, "/sources?select=id,code&code=in.(BGMEA,BKMEA,EPB)")}
    flags: dict[str, dict[str, Any]] = {}
    for sr in _rest_all(http, "/source_records?select=supplier_id,source_id,hs:fields->epb_hscodes,"
                              "scraped:fields->>scraped_company_name&status=eq.active"
                              f"&source_id=in.({','.join(src)})&order=id"):
        f = flags.setdefault(sr["supplier_id"], {"bgmea": False, "bkmea": False, "epb_6162": False,
                                                 "scraped_names": []})
        code = src[sr["source_id"]]
        f["bgmea"] |= code == "BGMEA"
        f["bkmea"] |= code == "BKMEA"
        hs = sr["hs"] if isinstance(sr["hs"], list) else []
        f["epb_6162"] |= code == "EPB" and any(str(h.get("code", ""))[:2] in HS for h in hs)
        if sr["scraped"] and sr["scraped"] not in f["scraped_names"]:
            f["scraped_names"].append(sr["scraped"])
    rows = []
    for su in _rest_all(http, "/suppliers?select=id,slug,company_name,name_display&is_published=is.true&order=slug"):
        f = flags.get(su["id"])
        if f and (f["bgmea"] or f["bkmea"] or f["epb_6162"]):
            rows.append({**su, **f})
    return rows


def cmd_candidates(_: argparse.Namespace) -> None:
    rows = rmg_rows()
    for r in rows:
        r["variants"] = variants(r)
    RAW.mkdir(parents=True, exist_ok=True)
    CANDIDATES.write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8")
    no_variant = sum(1 for r in rows if not r["variants"])
    print(f"{len(rows)} RMG suppliers -> {CANDIDATES} ({no_variant} with no 4+ character name)")


def classify(ours: str, volza_supplier: str | None, n: int, suppliers: int) -> str:
    """api_summary.count_of_suppliers says how many exporters the contains-match swept in.

    bangladesh-exports ignores volza_company_id (sandbox test, 10 Oct 2026), so the name
    is the only key and a count above 1 means other companies' shipments are mixed in.
    """
    if n == 0:
        return "none"
    if suppliers > 1:
        return "ambiguous"
    return "exact" if normalize_company_name(volza_supplier or "") == normalize_company_name(ours) else "likely"


def summary_suppliers(resp: Any) -> int:
    return int(((resp.get("api_summary") if isinstance(resp, dict) else None) or {}).get("count_of_suppliers") or 0)


def cmd_match(a: argparse.Namespace) -> None:
    rows = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    done = set()
    if MATCH.exists():
        done = {json.loads(line)["id"] for line in MATCH.read_text(encoding="utf-8").splitlines()}
    todo = [r for r in rows if r["id"] not in done and r["variants"]][: a.limit or None]
    print(f"{len(done)} done, {len(todo)} to go (~{len(todo) * 1.1 * MIN_GAP / 3600:.1f} h)")
    v = Volza()

    def attempt(rec: dict[str, Any], name: str) -> bool:
        est, er = v.exports(name)
        rec["tried"].append([name, est, shipments(er), summary_suppliers(er)])
        if not shipments(er):
            return False
        top = (er.get("api_records") or [{}])[0]
        rec.update(shipments=shipments(er), suppliers=summary_suppliers(er), matched_variant=name,
                   volza_supplier=pick(top, "supplier_name", "shipper_name", "exporter_name"))
        return True

    with MATCH.open("a", encoding="utf-8") as out:
        for i, r in enumerate(todo, 1):
            rec: dict[str, Any] = {
                "id": r["id"], "slug": r["slug"], "name": r["company_name"], "tried": [],
                "shipments": 0, "suppliers": 0, "matched_variant": None, "volza_supplier": None,
            }
            for name in r["variants"]:
                if attempt(rec, name):
                    break
            full = (r["company_name"] or "").strip()
            if rec["suppliers"] > 1 and full.lower() != (rec["matched_variant"] or "").lower():
                attempt(rec, full)  # does the full legal name narrow the sweep to one exporter?
            rec["class"] = classify(full, rec["volza_supplier"], rec["shipments"], rec["suppliers"])
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()
            if i % 50 == 0:
                print(f"{i}/{len(todo)} calls={v.calls}", flush=True)
    print(f"finished, calls={v.calls}")


OVERVIEW_NAMES = ["Square Fashions", "Epyllion", "Ha-Meem"]


def cmd_overview(_: argparse.Namespace) -> None:
    v = Volza()
    out: dict[str, Any] = {}
    for name in OVERVIEW_NAMES:
        st, er = v.exports(name, n=5)
        sst, sr = v.search(name)
        ids = [pick(f, "volza_company_id", "company_id", "id") for f in items(sr)]
        out[name] = {"status": st, "summary": er.get("api_summary"), "top5": er.get("api_records"),
                     "pagination": er.get("api_pagination"), "search_status": sst, "search": items(sr)}
        buyer = pick((er.get("api_records") or [{}])[0], "buyer_name", "consignee_name")
        tests = {}
        if ids and ids[0]:
            tests["volza_company_id"] = v.exports(name, volza_company_id=[str(ids[0])])
            tests["volza_company_id_only"] = v.call("POST", "/bangladesh-exports", json={
                "hsn_code": HS, "volza_company_id": [str(ids[0])], "start_date": WINDOW[0],
                "end_date": WINDOW[1], "max_count_per_page": 1})
        if buyer:
            tests["consignee_name"] = v.exports(name, consignee_name=[buyer])
        tests["destination_country"] = v.exports(name, destination_country=["United States"])
        out[name]["filter_tests"] = {
            k: {"status": s, "shipments": shipments(r), "error": r.get("error") if isinstance(r, dict) else None}
            for k, (s, r) in tests.items()
        }
    RAW.mkdir(parents=True, exist_ok=True)
    OVERVIEWS.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"calls={v.calls} -> {OVERVIEWS}")


def cost_table(rmg: int, matched: int, ratios: dict[str, float]) -> str:
    """Real-fetch cost. Each supplier is tried name by name; a miss costs $0.10 (charged even
    with 0 results), a narrowing retry that hits costs $0.15, and the one kept call per matched
    supplier costs the option price. No companies/search: exports cannot filter by its IDs."""
    misses = (rmg - matched) * ratios["miss_per_unmatched"] + matched * ratios["miss_per_matched"]
    lost = misses * 0.10 + matched * ratios["extra_hit_per_matched"] * 0.15
    lines = ["| option | per matched supplier | fetch | name tries that miss or retry | +10% | total | left of $3,000 |",
             "| -- | -- | -- | -- | -- | -- | -- |"]
    for label, each in (("A: summary + top 1", 0.15), ("B: summary + top 3", 0.25), ("C: summary + top 10", 0.60)):
        sub = matched * each + lost
        lines.append(f"| {label} | ${each:.2f} | ${matched * each:,.2f} | ${lost:,.2f} "
                     f"| ${sub * 0.1:,.2f} | ${sub * 1.1:,.2f} | ${3000 - sub * 1.1:,.2f} |")
    return "\n".join(lines)


def cmd_summarize(_: argparse.Namespace) -> None:
    rows = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    recs = [json.loads(line) for line in MATCH.read_text(encoding="utf-8").splitlines()]
    by: dict[str, int] = {}
    for r in recs:
        by[r["class"]] = by.get(r["class"], 0) + 1
    matched = sum(1 for r in recs if r["shipments"])
    unmatched = [r for r in recs if not r["shipments"]]
    print(f"RMG {len(rows)}, checked {len(recs)}, matched {matched} ({matched / max(len(recs), 1):.1%})")
    print("classes", by)
    hits = [r for r in recs if r["shipments"]]
    print("export errors", sum(1 for r in recs for t in r["tried"] if t[1] != 200))
    print("matched on a later variant", sum(1 for r in hits if r["tried"][0][2] == 0))
    print("median shipments", sorted(r["shipments"] for r in hits)[matched // 2] if matched else 0)
    ratios = {
        "miss_per_unmatched": sum(len(r["tried"]) for r in unmatched) / max(len(unmatched), 1),
        "miss_per_matched": sum(1 for r in hits for t in r["tried"] if not t[2]) / max(matched, 1),
        "extra_hit_per_matched": sum(sum(1 for t in r["tried"] if t[2]) - 1 for r in hits) / max(matched, 1),
    }
    print({k: round(v, 3) for k, v in ratios.items()}, "\n")
    for label, rate in (("sandbox rate", matched / max(len(recs), 1)), ("if 60%", 0.6), ("if 80%", 0.8)):
        print(f"### {label}: {round(len(rows) * rate)} matched\n")
        print(cost_table(len(rows), round(len(rows) * rate), ratios) + "\n")
    sample = random.Random(20261010).sample(hits, min(50, matched))
    print("| class | our name | name searched | Volza supplier on top record | exporters swept in | shipments |")
    print("| -- | -- | -- | -- | -- | -- |")
    for r in sample:
        print(f"| {r['class']} | {r['name']} | {r['matched_variant']} | {r['volza_supplier']} "
              f"| {r['suppliers']} | {r['shipments']} |")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("candidates")
    m = sub.add_parser("match")
    m.add_argument("--limit", type=int, default=0, help="stop after N suppliers (0 = all)")
    sub.add_parser("overview")
    sub.add_parser("summarize")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    {"candidates": cmd_candidates, "match": cmd_match, "overview": cmd_overview,
     "summarize": cmd_summarize}[a.cmd](a)


if __name__ == "__main__":
    main()

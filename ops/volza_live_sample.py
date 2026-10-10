"""Live sample: the real Sep 2024 - Aug 2026 match rate on 200 random RMG suppliers.

Spends real Volza credit with the production key, so it runs only with --apply (the founder runs
it; the guard hook refuses --apply from an agent). Approved by the founder on 10 Oct 2026 for at
most $30, and never more than one shipment record per call.

Spend control: before every call, spent-so-far plus the worst case for one call ($0.10 search +
$0.05 x 1 record) must stay within --max-spend, or the run stops. Spent-so-far is the larger of
our own tally (Volza's published prices) and the rise in the account's X-Credit-Used header since
the run started (read first with a free sandbox call; without it, from zero, which overcounts).
A call whose header rise exceeds the worst case stops it, as do network and server errors, which
count as the worst case. No pagination is ever followed. Progress is saved per supplier, so a
rerun resumes and the spend from earlier runs still counts toward the cap.

  python ops/volza_live_sample.py              # what it would do; no key read, no calls
  python ops/volza_live_sample.py --apply      # run it (cap $30)
  python ops/volza_live_sample.py --summarize  # results, no calls
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import (  # noqa: E402
    BASE, CANDIDATES, HS, MIN_GAP, RAW, classify, cost_table, pick, shipments, summary_suppliers,
)

OUT = RAW / "live_sample.jsonl"
WINDOW = ("2024-09-01", "2026-08-31")  # the plan's two-year data period; live data ends 31 Aug 2026
SAMPLE = 200
SEED = 20261010
RECORDS = 1  # one shipment record per call, never the full list
WORST_CALL = 0.10 + 0.05 * RECORDS
CAP_LIMIT = 30.0  # the founder's approved ceiling; --max-spend cannot go above it


class Stop(Exception):
    pass


def production_key() -> str:
    key = os.environ.get("VOLZA_API_KEY")
    if not key and sys.platform == "win32":
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
            key = winreg.QueryValueEx(k, "VOLZA_API_KEY")[0]
    if not key:
        raise SystemExit("VOLZA_API_KEY is not set")
    return key


def account_used() -> float | None:
    """The account's X-Credit-Used now, read with a free sandbox call (the header is account-wide)."""
    from volza_export_dryrun import Volza as Sandbox

    try:  # countries/list carries no credit headers; a sandbox export query does, and is free
        r = Sandbox().http.post("/bangladesh-exports", json={
            "hsn_code": ["61"], "supplier_name": ["Square Fashions"], "start_date": "2021-01-01",
            "end_date": "2021-03-31", "max_count_per_page": 1})
        used = r.headers.get("X-Credit-Used")
        return float(used) if used is not None else None
    except (httpx.HTTPError, SystemExit):
        return None


class Live:
    def __init__(self, cap: float, spent_before: float, http: httpx.Client | None = None,
                 start_used: float | None = None) -> None:
        self.cap = cap
        self.tally = spent_before
        self.spent_before_run = spent_before
        self.header_spent = 0.0
        # the account's X-Credit-Used before this run (None: unknown, measured from zero)
        self.start_used = start_used
        self.prev_used: float | None = start_used
        self.http = http or httpx.Client(
            base_url=BASE, timeout=60, headers={"Authorization": f"Bearer {production_key()}"})
        self.last = 0.0
        self.calls = 0

    @property
    def spent(self) -> float:
        return max(self.tally, self.header_spent)

    def exports(self, name: str) -> tuple[int, Any, float]:
        body = {"hsn_code": HS, "supplier_name": [name], "start_date": WINDOW[0], "end_date": WINDOW[1],
                "max_count_per_page": RECORDS, "sort_by": "trade_value_usd", "sort_order": "DESC"}
        for _ in range(5):
            if self.spent + WORST_CALL > self.cap + 1e-9:
                raise Stop(f"cap reached: spent ${self.spent:.2f} of ${self.cap:.2f}")
            wait = MIN_GAP - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            try:
                r = self.http.post("/bangladesh-exports", json=body)
            except httpx.HTTPError as e:  # Volza may have billed it; count the worst case and stop
                self.tally += WORST_CALL
                raise Stop(f"network error, counted ${WORST_CALL:.2f} as spent: {type(e).__name__}") from e
            self.calls += 1
            self._read_headers(r)
            if r.status_code == 429:  # rate limit: not charged (Volza pricing docs)
                time.sleep(60)
                continue
            if r.status_code == 402:
                raise Stop("Volza says the credit is used up (402)")
            if r.status_code >= 500:  # billing unknown: count the worst case and stop, no blind retries
                self.tally += WORST_CALL
                raise Stop(f"Volza server error {r.status_code}, counted ${WORST_CALL:.2f} as spent")
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            recs = (data.get("api_records") or []) if isinstance(data, dict) else []
            if len(recs) > RECORDS:
                raise Stop(f"Volza returned {len(recs)} records for max_count_per_page={RECORDS}")
            cost = (0.10 + 0.05 * len(recs)) if r.status_code == 200 else 0.0  # 400s are free
            self.tally += cost
            return r.status_code, data, cost
        return 429, {}, 0.0

    def _read_headers(self, r: httpx.Response) -> None:
        used = r.headers.get("X-Credit-Used")
        if used is None:
            return
        used = float(used)
        if self.start_used is None:  # no pre-run reading: measure from the plan's untouched $3,000
            self.start_used = 0.0
        step = None if self.prev_used is None else used - self.prev_used
        self.prev_used = used
        self.header_spent = max(self.header_spent, self.spent_before_run + used - self.start_used)
        if step is not None and step > WORST_CALL + 0.001:  # recorded above first, then stop
            raise Stop(f"one call cost ${step:.3f}, above the ${WORST_CALL:.2f} "
                       "worst case; prices differ from the docs or someone else is spending")


def sample_rows() -> list[dict[str, Any]]:
    rows = [r for r in json.loads(CANDIDATES.read_text(encoding="utf-8")) if r["variants"]]
    return random.Random(SEED).sample(rows, SAMPLE)


def load() -> list[dict[str, Any]]:
    if not OUT.exists():
        return []
    return [json.loads(line) for line in OUT.read_text(encoding="utf-8").splitlines()]


def run(cap: float) -> None:
    done = load()
    seen = {r["id"] for r in done}
    todo = [r for r in sample_rows() if r["id"] not in seen]
    v = Live(cap, sum(r["cost"] for r in done), start_used=account_used())
    print(f"{len(done)} done, {len(todo)} to go, ${v.spent:.2f} already spent, cap ${cap:.2f}")
    try:
        with OUT.open("a", encoding="utf-8") as out:
            for r in todo:
                rec: dict[str, Any] = {"id": r["id"], "slug": r["slug"], "name": r["company_name"],
                                       "tried": [], "shipments": 0, "suppliers": 0, "cost": 0.0,
                                       "matched_variant": None, "volza_supplier": None, "top": None}

                def attempt(name: str) -> bool:
                    st, data, cost = v.exports(name)
                    rec["cost"] = round(rec["cost"] + cost, 3)
                    rec["tried"].append([name, st, shipments(data), summary_suppliers(data)])
                    if not shipments(data):
                        return False
                    top = (data.get("api_records") or [{}])[0]
                    s = data.get("api_summary") or {}
                    rec.update(shipments=shipments(data), suppliers=summary_suppliers(data),
                               matched_variant=name, volza_supplier=pick(top, "supplier_name"),
                               fob_usd=s.get("sum_of_trade_value_usd"), buyers=s.get("count_of_buyers"),
                               top={k: top.get(k) for k in ("shipment_date", "hsn_code", "product_description",
                                                            "buyer_name", "destination_country",
                                                            "trade_value_usd", "unit_rate_usd", "unit")})
                    return True

                try:
                    for name in r["variants"]:
                        if attempt(name):
                            break
                    # no full-legal-name retry for ambiguous names: 11 of 15 found nothing (report §2)
                finally:
                    if rec["tried"]:  # whatever was paid for is saved, even when the cap stops us mid-supplier
                        rec["class"] = classify(r["company_name"], rec["volza_supplier"],
                                                rec["shipments"], rec["suppliers"])
                        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                        out.flush()
    except Stop as e:
        print(f"STOPPED: {e}")
    print(f"calls={v.calls} spent: our tally ${v.tally:.2f}, by Volza's header ${v.header_spent:.2f}")
    summarize()


def summarize() -> None:
    recs = load()
    n = len(recs)
    if not n:
        print("no results yet")
        return
    hits = [r for r in recs if r["shipments"]]
    p = len(hits) / n
    half = 1.96 * math.sqrt(p * (1 - p) / n)
    by: dict[str, int] = {}
    for r in recs:
        by[r["class"]] = by.get(r["class"], 0) + 1
    print(f"checked {n}/{SAMPLE}, matched {len(hits)} = {p:.1%} (95% range {p - half:.1%} to {p + half:.1%})")
    print("classes", by, "| spent $", round(sum(r["cost"] for r in recs), 2))
    cands = {c["id"]: c for c in json.loads(CANDIDATES.read_text(encoding="utf-8"))}
    groups = {
        "all RMG": lambda c: True,
        "EPB 61/62": lambda c: c["epb_6162"],
        "no EPB 61/62": lambda c: not c["epb_6162"],
        "BGMEA": lambda c: c["bgmea"],
        "BKMEA": lambda c: c["bkmea"],
    }
    for label, keep in groups.items():
        g = [r for r in recs if keep(cands[r["id"]])]
        gh = [r for r in g if r["shipments"]]
        gp = len(gh) / max(len(g), 1)
        gh_half = 1.96 * math.sqrt(gp * (1 - gp) / max(len(g), 1))
        size = sum(1 for c in cands.values() if keep(c))
        print(f"\n### {label}: {len(gh)}/{len(g)} matched = {gp:.0%} ({gp - gh_half:.0%} to {gp + gh_half:.0%}), "
              f"{size} suppliers in the group")
        if label in ("all RMG", "EPB 61/62"):
            for end, rate in (("low", gp - gh_half), ("high", gp + gh_half)):
                print(f"\n{end} end, {round(size * rate)} matched, one call per supplier, no retries:\n")
                print(cost_table(size, round(size * rate), _ratios(g)))


def _ratios(recs: list[dict[str, Any]]) -> dict[str, float]:
    hits = [r for r in recs if r["shipments"]]
    unmatched = [r for r in recs if not r["shipments"]]
    return {  # retries are dropped from the real fetch, so only first-name misses count
        "miss_per_unmatched": 1.0 if unmatched else 0.0,
        "miss_per_matched": sum(1 for r in hits if not r["tried"][0][2]) / max(len(hits), 1),
        "extra_hit_per_matched": 0.0,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    p.add_argument("--max-spend", type=float, default=CAP_LIMIT)
    p.add_argument("--summarize", action="store_true")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if a.summarize:
        summarize()
    elif not a.apply:
        rows = sample_rows()
        calls = sum(len(r["variants"]) for r in rows)
        print(f"would check {len(rows)} suppliers, {calls} name tries at most, "
              f"window {WINDOW[0]}..{WINDOW[1]}, {RECORDS} record per call, worst case "
              f"${calls * WORST_CALL:.2f}, hard cap ${min(a.max_spend, CAP_LIMIT):.2f}. Pass --apply to run.")
    else:
        if a.max_spend > CAP_LIMIT:
            raise SystemExit(f"--max-spend above the approved ${CAP_LIMIT:.0f}; ask the founder first")
        run(a.max_spend)


if __name__ == "__main__":
    main()

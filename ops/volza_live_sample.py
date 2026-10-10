"""Live sample: the real Sep 2024 - Aug 2026 match rate on 200 random RMG suppliers.

Spends real Volza credit with the production key, so it runs only with --apply (the founder runs
it; the guard hook refuses --apply from an agent). Approved by the founder on 10 Oct 2026 for at
most $30, and never more than one shipment record per call.

Spend control: before every call, spent-so-far plus the worst case for one call ($0.10 search +
$0.05 x 1 record) must stay within --max-spend, or the run stops. Spent-so-far is the larger of
our own tally (Volza's published prices) and 3,000 minus the X-Credit-Remaining header (the plan
started at $3,000 with nothing used). A call that costs more than the worst case also stops it.
No pagination is ever followed. Progress is saved per supplier, so a rerun resumes and the
spend from earlier runs still counts toward the cap.

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
PLAN_CREDIT = 3000.0


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


class Live:
    def __init__(self, cap: float, spent_before: float, http: httpx.Client | None = None) -> None:
        self.cap = cap
        self.tally = spent_before
        self.header_spent = 0.0
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
            r = self.http.post("/bangladesh-exports", json=body)
            self.calls += 1
            if r.status_code in (429, 500, 502, 503, 504):  # not charged (Volza pricing docs)
                time.sleep(60 if r.status_code == 429 else 10)
                continue
            if r.status_code == 402:
                raise Stop("Volza says the credit is used up (402)")
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            recs = data.get("api_records") or [] if isinstance(data, dict) else []
            if len(recs) > RECORDS:
                raise Stop(f"Volza returned {len(recs)} records for max_count_per_page={RECORDS}")
            cost = (0.10 + 0.05 * len(recs)) if r.status_code == 200 else 0.0  # 400s are free
            self.tally += cost
            remaining = r.headers.get("X-Credit-Remaining")
            if remaining is not None:
                before = self.header_spent
                self.header_spent = max(self.header_spent, PLAN_CREDIT - float(remaining))
                if self.header_spent - before > WORST_CALL + 0.001 and before > 0:
                    raise Stop(f"one call cost ${self.header_spent - before:.3f}, above the "
                               f"${WORST_CALL:.2f} worst case; prices differ from the docs")
            return r.status_code, data, cost
        return 429, {}, 0.0


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
    v = Live(cap, sum(r["cost"] for r in done))
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
                    full = (r["company_name"] or "").strip()
                    if rec["suppliers"] > 1 and full.lower() != (rec["matched_variant"] or "").lower():
                        attempt(full)
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
    unmatched = [r for r in recs if not r["shipments"]]
    ratios = {
        "miss_per_unmatched": sum(len(r["tried"]) for r in unmatched) / max(len(unmatched), 1),
        "miss_per_matched": sum(1 for r in hits for t in r["tried"] if not t[2]) / max(len(hits), 1),
        "extra_hit_per_matched": sum(sum(1 for t in r["tried"] if t[2]) - 1 for r in hits) / max(len(hits), 1),
    }
    rmg = len(json.loads(CANDIDATES.read_text(encoding="utf-8")))
    for label, rate in (("low end", p - half), ("sample rate", p), ("high end", p + half)):
        print(f"\n### {label}: {round(rmg * rate)} of {rmg} matched\n")
        print(cost_table(rmg, round(rmg * rate), ratios))


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
        print(f"would check {len(rows)} suppliers, {calls} name tries at most before narrowing retries, "
              f"window {WINDOW[0]}..{WINDOW[1]}, {RECORDS} record per call, worst case "
              f"${calls * WORST_CALL:.2f}, hard cap ${min(a.max_spend, CAP_LIMIT):.2f}. Pass --apply to run.")
    else:
        if a.max_spend > CAP_LIMIT:
            raise SystemExit(f"--max-spend above the approved ${CAP_LIMIT:.0f}; ask the founder first")
        run(a.max_spend)


if __name__ == "__main__":
    main()

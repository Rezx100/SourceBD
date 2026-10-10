"""Free scan: which non-EPB garment suppliers are on Volza's company list, and under what spelling?

Sandbox key only, companies/search only (no export searches, no credit). The output is the
shortlist for a later paid batch. Report: ops/plans/volza-export-dry-run.md section 10.

  scan     1,000 non-EPB published suppliers not in the 200-supplier sample, fixed random order
           (SEED), resumable; stops for the day when fewer than FLOOR calls remain
  sample   the same lookup for the non-EPB sample suppliers the list found in section 9, to test
           free signals (list IDs, entry counts) against what the paid search really found
  summary  classes, call counts, hand-check rows, signal table

Per supplier, at most MAX_CALLS lookups, stopping once our name is found:
  starts-with on the cleaned name; contains on it; then contains on our other names and spelling
  variants (& / and, Inds -> Industries, Mfg -> Manufacturing, Knit Wear / Knitwear, hyphen and
  full-stop forms). Classes: exact (normalizes equal), close (ratio >= 90 after normalizing),
  several (ours is found, and 2+ different companies contain the cleaned name, so a contains
  export search would mix them), other (list answered, none of it ours), not listed.

  python ops/volza_company_list.py scan|sample|summary
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import sys
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import CANDIDATES, RAW, Volza  # noqa: E402
from volza_live_sample import OUT as LIVE  # noqa: E402

from etl.core.normalize import _ABBREV_RULES, normalize_company_name  # noqa: E402

SEED = 20261011
SIZE = 1000
MAX_CALLS = 4
FLOOR = 20
CLOSE = 90
SCAN = RAW / "company_list.jsonl"
SAMPLE = RAW / "company_list_sample.jsonl"
TEST = RAW / "directory_test.jsonl"


def spellings(name: str) -> list[str]:
    """Spelling variants the paid search is known to miss: '&' vs 'and', abbreviations, hyphens."""
    n = re.sub(r"^\d+\)\s*", "", name)  # "1046) A.M. Fashion": a member number left in the name
    out = [n]
    out.append(re.sub(r"\s*&\s*", " and ", n) if "&" in n else re.sub(r"\band\b", "&", n, flags=re.I))
    expanded = n
    for pat, repl in _ABBREV_RULES:
        expanded = pat.sub(repl.title(), expanded)
    out += [expanded, n.replace("-", " "), n.replace("-", ""), re.sub(r"\.\s*", "", n)]
    return out


def queries(row: dict[str, Any]) -> list[tuple[str, str]]:
    first, *rest = row["variants"]
    plan = [(first, "start_with"), (first, "contains")]
    for v in [first, *rest]:
        for s in [v, *spellings(v)]:
            s = re.sub(r"\s+", " ", s).strip()
            if len(re.sub(r"[^A-Za-z0-9]", "", s)) >= 4 and (s.lower(), "contains") not in {(q.lower(), m) for q, m in plan}:
                plan.append((s, "contains"))
    return plan


def lookup(v: Volza, name: str, mode: str) -> dict[str, Any]:
    params = {"company_name": name, "country": "Bangladesh", "page_size": 50}
    if mode == "contains":
        params["company_name_match_type"] = "contains"
    st, r = v.call("GET", "/companies/search", params=params)
    r = r if isinstance(r, dict) else {}
    echo = (r.get("api_request_details") or {}).get("company_name_operator")
    recs = [[x.get("company_name") or "", x.get("volza_company_id")] for x in r.get("records") or []]
    return {"q": name, "mode": mode, "echo": echo, "status": st,
            "total": (r.get("api_summary") or {}).get("total_matches") or len(recs), "records": recs}


def clusters(names: list[str]) -> list[str]:
    reps: list[str] = []
    for n in names:
        if not any(fuzz.ratio(n, r) >= CLOSE for r in reps):
            reps.append(n)
    return reps


def classify(row: dict[str, Any], looks: list[dict[str, Any]]) -> dict[str, Any]:
    ours = {normalize_company_name(n) for n in [row["company_name"], row.get("name_display"),
                                                *(row.get("scraped_names") or [])] if n} - {""}
    recs = {i: n for lk in looks for n, i in lk["records"]}
    norm = {i: normalize_company_name(n) for i, n in recs.items()}
    exact = [i for i, n in norm.items() if n in ours]
    close = [i for i, n in norm.items() if i not in exact and max(fuzz.ratio(n, o) for o in ours) >= CLOSE]
    key = normalize_company_name(row["variants"][0])
    sweep = clusters(sorted({n for n in norm.values() if key and key in n}))
    cls = ("several" if (exact or close) and len(sweep) > 1 else "exact" if exact else "close" if close
           else "other" if recs else "not listed")
    mine = exact or close
    return {"class": cls, "volza_spellings": sorted({recs[i] for i in mine})[:8], "ids": sorted(mine),
            "entries": len(mine), "sweep": sweep[:8], "found_by": next(
                (f"{lk['mode']}:{lk['q']}" for lk in looks if any(i in mine for _, i in lk["records"])), None)}


def check(v: Volza, row: dict[str, Any]) -> dict[str, Any]:
    looks: list[dict[str, Any]] = []
    for q, mode in queries(row)[:MAX_CALLS]:
        looks.append(lookup(v, q, mode))
        if classify(row, looks)["class"] in ("exact", "close", "several"):
            break
    return {"id": row["id"], "slug": row["slug"], "name": row["company_name"], **classify(row, looks), "lookups": looks}


def run(rows: list[dict[str, Any]], path: Path) -> None:
    done = {json.loads(x)["id"] for x in path.read_text(encoding="utf-8").splitlines()} if path.exists() else set()
    todo = [r for r in rows if r["id"] not in done]
    print(f"{len(done)} done, {len(todo)} to go")
    v = Volza()
    with path.open("a", encoding="utf-8") as out:
        for r in todo:
            if v.remaining_daily < FLOOR + MAX_CALLS:
                print(f"STOP for today: {v.remaining_daily} calls left (floor {FLOOR}); resume tomorrow")
                break
            out.write(json.dumps(check(v, r), ensure_ascii=False) + "\n")
            out.flush()
    print(f"calls {v.calls}, left today {v.remaining_daily}, credit {v.baseline} (unchanged)")


def pick() -> list[dict[str, Any]]:
    """Non-EPB, published (candidates are), not in the 200-supplier sample, seeded order."""
    seen = {json.loads(x)["id"] for x in LIVE.read_text(encoding="utf-8").splitlines()}
    rows = [r for r in json.loads(CANDIDATES.read_text(encoding="utf-8"))
            if not r["epb_6162"] and r["variants"] and r["id"] not in seen]
    rows.sort(key=lambda r: r["id"])
    random.Random(SEED).shuffle(rows)
    return rows[:SIZE]


def sample_rows() -> list[dict[str, Any]]:
    listed = {json.loads(x)["id"] for x in TEST.read_text(encoding="utf-8").splitlines() if json.loads(x)["listed"]}
    return [r for r in json.loads(CANDIDATES.read_text(encoding="utf-8")) if r["id"] in listed and not r["epb_6162"]]


def load(path: Path) -> list[dict[str, Any]]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()] if path.exists() else []


def cmd_summary(_: argparse.Namespace) -> None:
    recs = load(SCAN)
    by: dict[str, int] = {}
    for r in recs:
        by[r["class"]] = by.get(r["class"], 0) + 1
    calls = [len(r["lookups"]) for r in recs]
    print(f"scanned {len(recs)} of {SIZE} (seed {SEED}); classes {by}; calls {sum(calls)} "
          f"({sum(calls) / max(len(recs), 1):.2f} a supplier); errors "
          f"{sum(1 for r in recs for lk in r['lookups'] if lk['status'] != 200)}; contains echoed "
          f"{sum(1 for r in recs for lk in r['lookups'] if lk['mode'] == 'contains' and lk['echo'] != 'contains')} wrong")
    found = [r for r in recs if r["class"] in ("exact", "close", "several")]
    how: dict[str, int] = {}
    for r in found:
        k = "starts-with" if r["found_by"].startswith("start_with") else (
            "contains, same name" if r["found_by"].split(":", 1)[1] == r["lookups"][0]["q"] else "contains, other spelling")
        how[k] = how.get(k, 0) + 1
    print("found by", how)
    rnd = random.Random(SEED)
    for cls, n in (("close", 30), ("several", 20)):
        rows = [r for r in recs if r["class"] == cls]
        print(f"\n{cls}: hand check {min(n, len(rows))} of {len(rows)}")
        for r in rnd.sample(rows, min(n, len(rows))):
            print(f"  {r['name']!r} -> {r['volza_spellings'][:3]} | sweep {r['sweep'][:4]}")
    live = {json.loads(x)["id"]: json.loads(x)["shipments"] for x in LIVE.read_text(encoding="utf-8").splitlines()}
    print("\nsample signal test (non-EPB, listed in section 9): shipped? class entries min_id")
    for r in sorted(load(SAMPLE), key=lambda r: -live[r["id"]]):
        print(f"  {live[r['id']]:>5} {r['class']:<10} {r['entries']:>3} {min(r['ids'], default='-')!s:>10} {r['name']}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["scan", "sample", "summary"])
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if a.cmd == "scan":
        run(pick(), SCAN)
    elif a.cmd == "sample":
        run(sample_rows(), SAMPLE)
    else:
        cmd_summary(a)


if __name__ == "__main__":
    main()

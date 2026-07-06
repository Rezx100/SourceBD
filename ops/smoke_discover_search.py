#!/usr/bin/env python3
"""Smoke Discover text search via PostgREST (production path)."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request


def probe(label: str, body: dict) -> bool:
    rest = (
        os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
        + "/rest/v1/rpc/discover_suppliers"
    )
    key = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    req = urllib.request.Request(
        rest,
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
            total = data[0].get("total_count") if data else 0
            print(
                f"OK  {label}: {time.time() - t0:.2f}s "
                f"rows={len(data)} total={total}"
            )
            return True
    except urllib.error.HTTPError as exc:
        print(
            f"FAIL {label}: {time.time() - t0:.2f}s "
            f"{exc.read().decode()[:400]}",
            file=sys.stderr,
        )
        return False


def main() -> None:
    for key in ("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"):
        if not os.environ.get(key):
            raise SystemExit(f"{key} not set")

    ok = True
    ok &= probe(
        "browse",
        {"p_sort": "default", "p_limit": 24, "p_offset": 0},
    )
    for term in ("denim", "knitwear", "t-shirt"):
        ok &= probe(
            term,
            {
                "p_q": term,
                "p_sort": "default",
                "p_limit": 24,
                "p_offset": 0,
            },
        )
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()

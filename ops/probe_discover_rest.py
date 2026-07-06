#!/usr/bin/env python3
"""Time discover_suppliers via Supabase REST (PostgREST timeout path)."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


def main() -> None:
    rest = (
        os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
        + "/rest/v1/rpc/discover_suppliers"
    )
    key = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    body = json.dumps({"p_sort": "default", "p_limit": 24, "p_offset": 0}).encode()
    req = urllib.request.Request(
        rest,
        data=body,
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
            print(f"REST OK in {time.time() - t0:.2f}s, rows={len(data)}")
    except urllib.error.HTTPError as exc:
        print(f"REST FAIL in {time.time() - t0:.2f}s: {exc.read().decode()[:400]}")


if __name__ == "__main__":
    main()

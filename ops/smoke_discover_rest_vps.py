#!/usr/bin/env python3
import json
import os
import time
import urllib.error
import urllib.request

rest = (
    os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    + "/rest/v1/rpc/discover_suppliers"
)
key = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
cases = [
    ("browse", {"p_sort": "default", "p_limit": 24, "p_offset": 0}),
    ("denim", {"p_q": "denim", "p_sort": "default", "p_limit": 24, "p_offset": 0}),
    ("knitwear", {"p_q": "knitwear", "p_sort": "default", "p_limit": 24, "p_offset": 0}),
    ("t-shirt", {"p_q": "t-shirt", "p_sort": "default", "p_limit": 24, "p_offset": 0}),
]
for label, body in cases:
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
                f"{label}: OK {time.time() - t0:.2f}s "
                f"rows={len(data)} total={total}"
            )
    except urllib.error.HTTPError as exc:
        print(
            f"{label}: FAIL {time.time() - t0:.2f}s "
            f"{exc.read().decode()[:240]}"
        )

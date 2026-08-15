#!/usr/bin/env python3
"""Retry GET until HTTP 200. Used by GitHub Deploy Production public smoke."""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request


def should_retry(status: int | None, error: BaseException | None) -> bool:
    if status is not None:
        return status >= 500 or status in {408, 429}
    return error is not None


def wait_for_http_ok(url: str, attempts: int, sleep_s: float, timeout_s: float) -> int:
    last = "no attempts"
    for attempt in range(1, attempts + 1):
        status: int | None = None
        err: BaseException | None = None
        try:
            with urllib.request.urlopen(url, timeout=timeout_s) as resp:
                status = int(resp.status)
                body = resp.read().decode("utf-8", errors="replace")
                if status == 200:
                    sys.stdout.write(body if body.endswith("\n") else body + "\n")
                    return 0
                last = f"HTTP {status}"
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            err = exc
            last = f"HTTP {status}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            err = exc
            last = str(exc)
        if attempt >= attempts or not should_retry(status, err):
            break
        print(f"Health not ready ({last}, attempt {attempt}/{attempts}), retrying in {sleep_s}s...", file=sys.stderr)
        time.sleep(sleep_s)
    print(f"Public health still failing after {attempts} attempts at {url}: {last}", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--sleep", type=float, default=5)
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args(argv)
    if args.attempts < 1:
        print("--attempts must be >= 1", file=sys.stderr)
        return 2
    return wait_for_http_ok(args.url, args.attempts, args.sleep, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())

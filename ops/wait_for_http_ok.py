#!/usr/bin/env python3
"""Retry GET until HTTP 200. Used by GitHub Deploy Production public smoke."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def should_retry(status: int | None, error: BaseException | None, commit_mismatch: bool) -> bool:
    if commit_mismatch:
        return True
    if status is not None:
        return status >= 500 or status in {408, 429}
    return error is not None


def commit_from_health_body(body: str) -> str | None:
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    commit = data.get("commit")
    return commit if isinstance(commit, str) and commit else None


def wait_for_http_ok(
    url: str,
    attempts: int,
    sleep_s: float,
    timeout_s: float,
    expect_commit: str | None = None,
) -> int:
    last = "no attempts"
    for attempt in range(1, attempts + 1):
        status: int | None = None
        err: BaseException | None = None
        commit_mismatch = False
        try:
            with urllib.request.urlopen(url, timeout=timeout_s) as resp:
                status = int(resp.status)
                body = resp.read().decode("utf-8", errors="replace")
                if status == 200:
                    if expect_commit:
                        got = commit_from_health_body(body)
                        if got != expect_commit:
                            commit_mismatch = True
                            last = f"commit {got!r} != {expect_commit!r}"
                        else:
                            sys.stdout.write(body if body.endswith("\n") else body + "\n")
                            return 0
                    else:
                        sys.stdout.write(body if body.endswith("\n") else body + "\n")
                        return 0
                else:
                    last = f"HTTP {status}"
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            err = exc
            last = f"HTTP {status}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            err = exc
            last = str(exc)
        if attempt >= attempts or not should_retry(status, err, commit_mismatch):
            break
        print(
            f"Health not ready ({last}, attempt {attempt}/{attempts}), retrying in {sleep_s}s...",
            file=sys.stderr,
        )
        time.sleep(sleep_s)
    print(f"Public health still failing after {attempts} attempts at {url}: {last}", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--sleep", type=float, default=5)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument(
        "--expect-commit",
        default=None,
        help="Require /api/health JSON commit to match this SHA (stale 200 is not success).",
    )
    args = parser.parse_args(argv)
    if args.attempts < 1:
        print("--attempts must be >= 1", file=sys.stderr)
        return 2
    return wait_for_http_ok(
        args.url,
        args.attempts,
        args.sleep,
        args.timeout,
        expect_commit=args.expect_commit or None,
    )


if __name__ == "__main__":
    raise SystemExit(main())

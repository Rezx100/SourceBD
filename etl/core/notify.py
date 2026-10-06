"""Soft-fail Slack post to the ETL channel (Python twin of ops/slack_notify.sh)."""
from __future__ import annotations

import os

import httpx

from etl.core.logging import get_logger

log = get_logger("etl.notify")


def slack(text: str) -> None:
    """Post to SLACK_WEBHOOK_ETL. No webhook or a failed post never raises."""
    url = os.environ.get("SLACK_WEBHOOK_ETL", "").strip().strip('"')
    if not url:
        return
    try:
        httpx.post(url, json={"text": text}, timeout=10).raise_for_status()
    except Exception as exc:  # noqa: BLE001
        log.warning("slack.post_failed", error=str(exc))

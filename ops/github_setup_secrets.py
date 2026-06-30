#!/usr/bin/env python3
"""One-time GitHub repo setup: Actions secrets + production environment.

Reads GITHUB_TOKEN from the environment. Never commit tokens.
Usage: GITHUB_TOKEN=ghp_... python ops/github_setup_secrets.py
"""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = "Rezx100/SourceBD"
API = "https://api.github.com"


def api(method: str, path: str, body: dict | None = None) -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("GITHUB_TOKEN not set")
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        sys.exit(f"GitHub API {method} {path} failed ({e.code}): {err}")


def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    try:
        from nacl import encoding, public
    except ImportError as e:
        sys.exit(f"PyNaCl required: pip install PyNaCl ({e})")

    key = public.PublicKey(public_key_b64.encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(key).encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(sealed).decode("utf-8")


def put_secret(name: str, value: str) -> None:
    pk = api("GET", f"/repos/{REPO}/actions/secrets/public-key")
    encrypted = encrypt_secret(pk["key"], value)
    api(
        "PUT",
        f"/repos/{REPO}/actions/secrets/{name}",
        {
            "encrypted_value": encrypted,
            "key_id": pk["key_id"],
        },
    )
    print(f"  secret set: {name}")


def ensure_production_environment() -> None:
    # Minimal env — required reviewers need GitHub Team/Enterprise; add via UI if needed.
    try:
        api("PUT", f"/repos/{REPO}/environments/production", {})
        print("  environment: production")
    except SystemExit as e:
        print(f"  environment skipped: {e}")


def protect_main_branch() -> None:
    # Try with CI check; fall back without contexts until first CI run completes.
    for contexts in (["verify"], []):
        body = {
            "required_status_checks": {
                "strict": True,
                "contexts": contexts,
            },
            "enforce_admins": False,
            "required_pull_request_reviews": {
                "dismiss_stale_reviews": True,
                "require_code_owner_reviews": False,
                "required_approving_review_count": 1,
            },
            "restrictions": None,
            "allow_force_pushes": False,
            "allow_deletions": False,
            "required_conversation_resolution": True,
        }
        try:
            api("PUT", f"/repos/{REPO}/branches/main/protection", body)
            label = "main" + (f" (CI: {contexts[0]})" if contexts else " (no CI gate yet)")
            print(f"  branch protection: {label}")
            return
        except SystemExit:
            continue
    print("  branch protection: failed — configure manually in GitHub UI")


def main() -> None:
    ssh_key_path = Path.home() / ".ssh" / "sourcebd_vps"
    secrets = {
        "VPS_HOST": "109.104.153.228",
        "VPS_USER": "root",
        "VPS_APP_DIR": "/opt/sourcebd",
    }
    if ssh_key_path.is_file():
        secrets["VPS_SSH_PRIVATE_KEY"] = ssh_key_path.read_text(encoding="utf-8")
    else:
        print(f"  warn: {ssh_key_path} missing — skip VPS_SSH_PRIVATE_KEY")

    print("Setting GitHub Actions secrets...")
    for name, value in secrets.items():
        put_secret(name, value)

    print("Configuring production environment...")
    ensure_production_environment()

    print("Configuring branch protection...")
    protect_main_branch()

    print("Done.")


if __name__ == "__main__":
    main()

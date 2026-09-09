"""Expired HTTPS PATs in origin must not win over a job token."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "ops" / "github_https_fetch_auth.sh"
GHA_SCRIPT = ROOT / "ops" / "gha_vps_deploy.sh"


def _function_body(text: str) -> str:
    start = text.index("sourcebd_prepare_github_https_fetch() {")
    end = text.index("\n}", start) + 2
    return text[start:end]


def test_gha_remote_script_embeds_the_same_fetch_auth_function() -> None:
    helper = _function_body(HELPER.read_text(encoding="utf-8"))
    embedded = _function_body(GHA_SCRIPT.read_text(encoding="utf-8"))
    assert helper == embedded


def _clean_git_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    merged = os.environ.copy()
    for key in (
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_SYSTEM",
    ):
        merged.pop(key, None)
    merged["GIT_CONFIG_GLOBAL"] = "/dev/null"
    merged["GIT_CONFIG_SYSTEM"] = "/dev/null"
    if extra:
        merged.update(extra)
    return merged


def _run_prepare(repo: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    script = f"""
set -Eeuo pipefail
. {HELPER}
cd {repo}
sourcebd_prepare_github_https_fetch
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'COUNT=%s\\n' "${{GIT_CONFIG_COUNT-}}"
printf 'KEY=%s\\n' "${{GIT_CONFIG_KEY_0-}}"
printf 'VALUE=%s\\n' "${{GIT_CONFIG_VALUE_0-}}"
"""
    return subprocess.run(
        ["bash", "-c", script],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(env),
        cwd=repo,
    )


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
    )


def test_strips_expired_https_userinfo_and_does_not_write_token_into_origin(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(
        repo,
        "remote",
        "add",
        "origin",
        "https://x-access-token:expired-pat@github.com/Rezx100/SourceBD.git",
    )
    result = _run_prepare(repo, {"GITHUB_TOKEN": "ghs_fresh_job_token"})
    assert result.returncode == 0, result.stderr
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["ORIGIN"]
    assert "ghs_fresh_job_token" not in lines["ORIGIN"]
    assert lines["KEY"] == "http.https://github.com/.extraheader"
    assert lines["VALUE"].startswith("AUTHORIZATION: basic ")
    assert "ghs_fresh_job_token" not in lines["VALUE"]
    import base64

    decoded = base64.b64decode(lines["VALUE"].split(" ", 2)[2]).decode()
    assert decoded == "x-access-token:ghs_fresh_job_token"


def test_leaves_ssh_origin_and_skips_without_token(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    ssh_url = "git@github.com:Rezx100/SourceBD.git"
    _git(repo, "remote", "add", "origin", ssh_url)

    skipped = _run_prepare(repo, {})
    assert skipped.returncode == 0, skipped.stderr
    lines = dict(ln.split("=", 1) for ln in skipped.stdout.strip().splitlines())
    assert lines["ORIGIN"] == ssh_url
    assert lines["COUNT"] == ""
    assert lines["VALUE"] == ""

    with_token = _run_prepare(repo, {"GITHUB_TOKEN": "ghs_fresh_job_token"})
    assert with_token.returncode == 0, with_token.stderr
    lines = dict(ln.split("=", 1) for ln in with_token.stdout.strip().splitlines())
    assert lines["ORIGIN"] == ssh_url
    assert lines["KEY"] == "http.https://github.com/.extraheader"


def test_gha_remote_script_refuses_to_run_without_a_job_token(
    tmp_path: Path,
) -> None:
    result = subprocess.run(
        ["bash", str(GHA_SCRIPT)],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        cwd=tmp_path,
    )
    assert result.returncode == 1
    assert "GITHUB_TOKEN missing" in result.stderr

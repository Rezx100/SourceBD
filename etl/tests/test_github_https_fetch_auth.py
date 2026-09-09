"""Expired HTTPS PATs in origin must not win over a job token."""

from __future__ import annotations

import base64
import os
import stat
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "ops" / "github_https_fetch_auth.sh"
GHA_SCRIPT = ROOT / "ops" / "gha_vps_deploy.sh"

SED = r"s#https://[^/@]+@github\.com/#https://github.com/#"
EXTRAHEADER = "http.https://github.com/.extraheader"


def test_gha_remote_script_keeps_the_same_fetch_rewrites_as_the_helper() -> None:
    helper = HELPER.read_text(encoding="utf-8")
    remote = GHA_SCRIPT.read_text(encoding="utf-8")
    assert SED in helper
    assert SED in remote
    assert EXTRAHEADER in helper
    assert EXTRAHEADER in remote
    assert "GIT_CONFIG_GLOBAL=/dev/null" in helper
    assert "GIT_CONFIG_GLOBAL=/dev/null" in remote
    assert "credential.helper" in helper
    assert "credential.helper" in remote
    assert "safe.directory" in helper
    assert "safe.directory" in remote
    assert "GIT_CONFIG_COUNT=3" in helper
    assert "GIT_CONFIG_COUNT=3" in remote
    assert "GIT_CONFIG_COUNT=1" in helper
    assert "GIT_CONFIG_COUNT=1" in remote
    assert "unset-all http.https://github.com/.extraheader" in helper
    assert "unset-all http.https://github.com/.extraheader" in remote
    assert "unset-all http.extraHeader" in helper
    assert "unset-all http.extraHeader" in remote
    assert "unset-all credential.helper" in helper
    assert "unset-all credential.helper" in remote
    assert 'bash ops/deploy_vps.sh --ref="${DEPLOY_REF}" --require-git' in remote


def _first_code_index(text: str, needle: str) -> int:
    for i, line in enumerate(text.splitlines()):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if needle in line:
            return i
    raise AssertionError(f"missing {needle!r}")


def test_scripts_export_safe_directory_before_any_local_git_config() -> None:
    for path in (HELPER, GHA_SCRIPT):
        text = path.read_text(encoding="utf-8")
        count1_i = _first_code_index(text, "GIT_CONFIG_COUNT=1")
        safe_i = _first_code_index(text, 'GIT_CONFIG_KEY_0="safe.directory"')
        star_i = _first_code_index(text, 'GIT_CONFIG_VALUE_0="*"')
        local_i = _first_code_index(text, "git config --local")
        remote_i = _first_code_index(text, "git remote set-url")
        extra_i = _first_code_index(text, "http.https://github.com/.extraheader")
        assert count1_i < local_i, path.name
        assert safe_i < local_i < extra_i, path.name
        assert star_i < local_i, path.name
        assert safe_i < remote_i, path.name


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
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_KEY_0",
        "GIT_CONFIG_VALUE_0",
        "GIT_CONFIG_KEY_1",
        "GIT_CONFIG_VALUE_1",
        "GIT_CONFIG_KEY_2",
        "GIT_CONFIG_VALUE_2",
        "APP_DIR",
        "DEPLOY_REF",
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
printf 'GLOBAL=%s\\n' "${{GIT_CONFIG_GLOBAL-}}"
printf 'HELPER=%s\\n' "${{GIT_CONFIG_VALUE_1-}}"
printf 'SAFE=%s\\n' "${{GIT_CONFIG_VALUE_2-}}"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
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
    assert lines["KEY"] == EXTRAHEADER
    assert lines["VALUE"].startswith("AUTHORIZATION: basic ")
    assert "ghs_fresh_job_token" not in lines["VALUE"]
    decoded = base64.b64decode(lines["VALUE"].split(" ", 2)[2]).decode()
    assert decoded == "x-access-token:ghs_fresh_job_token"
    assert lines["GLOBAL"] == "/dev/null"
    assert lines["COUNT"] == "3"
    assert lines["SAFE"] == "*"
    assert lines["EXTRA_N"].strip() == "1"
    assert "store" not in lines["HELPERS"]


def test_unsets_local_insteadof_that_rewrites_github_to_an_expired_pat(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _git(
        repo,
        "config",
        "--local",
        "url.https://x-access-token:expired-pat@github.com/.insteadof",
        "https://github.com/",
    )
    result = _run_prepare(repo, {"GITHUB_TOKEN": "ghs_fresh_job_token"})
    assert result.returncode == 0, result.stderr
    leftover = subprocess.run(
        ["git", "config", "--local", "--get-regexp", r"^url\..*\.insteadof$"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover.stdout.strip() == ""
    assert "expired-pat" not in leftover.stdout


def _plant_expired_github_http_overrides(repo: Path) -> None:
    _git(
        repo,
        "config",
        "--local",
        "http.https://github.com/.extraheader",
        "AUTHORIZATION: basic expiredlocal",
    )
    _git(
        repo,
        "config",
        "--local",
        "http.extraHeader",
        "AUTHORIZATION: basic expiredgeneric",
    )
    _git(repo, "config", "--local", "credential.helper", "store")
    _git(
        repo,
        "config",
        "--local",
        "credential.https://github.com/.helper",
        "store",
    )


def test_prepare_drops_leftover_extraheader_and_store_helper(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _plant_expired_github_http_overrides(repo)
    result = _run_prepare(repo, {"GITHUB_TOKEN": "ghs_fresh_job_token"})
    assert result.returncode == 0, result.stderr
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["EXTRA_N"].strip() == "1"
    assert "expiredlocal" not in lines.get("VALUE", "")
    decoded = base64.b64decode(lines["VALUE"].split(" ", 2)[2]).decode()
    assert decoded == "x-access-token:ghs_fresh_job_token"
    assert "store" not in lines["HELPERS"]
    leftover_extra = subprocess.run(
        ["git", "config", "--local", "--get-all", EXTRAHEADER],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover_extra.stdout.strip() == ""
    leftover_helper = subprocess.run(
        ["git", "config", "--local", "--get-all", "credential.helper"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover_helper.stdout.strip() == ""
    leftover_url_helper = subprocess.run(
        ["git", "config", "--local", "--get-all", "credential.https://github.com/.helper"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover_url_helper.stdout.strip() == ""
    leftover_generic = subprocess.run(
        ["git", "config", "--local", "--get-all", "http.extraHeader"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover_generic.stdout.strip() == ""


def test_long_job_token_base64_has_no_newline(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    token = "ghs_" + ("a" * 200)
    result = _run_prepare(repo, {"GITHUB_TOKEN": token})
    assert result.returncode == 0, result.stderr
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    b64 = lines["VALUE"].split(" ", 2)[2]
    assert "\n" not in b64
    assert base64.b64decode(b64).decode() == f"x-access-token:{token}"


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
    assert lines["KEY"] == EXTRAHEADER


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


def test_gha_entrypoint_prepares_fetch_when_vps_helper_file_is_missing(
    tmp_path: Path,
) -> None:
    """First deploy: VPS still has old deploy_vps.sh and no helper file."""
    app = tmp_path / "opt" / "sourcebd"
    app.mkdir(parents=True)
    _git(app, "init")
    _git(
        app,
        "remote",
        "add",
        "origin",
        "https://x-access-token:expired-pat@github.com/Rezx100/SourceBD.git",
    )
    _git(
        app,
        "config",
        "--local",
        "url.https://x-access-token:expired-pat@github.com/.insteadof",
        "https://github.com/",
    )
    _plant_expired_github_http_overrides(app)
    ops = app / "ops"
    ops.mkdir()
    fake = ops / "deploy_vps.sh"
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'KEY=%s\\n' "${GIT_CONFIG_KEY_0-}"
printf 'GLOBAL=%s\\n' "${GIT_CONFIG_GLOBAL-}"
printf 'HAS_AUTH=%s\\n' "$(printf '%s' "${GIT_CONFIG_VALUE_0-}" | grep -c 'AUTHORIZATION: basic' || true)"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'GENERIC=%s\\n' "$(git config --get-all http.extraHeader 2>/dev/null || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
printf 'URLHELP=%s\\n' "$(git config --get-all credential.https://github.com/.helper 2>/dev/null || true)"
printf 'SAFE=%s\\n' "${GIT_CONFIG_VALUE_2-}"
printf 'REF=%s\\n' "${1-}"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_LEFTOVER=%s\\n' "$(grep -c expiredlocal trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    assert not (ops / "github_https_fetch_auth.sh").exists()
    pinned = "273e86778f95b143bfa694aacbc92ecabf5ee591"

    result = subprocess.run(
        ["bash", str(GHA_SCRIPT)],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(
            {
                "GITHUB_TOKEN": "ghs_fresh_job_token",
                "APP_DIR": str(app),
                "DEPLOY_REF": pinned,
            }
        ),
        cwd=tmp_path,
        timeout=45,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["ORIGIN"]
    assert "ghs_fresh_job_token" not in lines["ORIGIN"]
    assert lines["KEY"] == EXTRAHEADER
    assert lines["GLOBAL"] == "/dev/null"
    assert lines["HAS_AUTH"] == "1"
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["GENERIC"] == ""
    assert "store" not in lines["HELPERS"]
    assert lines["URLHELP"] == ""
    assert lines["SAFE"] == "*"
    assert lines["REF"] == f"--ref={pinned}"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_LEFTOVER"].strip() == "0"
    assert lines["HAS_DUPE"].strip() == "0"
    leftover = subprocess.run(
        ["git", "config", "--local", "--get-regexp", r"^url\..*\.insteadof$"],
        cwd=app,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover.stdout.strip() == ""


def test_leftover_extraheader_plus_overlay_sends_two_authorization_headers(
    tmp_path: Path,
) -> None:
    """Git sends every extraheader; overlay without unset is the 34315443132 class."""
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _git(
        repo,
        "config",
        "--local",
        EXTRAHEADER,
        "AUTHORIZATION: basic expiredlocal",
    )
    env = _clean_git_env()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_TRACE_CURL"] = "1"
    env["GIT_CONFIG_COUNT"] = "1"
    env["GIT_CONFIG_KEY_0"] = EXTRAHEADER
    env["GIT_CONFIG_VALUE_0"] = "AUTHORIZATION: basic jobtoken"
    result = subprocess.run(
        ["git", "ls-remote", "origin"],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    auth_n = result.stderr.count("Send header: AUTHORIZATION:")
    assert auth_n == 2, result.stderr[-800:]
    assert "Duplicate header" in result.stderr or "error: 400" in result.stderr
    assert result.returncode != 0


def test_leftover_generic_extraheader_plus_overlay_sends_two_authorization_headers(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _git(
        repo,
        "config",
        "--local",
        "http.extraHeader",
        "AUTHORIZATION: basic expiredgeneric",
    )
    env = _clean_git_env()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_TRACE_CURL"] = "1"
    env["GIT_CONFIG_COUNT"] = "1"
    env["GIT_CONFIG_KEY_0"] = EXTRAHEADER
    env["GIT_CONFIG_VALUE_0"] = "AUTHORIZATION: basic jobtoken"
    result = subprocess.run(
        ["git", "ls-remote", "origin"],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    extra_n = subprocess.run(
        ["git", "config", "--get-all", EXTRAHEADER],
        cwd=repo,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert extra_n.stdout.count("AUTHORIZATION") == 1
    auth_n = result.stderr.count("Send header: AUTHORIZATION:")
    assert auth_n == 2, result.stderr[-800:]
    assert "Duplicate header" in result.stderr or "error: 400" in result.stderr
    assert result.returncode != 0


DRONE_SSH_SCRIPT_STOP = (
    "DRONE_SSH_PREV_COMMAND_EXIT_CODE=$? ; "
    "if [ $DRONE_SSH_PREV_COMMAND_EXIT_CODE -ne 0 ]; then "
    "exit $DRONE_SSH_PREV_COMMAND_EXIT_CODE; fi;"
)


def _inject_script_stop(text: str) -> str:
    """appleboy/drone-ssh script_stop: exit-check after every newline that is not a continuation."""
    lines: list[str] = []
    for line in text.splitlines():
        lines.append(line)
        stripped = line.strip()
        if not stripped:
            continue
        if line.rstrip().endswith("\\"):
            continue
        lines.append(DRONE_SSH_SCRIPT_STOP)
    return "\n".join(lines) + "\n"


def test_gha_entrypoint_parses_after_appleboy_script_stop_injection(
    tmp_path: Path,
) -> None:
    injected = _inject_script_stop(GHA_SCRIPT.read_text(encoding="utf-8"))
    path = tmp_path / "injected.sh"
    path.write_text(injected, encoding="utf-8")
    syntax = subprocess.run(
        ["bash", "-n", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert syntax.returncode == 0, syntax.stderr

    app = tmp_path / "opt" / "sourcebd"
    app.mkdir(parents=True)
    _git(app, "init")
    _git(app, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _plant_expired_github_http_overrides(app)
    ops = app / "ops"
    ops.mkdir()
    fake = ops / "deploy_vps.sh"
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'RAN=%s\\n' "${1-}"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    result = subprocess.run(
        ["bash", str(path)],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(
            {
                "GITHUB_TOKEN": "ghs_fresh_job_token",
                "APP_DIR": str(app),
                "DEPLOY_REF": "abc1234deadbeefabc1234deadbeefabc1234de",
            }
        ),
        cwd=tmp_path,
        timeout=45,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["RAN"] == "--ref=abc1234deadbeefabc1234deadbeefabc1234de"
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"


def test_gha_entrypoint_script_stop_succeeds_when_extraheader_already_absent(
    tmp_path: Path,
) -> None:
    """Second deploy: leftover keys are already gone; unset-all must not abort script_stop."""
    injected = _inject_script_stop(GHA_SCRIPT.read_text(encoding="utf-8"))
    path = tmp_path / "injected.sh"
    path.write_text(injected, encoding="utf-8")
    syntax = subprocess.run(
        ["bash", "-n", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert syntax.returncode == 0, syntax.stderr

    app = tmp_path / "opt" / "sourcebd"
    app.mkdir(parents=True)
    _git(app, "init")
    _git(app, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    ops = app / "ops"
    ops.mkdir()
    fake = ops / "deploy_vps.sh"
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'RAN=%s\\n' "${1-}"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    result = subprocess.run(
        ["bash", str(path)],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(
            {
                "GITHUB_TOKEN": "ghs_fresh_job_token",
                "APP_DIR": str(app),
                "DEPLOY_REF": "abc1234deadbeefabc1234deadbeefabc1234de",
            }
        ),
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["RAN"] == "--ref=abc1234deadbeefabc1234deadbeefabc1234de"
    assert lines["EXTRA_N"].strip() == "1"


def _chown_nobody(path: Path) -> None:
    chown = subprocess.run(
        ["sudo", "-n", "chown", "-R", "nobody:nogroup", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if chown.returncode != 0:
        pytest.skip("passwordless sudo chown is required for dubious-ownership coverage")
    subprocess.run(
        ["sudo", "-n", "chmod", "-R", "a+rX", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )


def test_gha_entrypoint_clears_planted_extraheader_when_repo_owner_differs(
    tmp_path: Path,
) -> None:
    """Root SSH into a sourcebd-owned tree: unsets must run under safe.directory=*."""
    app = tmp_path / "opt" / "sourcebd"
    app.mkdir(parents=True)
    _git(app, "init")
    _git(
        app,
        "remote",
        "add",
        "origin",
        "https://x-access-token:expired-pat@github.com/Rezx100/SourceBD.git",
    )
    _plant_expired_github_http_overrides(app)
    ops = app / "ops"
    ops.mkdir()
    fake = ops / "deploy_vps.sh"
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    _chown_nobody(app)
    sudo_env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "HOME": "/root",
        "GITHUB_TOKEN": "ghs_fresh_job_token",
        "APP_DIR": str(app),
        "DEPLOY_REF": "abc1234deadbeefabc1234deadbeefabc1234de",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
    }
    result = subprocess.run(
        ["sudo", "-n", "env", "-i", *[f"{k}={v}" for k, v in sudo_env.items()], "bash", str(GHA_SCRIPT)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        timeout=45,
    )
    if result.returncode != 0 and "sudo" in (result.stderr + result.stdout).lower() and "password" in (result.stderr + result.stdout).lower():
        pytest.skip("passwordless sudo is required for root-on-foreign-tree coverage")
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["ORIGIN"]
    assert lines["EXTRA_N"].strip() == "1"
    assert "store" not in lines["HELPERS"]
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"

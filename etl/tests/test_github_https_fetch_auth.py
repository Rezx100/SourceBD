"""Expired HTTPS PATs in origin must not win over a job token."""

from __future__ import annotations

import base64
import os
import stat
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "ops" / "github_https_fetch_auth.sh"
GHA_SCRIPT = ROOT / "ops" / "gha_vps_deploy.sh"

SED = r"s#^[Hh][Tt][Tt][Pp][Ss]://([^/@]+@)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm](:443)?/#https://github.com/#"
EXTRAHEADER = "http.https://github.com/.extraheader"

# git-http-backend CGI probe used by tests that must observe fetch exit 0.
# GitHub itself 401s a fixture token; AUTH_N/HAS_DUPE still use github.com.


class _AuthedGitHTTPServer(HTTPServer):
    git_root: Path
    expected_b64: str
    seen_b64: list[str]


def _authorization_b64(token: str) -> str:
    return base64.b64encode(f"x-access-token:{token}".encode()).decode()


class _AuthedGitHandler(BaseHTTPRequestHandler):
    server: _AuthedGitHTTPServer

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _authorized(self) -> bool:
        raw = self.headers.get("Authorization") or self.headers.get("AUTHORIZATION") or ""
        if not raw.lower().startswith("basic "):
            self.server.seen_b64.append("")
            return False
        got = raw.split(None, 1)[1].strip()
        self.server.seen_b64.append(got)
        return got == self.server.expected_b64

    def do_GET(self) -> None:  # noqa: N802
        self._cgi()

    def do_POST(self) -> None:  # noqa: N802
        self._cgi()

    def _cgi(self) -> None:
        if not self._authorized():
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="git"')
            self.end_headers()
            self.wfile.write(b"unauthorized")
            return
        parsed = urlparse(self.path)
        env = os.environ.copy()
        env.update(
            {
                "GIT_HTTP_EXPORT_ALL": "1",
                "GIT_PROJECT_ROOT": str(self.server.git_root),
                "PATH_INFO": unquote(parsed.path),
                "REQUEST_METHOD": self.command,
                "QUERY_STRING": parsed.query,
                "REMOTE_USER": "git",
                "REMOTE_ADDR": "127.0.0.1",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            }
        )
        length = self.headers.get("Content-Length")
        body = b""
        if length:
            body = self.rfile.read(int(length))
            env["CONTENT_LENGTH"] = length
        proc = subprocess.run(
            ["git", "http-backend"],
            input=body,
            capture_output=True,
            env=env,
            check=False,
        )
        header_blob, sep, rest = proc.stdout.partition(b"\r\n\r\n")
        if not sep:
            header_blob, _, rest = proc.stdout.partition(b"\n\n")
        status = 200
        headers: list[tuple[str, str]] = []
        for line in header_blob.decode("latin1", errors="replace").splitlines():
            if line.lower().startswith("status:"):
                try:
                    status = int(line.split(":", 1)[1].strip().split()[0])
                except ValueError:
                    status = 200
            elif ":" in line:
                key, value = line.split(":", 1)
                headers.append((key.strip(), value.strip()))
        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(rest)


def _seed_exportable_bare(root: Path) -> tuple[Path, str]:
    git_root = root / "gitroot"
    git_root.mkdir(parents=True)
    bare = git_root / "upstream.git"
    subprocess.run(
        ["git", "init", "--bare", str(bare)],
        check=True,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
    )
    work = git_root / "seed"
    subprocess.run(
        ["git", "clone", str(bare), str(work)],
        check=True,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
    )
    (work / "README").write_text("seed\n", encoding="utf-8")
    _git(work, "add", "README")
    _git(work, "commit", "-m", "seed")
    _git(work, "push", "origin", "HEAD:refs/heads/main")
    sha = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=work,
        check=True,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
    ).stdout.strip()
    return git_root, sha


def _start_authed_git_http(git_root: Path, token: str) -> tuple[HTTPServer, str, threading.Thread]:
    httpd = _AuthedGitHTTPServer(("127.0.0.1", 0), _AuthedGitHandler)
    httpd.git_root = git_root
    httpd.expected_b64 = _authorization_b64(token)
    httpd.seen_b64 = []
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/upstream.git"
    return httpd, url, thread


def _curl_probe_lines() -> str:
    return """
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_LEFTOVER=%s\\n' "$(grep -c expiredlocal trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
printf 'LS_HTTP=%s\\n' "$(grep -E 'Recv header: HTTP/' trace.curl | head -1 | tr -d '\\r')"
"""


def _local_fetch_lines() -> str:
    return """
export GIT_CONFIG_COUNT=4
export GIT_CONFIG_KEY_3="http.${LOCAL_GIT_HTTP}/.extraheader"
export GIT_CONFIG_VALUE_3="${GIT_CONFIG_VALUE_0}"
git config --local "url.${LOCAL_GIT_HTTP}.insteadof" "https://github.com/Rezx100/SourceBD.git"
git fetch --quiet origin --tags
printf 'FETCH_RC=%s\\n' "$?"
printf 'KEY_AT_FETCH=%s\\n' "${GIT_CONFIG_KEY_0-}"
printf 'GOT=%s\\n' "$(git rev-parse --verify FETCH_HEAD)"
"""


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
    assert "unset-all include.path" in helper
    assert "unset-all include.path" in remote
    assert r"^includeIf\..*\.path$" in helper
    assert r"^includeIf\..*\.path$" in remote
    assert r"github\.com(:443)?" in helper
    assert r"github\.com(:443)?" in remote
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
        "GIT_CONFIG_KEY_3",
        "GIT_CONFIG_VALUE_3",
        "APP_DIR",
        "DEPLOY_REF",
        "LOCAL_GIT_HTTP",
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


def _plant_include_github_overrides(repo: Path, *, gitdir_if: bool = False) -> Path:
    inc = repo / ".git" / "included.cfg"
    inc.write_text(
        '[http "https://github.com/"]\n'
        "\textraheader = AUTHORIZATION: basic expiredinclude\n"
        "[http]\n"
        "\textraHeader = AUTHORIZATION: basic expiredincludegeneric\n"
        "[credential]\n"
        "\thelper = store\n"
        '[url "https://x-access-token:expired-pat@github.com/"]\n'
        "\tinsteadOf = https://github.com/\n",
        encoding="utf-8",
    )
    path = str(inc.resolve())
    if gitdir_if:
        _git(
            repo,
            "config",
            "--local",
            f"includeIf.gitdir:{repo.resolve()}/.git.path",
            path,
        )
    else:
        _git(repo, "config", "--local", "include.path", path)
    return inc


def _prepare_then_github_probe(repo: Path, token: str) -> dict[str, str]:
    script = f"""
set -Eeuo pipefail
. {HELPER}
cd {repo}
sourcebd_prepare_github_https_fetch
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'INCLUDE=%s\\n' "$(git config --local --get include.path 2>/dev/null || true)"
printf 'INCLUDEIF=%s\\n' "$(git config --local --get-regexp '^includeIf\\..*\\.path$' 2>/dev/null || true)"
printf 'INSTEAD=%s\\n' "$(git config --local --get-regexp '^url\\..*\\.insteadof$' 2>/dev/null || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'KEY=%s\\n' "${{GIT_CONFIG_KEY_0-}}"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
printf 'LS_HTTP=%s\\n' "$(grep -E 'Recv header: HTTP/' trace.curl | head -1 | tr -d '\\r')"
"""
    result = subprocess.run(
        ["bash", "-c", script],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env({"GITHUB_TOKEN": token}),
        cwd=repo,
        timeout=45,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    return dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines() if "=" in ln)


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
    _plant_include_github_overrides(app)
    ops = app / "ops"
    ops.mkdir()
    fake = ops / "deploy_vps.sh"
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
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
"""
        + _curl_probe_lines()
        + _local_fetch_lines(),
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    assert not (ops / "github_https_fetch_auth.sh").exists()
    pinned = "273e86778f95b143bfa694aacbc92ecabf5ee591"

    try:
        result = subprocess.run(
            ["bash", str(GHA_SCRIPT)],
            check=False,
            capture_output=True,
            text=True,
            env=_clean_git_env(
                {
                    "GITHUB_TOKEN": token,
                    "APP_DIR": str(app),
                    "DEPLOY_REF": pinned,
                    "LOCAL_GIT_HTTP": local_url,
                }
            ),
            cwd=tmp_path,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
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
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["KEY_AT_FETCH"] == EXTRAHEADER
    assert lines["GOT"].strip() == seed_sha
    assert httpd.expected_b64 in httpd.seen_b64
    leftover = subprocess.run(
        ["git", "config", "--local", "--get-regexp", r"^url\..*\.insteadof$"],
        cwd=app,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert "expired-pat" not in leftover.stdout


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
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'RAN=%s\\n' "${1-}"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
"""
        + _curl_probe_lines()
        + _local_fetch_lines(),
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    try:
        result = subprocess.run(
            ["bash", str(path)],
            check=False,
            capture_output=True,
            text=True,
            env=_clean_git_env(
                {
                    "GITHUB_TOKEN": token,
                    "APP_DIR": str(app),
                    "DEPLOY_REF": "abc1234deadbeefabc1234deadbeefabc1234de",
                    "LOCAL_GIT_HTTP": local_url,
                }
            ),
            cwd=tmp_path,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["RAN"] == "--ref=abc1234deadbeefabc1234deadbeefabc1234de"
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["KEY_AT_FETCH"] == EXTRAHEADER
    assert lines["GOT"].strip() == seed_sha
    assert httpd.expected_b64 in httpd.seen_b64


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
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    fake.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
"""
        + _curl_probe_lines()
        + _local_fetch_lines(),
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    _chown_nobody(app)
    sudo_env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "HOME": "/root",
        "GITHUB_TOKEN": token,
        "APP_DIR": str(app),
        "DEPLOY_REF": "abc1234deadbeefabc1234deadbeefabc1234de",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "LOCAL_GIT_HTTP": local_url,
    }
    try:
        result = subprocess.run(
            ["sudo", "-n", "env", "-i", *[f"{k}={v}" for k, v in sudo_env.items()], "bash", str(GHA_SCRIPT)],
            check=False,
            capture_output=True,
            text=True,
            cwd=tmp_path,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
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
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["KEY_AT_FETCH"] == EXTRAHEADER
    assert lines["GOT"].strip() == seed_sha


def test_helper_job_token_fetches_from_local_git_http(tmp_path: Path) -> None:
    """Subsequent deploys: helper overlay must make git fetch exit 0."""
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _plant_expired_github_http_overrides(repo)
    script = f"""
set -Eeuo pipefail
. {HELPER}
cd {repo}
sourcebd_prepare_github_https_fetch
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'KEY=%s\\n' "${{GIT_CONFIG_KEY_0-}}"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
printf 'LS_HTTP=%s\\n' "$(grep -E 'Recv header: HTTP/' trace.curl | head -1 | tr -d '\\r')"
export GIT_CONFIG_COUNT=4
export GIT_CONFIG_KEY_3="http.{local_url}/.extraheader"
export GIT_CONFIG_VALUE_3="${{GIT_CONFIG_VALUE_0}}"
git config --local "url.{local_url}.insteadof" "https://github.com/Rezx100/SourceBD.git"
git fetch --quiet origin --tags
printf 'FETCH_RC=%s\\n' "$?"
printf 'KEY_AT_FETCH=%s\\n' "${{GIT_CONFIG_KEY_0-}}"
printf 'GOT=%s\\n' "$(git rev-parse --verify FETCH_HEAD)"
"""
    try:
        result = subprocess.run(
            ["bash", "-c", script],
            check=False,
            capture_output=True,
            text=True,
            env=_clean_git_env({"GITHUB_TOKEN": token}),
            cwd=repo,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines())
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["KEY"] == EXTRAHEADER
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["KEY_AT_FETCH"] == EXTRAHEADER
    assert lines["GOT"].strip() == seed_sha
    assert httpd.expected_b64 in httpd.seen_b64


def test_wrong_job_token_does_not_fetch_from_local_git_http(tmp_path: Path) -> None:
    git_root, _seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, "ghs_server_token")
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    script = f"""
set -Eeuo pipefail
. {HELPER}
cd {repo}
sourcebd_prepare_github_https_fetch
export GIT_CONFIG_COUNT=4
export GIT_CONFIG_KEY_3="http.{local_url}/.extraheader"
export GIT_CONFIG_VALUE_3="${{GIT_CONFIG_VALUE_0}}"
git config --local "url.{local_url}.insteadof" "https://github.com/Rezx100/SourceBD.git"
git fetch --quiet origin --tags
"""
    try:
        result = subprocess.run(
            ["bash", "-c", script],
            check=False,
            capture_output=True,
            text=True,
            env=_clean_git_env({"GITHUB_TOKEN": "ghs_wrong_token"}),
            cwd=repo,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
    assert result.returncode != 0
    assert httpd.expected_b64 not in httpd.seen_b64
    assert any(b64 for b64 in httpd.seen_b64)


def test_prepare_strips_github_443_and_https_uppercase_userinfo(tmp_path: Path) -> None:
    token = "ghs_fresh_job_token"
    for origin in (
        "https://x-access-token:expired-pat@github.com:443/Rezx100/SourceBD.git",
        "HTTPS://x-access-token:expired-pat@github.com/Rezx100/SourceBD.git",
    ):
        repo = tmp_path / origin.replace(":", "_").replace("/", "_")[:80]
        repo.mkdir()
        _git(repo, "init")
        _git(repo, "remote", "add", "origin", origin)
        lines = _prepare_then_github_probe(repo, token)
        assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git", origin
        assert "expired-pat" not in lines["ORIGIN"]
        assert lines["AUTH_N"].strip() == "1"
        assert lines["HAS_DUPE"].strip() == "0"
        assert "401" in lines["LS_HTTP"]
        assert "400" not in lines["LS_HTTP"]
        assert lines["KEY"] == EXTRAHEADER


def test_prepare_drops_include_path_extraheader_helper_and_insteadof(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _plant_include_github_overrides(repo)
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["INCLUDE"] == ""
    assert lines["INCLUDEIF"] == ""
    assert "expired-pat" not in lines["INSTEAD"]
    assert lines["INSTEAD"] == ""
    assert "store" not in lines["HELPERS"]
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_includeif_gitdir_extraheader(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _plant_include_github_overrides(repo, gitdir_if=True)
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INCLUDEIF"] == ""
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]

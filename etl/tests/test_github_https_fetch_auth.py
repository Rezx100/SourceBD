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
PARAMS_EXTRAHEADER = (
    "'http.https://github.com/.extraheader=AUTHORIZATION: basic expiredparams'"
)
PARAMS_INSTEAD = (
    "'url.https://x-access-token:expired-pat@github.com/.insteadof=https://github.com/'"
)

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
    assert "GIT_CONFIG_SYSTEM=/dev/null" in helper
    assert "GIT_CONFIG_SYSTEM=/dev/null" in remote
    assert "unset GIT_CONFIG_PARAMETERS" in helper
    assert "unset GIT_CONFIG_PARAMETERS" in remote
    assert any(ln.strip() == "unset GIT_CONFIG" for ln in helper.splitlines())
    assert any(ln.strip() == "unset GIT_CONFIG" for ln in remote.splitlines())
    assert "--unset-all remote.origin.url" in helper
    assert "--unset-all remote.origin.url" in remote
    assert "--add remote.origin.url" in helper
    assert "--add remote.origin.url" in remote
    assert "[ ! -d .git ] && [ ! -f .git ]" in remote
    assert r"^url\..*\.(push)?insteadof$" in helper
    assert r"^url\..*\.(push)?insteadof$" in remote
    assert "git rev-parse --git-path config 2>" in helper
    assert "git rev-parse --git-path config 2>" in remote
    assert "git rev-parse --git-path config.worktree 2>" in helper
    assert "git rev-parse --git-path config.worktree 2>" in remote
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
    assert "config.worktree" in helper
    assert "config.worktree" in remote
    assert "extensions.worktreeConfig" in helper
    assert "extensions.worktreeConfig" in remote
    assert r"^url\..*\.(push)?insteadof$" in helper
    assert r"^url\..*\.(push)?insteadof$" in remote
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
        file_i = _first_code_index(text, "git config --file")
        extra_i = _first_code_index(text, "http.https://github.com/.extraheader")
        origin_i = _first_code_index(text, "--add remote.origin.url")
        assert count1_i < file_i, path.name
        assert safe_i < file_i < extra_i, path.name
        assert star_i < file_i, path.name
        assert safe_i < origin_i, path.name


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
        "GIT_CONFIG_PARAMETERS",
        "GIT_CONFIG",
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
        ["git", "config", "--get-regexp", r"^url\..*\.insteadof$"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    assert leftover.stdout.strip() == ""
    assert "expired-pat" not in leftover.stdout
    geturl = subprocess.run(
        ["git", "ls-remote", "--get-url", "origin"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=True,
    )
    assert geturl.stdout.strip() == "https://github.com/Rezx100/SourceBD.git"


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


def _absolute_git_dir(repo: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--absolute-git-dir"],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
    )
    return result.stdout.strip()


def _write_gha_observer_deploy(app: Path) -> None:
    ops = app / "ops"
    ops.mkdir(exist_ok=True)
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
printf 'GETURL=%s\\n' "$(git ls-remote --get-url origin 2>/dev/null || true)"
printf 'MERGED_INSTEAD=%s\\n' "$(git config --get-regexp '^url\\..*\\.insteadof$' 2>/dev/null || true)"
printf 'INCLUDE=%s\\n' "$(git config --get include.path 2>/dev/null || true)"
printf 'INCLUDEIF=%s\\n' "$(git config --get-regexp '^includeIf\\..*\\.path$' 2>/dev/null || true)"
printf 'PARAMS=%s\\n' "${GIT_CONFIG_PARAMETERS-UNSET}"
printf 'GITCFG=%s\\n' "${GIT_CONFIG-UNSET}"
printf 'GITFILE=%s\\n' "$(if [ -f .git ]; then echo file; elif [ -d .git ]; then echo dir; else echo missing; fi)"
"""
        + _curl_probe_lines()
        + _local_fetch_lines(),
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)


def _plant_worktree_includeif(repo: Path, name: str) -> None:
    git_dir = Path(_absolute_git_dir(repo))
    inc = git_dir / name
    inc.write_text(
        '[http "https://github.com/"]\n'
        "\textraheader = AUTHORIZATION: basic expiredwtincludeif\n"
        '[url "https://x-access-token:expired-wtif-pat@github.com/"]\n'
        "\tinsteadOf = https://github.com/\n",
        encoding="utf-8",
    )
    _git(repo, "config", "--local", "extensions.worktreeConfig", "true")
    _git(
        repo,
        "config",
        "--worktree",
        f"includeIf.gitdir:{git_dir}.path",
        str(inc.resolve()),
    )


def _prepare_then_github_probe(
    repo: Path, token: str, extra: dict[str, str] | None = None
) -> dict[str, str]:
    script = f"""
set -Eeuo pipefail
. {HELPER}
cd {repo}
sourcebd_prepare_github_https_fetch
printf 'ORIGIN=%s\\n' "$(git config --local --get remote.origin.url)"
printf 'INCLUDE=%s\\n' "$(git config --get include.path 2>/dev/null || true)"
printf 'INCLUDEIF=%s\\n' "$(git config --get-regexp '^includeIf\\..*\\.path$' 2>/dev/null || true)"
printf 'INSTEAD=%s\\n' "$(git config --get-regexp '^url\\..*\\.insteadof$' 2>/dev/null || true)"
printf 'GETURL=%s\\n' "$(git ls-remote --get-url origin 2>/dev/null || true)"
printf 'HELPERS=%s\\n' "$(git config --get-all credential.helper 2>/dev/null | tr '\\n' '|' || true)"
printf 'EXTRA_N=%s\\n' "$(git config --get-all http.https://github.com/.extraheader 2>/dev/null | grep -c . || true)"
printf 'KEY=%s\\n' "${{GIT_CONFIG_KEY_0-}}"
printf 'PARAMS=%s\\n' "${{GIT_CONFIG_PARAMETERS-UNSET}}"
GIT_TRACE_CURL=1 git ls-remote origin >/dev/null 2>trace.curl || true
printf 'AUTH_N=%s\\n' "$(grep -c 'Send header: AUTHORIZATION:' trace.curl || true)"
printf 'HAS_DUPE=%s\\n' "$(grep -ci 'Duplicate header' trace.curl || true)"
printf 'HAS_EXPIREDPAT=%s\\n' "$(grep -c expired-pat trace.curl || true)"
printf 'LS_HTTP=%s\\n' "$(grep -E 'Recv header: HTTP/' trace.curl | head -1 | tr -d '\\r')"
"""
    env = {"GITHUB_TOKEN": token}
    if extra:
        env.update(extra)
    result = subprocess.run(
        ["bash", "-c", script],
        check=False,
        capture_output=True,
        text=True,
        env=_clean_git_env(env),
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
        "HTTPS://x-access-token:expired-pat@github.com:443/Rezx100/SourceBD.git",
    )
    _git(
        app,
        "remote",
        "set-url",
        "--add",
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
    _git(
        app,
        "config",
        "--local",
        "url.https://x-access-token:expired-https-pat@github.com/.insteadof",
        "https://",
    )
    _plant_expired_github_http_overrides(app)
    inc = _plant_include_github_overrides(app)
    _git(app, "config", "--local", "extensions.worktreeConfig", "true")
    _git(
        app,
        "config",
        "--local",
        f"includeIf.gitdir:{_absolute_git_dir(app)}.path",
        str(inc.resolve()),
    )
    _git(
        app,
        "config",
        "--worktree",
        EXTRAHEADER,
        "AUTHORIZATION: basic expiredworktree",
    )
    _git(
        app,
        "config",
        "--worktree",
        "url.https://x-access-token:expired-wt-pat@github.com/.insteadOf",
        "https://github.com/",
    )
    _plant_worktree_includeif(app, "included-wt-if.cfg")
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    _write_gha_observer_deploy(app)
    assert not (app / "ops" / "github_https_fetch_auth.sh").exists()
    pinned = "273e86778f95b143bfa694aacbc92ecabf5ee591"
    empty_cfg = tmp_path / "empty.gitconfig"
    empty_cfg.write_text("", encoding="utf-8")

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
                    "GIT_CONFIG_PARAMETERS": f"{PARAMS_EXTRAHEADER} {PARAMS_INSTEAD}",
                    "GIT_CONFIG": str(empty_cfg),
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
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert "expired-wt-pat" not in lines["GETURL"]
    assert "expired-wtif-pat" not in lines["GETURL"]
    assert "expired-https-pat" not in lines["GETURL"]
    assert "expired-pat" not in lines["MERGED_INSTEAD"]
    assert "expired-wt-pat" not in lines["MERGED_INSTEAD"]
    assert "expired-wtif-pat" not in lines["MERGED_INSTEAD"]
    assert "expired-https-pat" not in lines["MERGED_INSTEAD"]
    assert lines["INCLUDE"] == ""
    assert lines["INCLUDEIF"] == ""
    assert lines["PARAMS"] == "UNSET"
    assert lines["GITCFG"] == "UNSET"
    assert lines["GITFILE"] == "dir"
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
        ["git", "config", "--get-regexp", r"^url\..*\.insteadof$"],
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


def test_git_config_parameters_extraheader_plus_overlay_sends_two_authorization_headers(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    env = _clean_git_env({"GIT_CONFIG_PARAMETERS": PARAMS_EXTRAHEADER})
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


def test_git_config_parameters_insteadof_rewrites_geturl_without_unset(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    env = _clean_git_env({"GIT_CONFIG_PARAMETERS": PARAMS_INSTEAD})
    geturl = subprocess.run(
        ["git", "ls-remote", "--get-url", "origin"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=env,
        check=True,
    )
    assert "expired-pat" in geturl.stdout


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
        assert "expired-pat" not in lines["GETURL"]
        assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
        assert lines["HAS_EXPIREDPAT"].strip() == "0"
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
    assert "expired-pat" not in lines["GETURL"]
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
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
    assert lines["INSTEAD"] == ""
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_include_path_insteadof_only(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    inc = repo / ".git" / "instead-only.cfg"
    inc.write_text(
        '[url "https://x-access-token:expired-pat@github.com/"]\n'
        "\tinsteadOf = https://github.com/\n",
        encoding="utf-8",
    )
    _git(repo, "config", "--local", "include.path", str(inc.resolve()))
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INSTEAD"] == ""
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_insteadof_that_rewrites_https_without_github_in_value(
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
        "url.https://x-access-token:expired-pat@github.com/.insteadOf",
        "https://",
    )
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INSTEAD"] == ""
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"


def test_prepare_drops_github_443_extraheader(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _git(
        repo,
        "config",
        "--local",
        "http.https://github.com:443/.extraheader",
        "AUTHORIZATION: basic expired443",
    )
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_worktree_extraheader_and_insteadof(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    _git(repo, "config", "--local", "extensions.worktreeConfig", "true")
    _git(
        repo,
        "config",
        "--worktree",
        EXTRAHEADER,
        "AUTHORIZATION: basic expiredworktree",
    )
    _git(
        repo,
        "config",
        "--worktree",
        "url.https://x-access-token:expired-pat@github.com/.insteadOf",
        "https://github.com/",
    )
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INSTEAD"] == ""
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_worktree_include_path(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    inc = repo / ".git" / "wt-inc.cfg"
    inc.write_text(
        '[http "https://github.com/"]\n'
        "\textraheader = AUTHORIZATION: basic expiredwtinc\n"
        '[url "https://x-access-token:expired-pat@github.com/"]\n'
        "\tinsteadOf = https://github.com/\n",
        encoding="utf-8",
    )
    _git(repo, "config", "--local", "extensions.worktreeConfig", "true")
    _git(repo, "config", "--worktree", "include.path", str(inc.resolve()))
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INSTEAD"] == ""
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_worktree_includeif(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    inc = repo / ".git" / "wt-if.cfg"
    inc.write_text(
        '[http "https://github.com/"]\n'
        "\textraheader = AUTHORIZATION: basic expiredwtif\n"
        '[url "https://x-access-token:expired-pat@github.com/"]\n'
        "\tinsteadOf = https://github.com/\n",
        encoding="utf-8",
    )
    _git(repo, "config", "--local", "extensions.worktreeConfig", "true")
    _git(
        repo,
        "config",
        "--worktree",
        f"includeIf.gitdir:{repo.resolve()}/.git.path",
        str(inc.resolve()),
    )
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["INCLUDEIF"] == ""
    assert lines["INSTEAD"] == ""
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_clears_common_dir_config_from_a_linked_worktree(tmp_path: Path) -> None:
    main = tmp_path / "main"
    main.mkdir()
    _git(main, "init")
    _git(main, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    (main / "README").write_text("seed\n", encoding="utf-8")
    _git(main, "add", "README")
    _git(main, "commit", "-m", "seed")
    _git(
        main,
        "config",
        "--local",
        EXTRAHEADER,
        "AUTHORIZATION: basic expiredcommon",
    )
    _git(
        main,
        "config",
        "--local",
        "url.https://x-access-token:expired-pat@github.com/.insteadOf",
        "https://github.com/",
    )
    linked = tmp_path / "linked"
    _git(main, "worktree", "add", str(linked), "HEAD")
    lines = _prepare_then_github_probe(linked, "ghs_fresh_job_token")
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["INSTEAD"] == ""
    assert lines["EXTRA_N"].strip() == "1"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_drops_git_config_parameters_extraheader(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    lines = _prepare_then_github_probe(
        repo,
        "ghs_fresh_job_token",
        extra={"GIT_CONFIG_PARAMETERS": PARAMS_EXTRAHEADER},
    )
    assert lines["PARAMS"] == "UNSET"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"


def test_prepare_drops_git_config_parameters_insteadof(tmp_path: Path) -> None:
    repo = tmp_path / "app"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "remote", "add", "origin", "https://github.com/Rezx100/SourceBD.git")
    lines = _prepare_then_github_probe(
        repo,
        "ghs_fresh_job_token",
        extra={"GIT_CONFIG_PARAMETERS": PARAMS_INSTEAD},
    )
    assert lines["PARAMS"] == "UNSET"
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["INSTEAD"] == ""
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"


def test_gha_entrypoint_prepares_fetch_on_linked_worktree_gitfile(
    tmp_path: Path,
) -> None:
    main = tmp_path / "opt" / "sourcebd"
    main.mkdir(parents=True)
    _git(main, "init")
    (main / "README").write_text("seed\n", encoding="utf-8")
    _git(main, "add", "README")
    _git(main, "commit", "-m", "seed")
    _git(
        main,
        "remote",
        "add",
        "origin",
        "https://x-access-token:expired-pat@github.com/Rezx100/SourceBD.git",
    )
    _git(
        main,
        "config",
        "--local",
        "url.https://x-access-token:expired-pat@github.com/.insteadof",
        "https://github.com/",
    )
    _plant_expired_github_http_overrides(main)
    inc = _plant_include_github_overrides(main)
    _git(main, "config", "--local", "extensions.worktreeConfig", "true")
    _git(
        main,
        "config",
        "--local",
        f"includeIf.gitdir:{_absolute_git_dir(main)}.path",
        str(inc.resolve()),
    )
    linked = tmp_path / "linked"
    _git(main, "worktree", "add", str(linked), "HEAD")
    assert (linked / ".git").is_file()
    _git(
        linked,
        "config",
        "--worktree",
        EXTRAHEADER,
        "AUTHORIZATION: basic expiredworktree",
    )
    _git(
        linked,
        "config",
        "--worktree",
        "url.https://x-access-token:expired-wt-pat@github.com/.insteadOf",
        "https://github.com/",
    )
    _plant_worktree_includeif(linked, "included-linked-wt-if.cfg")
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    _write_gha_observer_deploy(linked)
    assert not (linked / "ops" / "github_https_fetch_auth.sh").exists()
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
                    "APP_DIR": str(linked),
                    "DEPLOY_REF": pinned,
                    "LOCAL_GIT_HTTP": local_url,
                    "GIT_CONFIG_PARAMETERS": f"{PARAMS_EXTRAHEADER} {PARAMS_INSTEAD}",
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
    assert lines["GITFILE"] == "file"
    assert lines["ORIGIN"] == "https://github.com/Rezx100/SourceBD.git"
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert "expired-wt-pat" not in lines["GETURL"]
    assert "expired-wtif-pat" not in lines["GETURL"]
    assert lines["INCLUDE"] == ""
    assert lines["INCLUDEIF"] == ""
    assert lines["PARAMS"] == "UNSET"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["GOT"].strip() == seed_sha
    assert httpd.expected_b64 in httpd.seen_b64


def test_prepare_strips_origin_when_git_config_env_is_empty_file(
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
    empty = tmp_path / "empty.gitconfig"
    empty.write_text("", encoding="utf-8")
    lines = _prepare_then_github_probe(
        repo,
        "ghs_fresh_job_token",
        extra={"GIT_CONFIG": str(empty)},
    )
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "400" not in lines["LS_HTTP"]


def test_prepare_strips_origin_when_git_config_env_is_dev_null(tmp_path: Path) -> None:
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
    lines = _prepare_then_github_probe(
        repo,
        "ghs_fresh_job_token",
        extra={"GIT_CONFIG": "/dev/null"},
    )
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    assert lines["HAS_EXPIREDPAT"].strip() == "0"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"


def test_prepare_replaces_every_remote_origin_url_value(tmp_path: Path) -> None:
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
    _git(
        repo,
        "remote",
        "set-url",
        "--add",
        "origin",
        "HTTPS://x-access-token:expired-pat@github.com:443/Rezx100/SourceBD.git",
    )
    lines = _prepare_then_github_probe(repo, "ghs_fresh_job_token")
    assert lines["GETURL"] == "https://github.com/Rezx100/SourceBD.git"
    assert "expired-pat" not in lines["GETURL"]
    leftover = subprocess.run(
        ["git", "config", "--get-all", "remote.origin.url"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=_clean_git_env(),
        check=False,
    )
    urls = [ln for ln in leftover.stdout.splitlines() if ln.strip()]
    assert urls == ["https://github.com/Rezx100/SourceBD.git"]
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"


def test_gha_entrypoint_patches_merge_base_require_git_on_gitfile(
    tmp_path: Path,
) -> None:
    """First deploy: VPS deploy_vps.sh still dies on a gitfile without a patch."""
    main = tmp_path / "opt" / "sourcebd"
    main.mkdir(parents=True)
    _git(main, "init")
    (main / "README").write_text("seed\n", encoding="utf-8")
    _git(main, "add", "README")
    _git(main, "commit", "-m", "seed")
    _git(
        main,
        "remote",
        "add",
        "origin",
        "HTTPS://x-access-token:expired-pat@github.com:443/Rezx100/SourceBD.git",
    )
    _plant_expired_github_http_overrides(main)
    linked = tmp_path / "linked"
    _git(main, "worktree", "add", str(linked), "HEAD")
    assert (linked / ".git").is_file()
    token = "ghs_fresh_job_token"
    git_root, seed_sha = _seed_exportable_bare(tmp_path / "export")
    httpd, local_url, _thread = _start_authed_git_http(git_root, token)
    ops = linked / "ops"
    ops.mkdir()
    stub = ops / "deploy_vps.sh"
    stub.write_text(
        """#!/usr/bin/env bash
set -Eeuo pipefail
REQUIRE_GIT=0
for arg in "$@"; do
  case "$arg" in
    --require-git) REQUIRE_GIT=1 ;;
  esac
done
if [ "$REQUIRE_GIT" -eq 1 ] && [ ! -d .git ]; then
  echo OLD_REQUIRE_GIT_DIE=yes
  exit 1
fi
if [ -d .git ]; then
  echo FETCH_BLOCK=dir
  echo OLD_REQUIRE_GIT_DIE=no
"""
        + _curl_probe_lines()
        + _local_fetch_lines()
        + """
else
  echo FETCH_BLOCK=skip
  echo OLD_REQUIRE_GIT_DIE=no
fi
""",
        encoding="utf-8",
    )
    stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
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
                    "APP_DIR": str(linked),
                    "DEPLOY_REF": pinned,
                    "LOCAL_GIT_HTTP": local_url,
                    "GIT_CONFIG": "/dev/null",
                }
            ),
            cwd=tmp_path,
            timeout=45,
        )
    finally:
        httpd.shutdown()
        httpd.server_close()
    assert result.returncode == 0, result.stderr + result.stdout
    lines = dict(ln.split("=", 1) for ln in result.stdout.strip().splitlines() if "=" in ln)
    assert lines.get("OLD_REQUIRE_GIT_DIE") == "no"
    assert lines["FETCH_BLOCK"] == "dir"
    assert lines["AUTH_N"].strip() == "1"
    assert lines["HAS_DUPE"].strip() == "0"
    assert "401" in lines["LS_HTTP"]
    assert "400" not in lines["LS_HTTP"]
    assert lines["FETCH_RC"].strip() == "0"
    assert lines["GOT"].strip() == seed_sha
    patched = stub.read_text(encoding="utf-8")
    assert "[ ! -d .git ] && [ ! -f .git ]" in patched
    assert "[ -d .git ] || [ -f .git ]" in patched

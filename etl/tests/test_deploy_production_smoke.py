"""GHA public smoke must retry 503s; Caddy must not hold the upstream down."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _workflow() -> str:
    return (ROOT / ".github/workflows/deploy-production.yml").read_text(encoding="utf-8")


def _job_steps(text: str) -> list[str]:
    job = text.split("jobs:", 1)[1]
    return re.split(r"\n      - ", job)[1:]


def _step_named(text: str, name: str) -> str:
    for step in _job_steps(text):
        if re.search(rf"^name: {re.escape(name)}\s*$", step, re.M):
            return step
    raise AssertionError(f"missing step {name!r}")


def _run_script(step: str) -> str:
    _, run = step.split("run: |", 1)
    return run.strip()


def _code_lines(script: str) -> list[str]:
    return [ln.strip() for ln in script.splitlines() if ln.strip() and not ln.strip().startswith("#")]


def test_gha_public_smoke_retries_instead_of_one_shot_curl() -> None:
    text = _workflow()
    names = [re.search(r"^name: (.+)$", step, re.M).group(1) for step in _job_steps(text)]
    assert names.index("Checkout smoke helper") < names.index("Resolve expected production commit")
    assert names.index("Resolve expected production commit") < names.index("Deploy to VPS via SSH")
    assert names.index("Deploy to VPS via SSH") < names.index("Public smoke test")

    pin = _step_named(text, "Resolve expected production commit")
    assert "id: pin" in pin
    pin_run = _run_script(pin)
    assert 'git fetch --tags origin "${DEPLOY_REF}"' in pin_run
    assert 'EXPECT="$(git rev-parse "FETCH_HEAD^{commit}")"' in pin_run
    assert 'echo "sha=${EXPECT}" >> "$GITHUB_OUTPUT"' in pin_run
    assert "git rev-parse FETCH_HEAD\"" not in pin_run.replace("FETCH_HEAD^{commit}", "")

    deploy = _step_named(text, "Deploy to VPS via SSH")
    assert "DEPLOY_REF: ${{ steps.pin.outputs.sha }}" in deploy

    smoke = _step_named(text, "Public smoke test")
    assert "continue-on-error" not in smoke
    assert "if:" not in smoke
    run = _run_script(smoke)
    code = _code_lines(run)
    assert code[0].startswith("python3 ops/wait_for_http_ok.py")
    assert "--attempts 12" in run
    assert "--sleep 5" in run
    assert code[1].startswith('--url "http://${{ secrets.VPS_HOST }}/api/health"')
    assert "--expect-commit" in run
    assert '${{ steps.pin.outputs.sha }}' in run
    assert not any(ln.startswith("set +e") for ln in code)
    assert not any("|| true" in ln or "||true" in ln or "|| echo" in ln or "||exit 0" in ln for ln in code)
    assert 'curl --fail --silent --show-error --max-time 15 "http://${HOST}/api/health"' not in run


def test_caddy_does_not_keep_upstream_unhealthy_for_a_health_interval() -> None:
    text = (ROOT / "ops/Caddyfile").read_text(encoding="utf-8")
    directives = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert not any(line.startswith("health_uri") for line in directives)
    assert not any(line.startswith("health_interval") for line in directives)
    assert any(line.startswith("reverse_proxy 127.0.0.1:3000") for line in directives)


def test_gha_passes_job_token_and_self_contained_vps_script() -> None:
    """Expired VPS HTTPS PATs must not be able to fail fetch (34315443132)."""
    text = _workflow()
    deploy = _step_named(text, "Deploy to VPS via SSH")
    assert "GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}" in deploy
    assert "envs: DEPLOY_REF,APP_DIR,GITHUB_TOKEN" in deploy
    # appleboy/ssh-action@v1.2.0 action.yml: script_path -> INPUT_SCRIPT_FILE.
    # `script_file` is not a declared input and is dropped.
    assert "script_path: ops/gha_vps_deploy.sh" in deploy
    assert "script_file:" not in deploy
    assert "uses: appleboy/ssh-action@v1.2.0" in deploy
    assert "command_timeout: 25m" in deploy
    assert "contents: read" in text
    assert "script: |" not in deploy
    assert "x-access-token:" not in deploy  # token stays in env, not YAML

    remote = (ROOT / "ops" / "gha_vps_deploy.sh").read_text(encoding="utf-8")
    assert 'bash "$_deploy" --ref="${DEPLOY_REF}" --require-git' in remote
    assert "git config --file" in remote
    assert "http.https://github.com/.extraheader" in remote
    assert r"s#^[Hh][Tt][Tt][Pp][Ss]?://([^/@]+@)?([Ww][Ww][Ww]\.)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm]\.?(:443)?/#https://github.com/#" in remote
    assert "unset-all include.path" in remote
    assert r"^includeIf\..*\.path$" in remote
    assert "config.worktree" in remote
    assert "extensions.worktreeConfig" in remote
    assert "http.https://github.com/.extraheader" in remote
    assert "AUTHORIZATION: basic" in remote
    assert "x-access-token:" in remote
    assert "GIT_CONFIG_GLOBAL=/dev/null" in remote
    assert "GIT_CONFIG_SYSTEM=/dev/null" in remote
    assert "unset GIT_CONFIG_PARAMETERS" in remote
    assert any(ln.strip() == "unset GIT_CONFIG" for ln in remote.splitlines())
    assert "[ ! -d .git ] && [ ! -f .git ]" in remote
    assert "git rev-parse --git-path config 2>" in remote
    assert "git rev-parse --git-path config.worktree 2>" in remote
    assert "--unset-all remote.origin.url" in remote
    assert "--add remote.origin.url" in remote
    assert r"^url\..*\.(push)?insteadof$" in remote
    assert "credential.helper" in remote
    assert "if [ -f .git ] && [ -f ops/deploy_vps.sh ]" in remote
    assert "export REPO_DIR" in remote
    assert "mktemp" in remote
    assert "safe.directory" in remote
    assert "GIT_CONFIG_COUNT=3" in remote
    assert "unset-all http.https://github.com/.extraheader" in remote
    assert "unset-all credential.helper" in remote
    assert 'git remote set-url origin "https://x-access-token' not in remote
    assert "GITHUB_TOKEN missing" in remote
    assert "sourcebd_prepare_github_https_fetch() {" not in remote
    assert "\ncase " not in remote and not remote.startswith("case ")

    with_block = deploy.split("with:", 1)[1]
    used = set(re.findall(r"^          ([a-z_]+):", with_block, re.M))
    # appleboy/ssh-action@v1.2.0 action.yml `inputs:` (undeclared keys are dropped).
    appleboy_v1_2_0 = {
        "host",
        "port",
        "passphrase",
        "username",
        "password",
        "protocol",
        "sync",
        "use_insecure_cipher",
        "cipher",
        "timeout",
        "command_timeout",
        "key",
        "key_path",
        "fingerprint",
        "proxy_host",
        "proxy_port",
        "proxy_username",
        "proxy_password",
        "proxy_protocol",
        "proxy_passphrase",
        "proxy_timeout",
        "proxy_key",
        "proxy_key_path",
        "proxy_fingerprint",
        "proxy_cipher",
        "proxy_use_insecure_cipher",
        "script",
        "script_path",
        "script_stop",
        "envs",
        "envs_format",
        "debug",
        "allenvs",
        "request_pty",
    }
    assert used <= appleboy_v1_2_0
    assert "script_path" in used
    assert "script_file" not in used
    assert "script" not in used
    assert "script_stop" in used


def test_health_route_json_commit_comes_from_commit_sha_env() -> None:
    text = (ROOT / "app/api/health/route.ts").read_text(encoding="utf-8")
    assert "commit: process.env.COMMIT_SHA" in text
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert ".deploy/deploy.env" in compose


def test_deploy_vps_prepares_github_https_fetch_before_git_fetch() -> None:
    text = (ROOT / "ops/deploy_vps.sh").read_text(encoding="utf-8")
    assert "[ ! -d .git ] && [ ! -f .git ]" in text
    assert "[ -d .git ] || [ -f .git ]" in text
    _, git_block = text.split("if [ -d .git ] || [ -f .git ]; then", 1)
    code = [
        ln.strip()
        for ln in git_block.splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    unset_i = next(i for i, ln in enumerate(code) if ln == "unset GIT_CONFIG_PARAMETERS")
    source_i = next(i for i, ln in enumerate(code) if "github_https_fetch_auth.sh" in ln)
    prepare_i = next(
        i for i, ln in enumerate(code) if ln == "sourcebd_prepare_github_https_fetch"
    )
    fetch_i = next(i for i, ln in enumerate(code) if ln.startswith("git fetch"))
    assert unset_i < source_i < prepare_i < fetch_i


def test_deploy_vps_waits_for_public_health_before_returning() -> None:
    text = (ROOT / "ops/deploy_vps.sh").read_text(encoding="utf-8")
    _, public = text.split("Public health check", 1)
    code = [
        ln.strip()
        for ln in public.splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    until_i = next(i for i, ln in enumerate(code) if ln.startswith("until "))
    cap_i = next(i for i, ln in enumerate(code) if "-gt 20" in ln or "-ge 20" in ln)
    die_i = next(i for i, ln in enumerate(code) if ln.startswith("die "))
    ok_i = next(i for i, ln in enumerate(code) if "deploy OK" in ln)
    assert until_i < cap_i < die_i < ok_i
    assert not any(ln.startswith("warn ") for ln in code)


def _isolate_git_env() -> dict[str, str]:
    env = os.environ.copy()
    env["GIT_CONFIG_GLOBAL"] = "/dev/null"
    env["GIT_CONFIG_SYSTEM"] = "/dev/null"
    env["GIT_AUTHOR_NAME"] = "pin"
    env["GIT_AUTHOR_EMAIL"] = "pin@example.com"
    env["GIT_COMMITTER_NAME"] = "pin"
    env["GIT_COMMITTER_EMAIL"] = "pin@example.com"
    return env


def test_pin_commands_peel_annotated_tag_to_the_commit_health_reports(
    tmp_path: Path,
) -> None:
    """`/api/health` reports `git rev-parse HEAD`. FETCH_HEAD of an annotated tag is the tag object."""
    env = _isolate_git_env()
    origin = tmp_path / "origin.git"
    subprocess.run(["git", "init", "--bare", str(origin)], check=True, capture_output=True, env=env)
    work = tmp_path / "work"
    work.mkdir()
    subprocess.run(["git", "init"], cwd=work, check=True, capture_output=True, env=env)
    (work / "f").write_text("x\n", encoding="utf-8")
    subprocess.run(["git", "add", "f"], cwd=work, check=True, capture_output=True, env=env)
    subprocess.run(["git", "commit", "-m", "c"], cwd=work, check=True, capture_output=True, env=env)
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=work,
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    subprocess.run(
        ["git", "tag", "-a", "v2026.07.02-5", "-m", "release"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    tag_obj = subprocess.run(
        ["git", "rev-parse", "v2026.07.02-5"],
        cwd=work,
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    assert tag_obj != commit
    subprocess.run(
        ["git", "remote", "add", "origin", str(origin)],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    subprocess.run(
        ["git", "push", "origin", "HEAD:main"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    subprocess.run(
        ["git", "push", "origin", "v2026.07.02-5"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    (work / "f").write_text("y\n", encoding="utf-8")
    subprocess.run(["git", "add", "f"], cwd=work, check=True, capture_output=True, env=env)
    subprocess.run(["git", "commit", "-m", "c2"], cwd=work, check=True, capture_output=True, env=env)
    commit2 = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=work,
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    subprocess.run(
        ["git", "tag", "-a", "v2026.07.02-1", "-m", "earlier"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    subprocess.run(
        ["git", "push", "origin", "HEAD:main"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )
    subprocess.run(
        ["git", "push", "origin", "v2026.07.02-1"],
        cwd=work,
        check=True,
        capture_output=True,
        env=env,
    )

    runner = tmp_path / "runner"
    subprocess.run(
        ["git", "clone", str(origin), str(runner)],
        check=True,
        capture_output=True,
        env=env,
    )
    github_output = tmp_path / "github_output"
    github_output.write_text("", encoding="utf-8")
    pin_script = _run_script(_step_named(_workflow(), "Resolve expected production commit"))
    pin = subprocess.run(
        ["bash", "-c", pin_script],
        cwd=runner,
        check=True,
        capture_output=True,
        text=True,
        env={**env, "DEPLOY_REF": "v2026.07.02-5", "GITHUB_OUTPUT": str(github_output)},
    )
    unpeeled = subprocess.run(
        ["git", "rev-parse", "FETCH_HEAD"],
        cwd=runner,
        check=True,
        capture_output=True,
        text=True,
        env=env,
    ).stdout.strip()
    assert unpeeled == tag_obj
    assert f"sha={commit}" in github_output.read_text(encoding="utf-8")
    assert commit != commit2
    assert commit not in (tag_obj,)
    assert pin.returncode == 0

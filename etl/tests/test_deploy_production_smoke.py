"""GHA public smoke must retry 503s; Caddy must not hold the upstream down."""

from __future__ import annotations

import re
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
    assert names.index("Checkout smoke helper") < names.index("Deploy to VPS via SSH")
    assert names.index("Deploy to VPS via SSH") < names.index("Public smoke test")

    smoke = _step_named(text, "Public smoke test")
    assert "continue-on-error" not in smoke
    assert "if:" not in smoke
    run = _run_script(smoke)
    code = _code_lines(run)
    assert code[0].startswith("python3 ops/wait_for_http_ok.py")
    assert "--attempts 12" in run
    assert "--sleep 5" in run
    assert code[1].startswith('--url "http://${{ secrets.VPS_HOST }}/api/health"')
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

#!/usr/bin/env python3
"""PreToolUse guard for Bash in the SourceBD repo.

Exit 2 blocks the call and returns stderr to Claude. Never exit 1 — that is a hook
error, not a block, and Claude Code will let the command through.

Enforces AGENTS.md hard rules 9, 9a, 10 and 15, plus the forbidden-actions list in
.cursor/rules/sourcebd-enterprise-deploy.mdc.
"""
import json
import re
import subprocess
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if payload.get("tool_name") != "Bash":
    sys.exit(0)

cmd = (payload.get("tool_input") or {}).get("command") or ""
flat = re.sub(r"\s+", " ", cmd)

RULES = [
    (r"\bgit push\b[^|;&]*(\bmain\b|--force\b|-f\b|--force-with-lease|--tags|--mirror)",
     "AGENTS 9/9a: pushing to main, pushing tags or force-pushing is founder-only"),
    (r"\bgit tag\b[^|;&]*\bv\d",
     "gate 2: cutting a v* tag is founder-only"),
    (r"\bgh pr merge\b",
     "gate 1: landing a PR is founder-only"),
    (r"\bgh workflow run\b|\bgh api\b[^|;&]*(dispatches|/merges?\b)",
     "gate 3: Deploy Production is founder-only"),
    (r"(^|\s)--apply\b",
     "AGENTS 15: --apply needs the founder's explicit go-ahead, dry-run first"),
    (r"\bops/(apply_[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]*_apply\.(py|sh|sql))",
     "AGENTS 15: production mutation scripts are founder-only"),
    (r"\bops/(deploy_vps\.sh|gha_vps_deploy\.sh|finish_vps_deploy\.sh|bootstrap-vps\.sh"
     r"|deploy-quick\.ps1|deploy-vps\.ps1|provision_vps\.py)",
     "gate 3: deploy and provisioning scripts are founder-only"),
    (r"37\.49\.227\.151|nbawebcast",
     "AGENTS 10: the pixelsport VPS is off-limits"),
    (r"\b(ssh|scp|sftp|rsync)\b[^|;&]*109\.104\.153\.228",
     "production VPS access is founder-only"),
    (r"\brsync\b[^|;&]*--delete",
     "runbook: rsync --delete is forbidden"),
    (r"docker(-| )compose down (-v|--volumes)",
     "runbook: never drop volumes"),
    (r"\brm -[a-z]*r[a-z]*\b[^|;&]*(etl/(raw|parsed|logs)|\.deploy|\.env\b|supabase/migrations)",
     "runbook: persistent paths are never deleted"),
    (r"\bgit (commit|push)\b[^|;&]*--no-verify|\bgit reset --hard|\bgit checkout -- \.|\bgit clean -[a-z]*f",
     "ai-workflow-rules: destructive git needs explicit approval"),
    (r"(>|>>|\btee\b) *\S*\.env(?!\.example)\b",
     "never write .env"),
    (r"\bpsql\b[^|;&]*-c *['\"][^'\"]*\b(update|delete|insert|alter|drop|truncate)\b",
     "AGENTS 15: direct SQL mutation is founder-only; dry-run in a rolled-back transaction"),
]

for pattern, why in RULES:
    if re.search(pattern, flat, re.IGNORECASE):
        sys.stderr.write(
            f"BLOCKED by .claude/hooks/guard.py — {why}.\nCommand: {cmd}\n"
            "Print the exact command for the founder to run themselves, then stop.\n")
        sys.exit(2)

# A bare `git push` (no refspec) pushes the current branch. On main that is rule 9,
# and no pattern above can see it, because the branch name is not in the command.
if re.search(r"\bgit push\b", flat, re.IGNORECASE) and not re.search(
        r"\bgit push\b[^|;&]*\s(origin|upstream|[A-Za-z0-9_./:-]+)\s+\S", flat):
    try:
        branch = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        branch = ""
    if branch in ("main", "master"):
        sys.stderr.write(
            "BLOCKED by .claude/hooks/guard.py — AGENTS 9: bare `git push` on "
            f"{branch} pushes to {branch}, which is founder-only.\nCommand: {cmd}\n"
            "Print the exact command for the founder to run themselves, then stop.\n")
        sys.exit(2)

sys.exit(0)

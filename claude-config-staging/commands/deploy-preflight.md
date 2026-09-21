---
description: Read-only checks before the founder promotes or deploys; prints the founder-run commands and stops
argument-hint: <sha>
allowed-tools: Bash(git:*), Bash(gh run:*), Bash(gh pr:*), Bash(curl:*)
---

Read `.cursor/rules/sourcebd-enterprise-deploy.mdc` and `docs/ENTERPRISE_DEPLOYMENT.md` in full
first. Then, for $ARGUMENTS:

1. `git fetch origin main development`. Is $ARGUMENTS an ancestor of `origin/main`? If not, gate 2
   is pending — print the `development` → `main` PR the founder must open and merge.
2. `gh run list --commit $ARGUMENTS` — `verify` and `http-boundary` must both be success.
3. `curl -s https://sourcebd.net/api/health` — record the live commit. That is what a rollback
   returns to.
4. Print for the founder, and do not run:
   `gh workflow run deploy-production.yml --ref main -f ref=$ARGUMENTS`
   and the rollback:
   `ssh root@109.104.153.228 'cd /opt/sourcebd && bash ops/deploy_vps.sh --ref=$(cat .deploy/previous-sha) --require-git'`
5. State the expected smoke result: `/api/health` commit == $ARGUMENTS, and the pages the change
   touches render.

Confirm the target VPS is 109.104.153.228 and never 37.49.227.151. Never run step 4 yourself
(AGENTS.md 9a; the guard hook blocks it anyway).

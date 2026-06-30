# SourceBD Enterprise Deployment Runbook

**Canonical deploy reference.** When you say *"deploy using the SourceBD deploy rules"*, follow this document and `.cursor/rules/sourcebd-enterprise-deploy.mdc`.

---

## Golden rules

1. **Never deploy from a dirty laptop working tree** (no auto-detect tarball/rsync of uncommitted work).
2. **Deploy only from GitHub** — a merged branch, release tag, or explicit SHA on the VPS.
3. **Production target VPS:** `109.104.153.228` only.
4. **Never touch** `37.49.227.151` (pixelsport-backend — off-limits per `AGENTS.md`).
5. **Secrets stay on the VPS** in `/opt/sourcebd/.env` or in **GitHub Actions Secrets** — never in the repo.
6. **Never overwrite** `/opt/sourcebd/.env` during deploy.
7. **Never use `rsync --delete`** on production paths without explicit operator approval and proven exclusions.
8. **Record rollback refs** before every production deploy.

---

## Branch and release model

| Ref | Purpose |
|-----|---------|
| `main` | Production — deploy only CI-green, reviewed merges |
| `development` | Integration — default dev branch, PR target |
| `feature/*` | Isolated work; merge via PR |
| `v*` tags | Immutable production deploy pins (recommended) |

Workflow:

```
feature/* → PR → development (CI must pass)
development → PR → main (review + CI)
Tag main → vYYYY.MM.DD-N
Deploy production from tag or main SHA via GitHub Actions or VPS git checkout
```

**Do not push directly to `main`.** Enable GitHub branch protection on `main` (require PR, require CI checks).

---

## GitHub repository

| Remote | URL |
|--------|-----|
| `origin` | `https://github.com/Rezx100/SourceBD.git` |
| `old-sbi` | Legacy `pixelpoint100/sbi` (reference only) |

**Never force-push** to `main` or `development`.

---

## Pre-deploy checks (local or CI)

Run before merging or deploying:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Build uses placeholder public env vars in CI (see `.github/workflows/ci.yml`). Linux CI/VPS is the source of truth for production builds (Windows may fail on Next.js standalone symlinks).

**Git hygiene before push:**

```powershell
git status                    # must be clean for the scoped change set
git diff --stat origin/development...HEAD
```

Deploy scope must match **intended** production change — not "everything dirty in the tree."

---

## Approved production deploy path

### Primary: GitHub Actions (recommended)

1. Merge to `main` (or create tag `vX.Y.Z`).
2. GitHub → Actions → **Deploy Production** → Run workflow.
3. Input: git ref (tag, `main`, or SHA).
4. Workflow SSHs to VPS, checks out ref, runs `ops/deploy_vps.sh --ref=<ref> --require-git`.
5. Confirm smoke checks (workflow hits `/api/health`; operator runs extended checklist below).

### Secondary: Manual VPS deploy (after git push)

```bash
ssh root@109.104.153.228
cd /opt/sourcebd
bash ops/deploy_vps.sh --ref=v2026.06.30-1 --require-git
# or: bash ops/deploy_vps.sh --ref=main --require-git
```

### Deprecated for production (guarded)

| Script | Why deprecated | Escape hatch |
|--------|----------------|--------------|
| `ops/deploy-quick.ps1` | Ships local dirty/auto-detected files | `-AllowLegacyHotfix` + explicit file list only |
| `ops/deploy-vps.ps1` | Tarball from laptop; historically included local `.env` | `-AllowLegacyTarballDeploy` (bootstrap/migration only) |

---

## First-time VPS migration (tarball → git-backed)

Run **once** before the first GitHub-backed production deploy.

```bash
# ON 109.104.153.228 ONLY
ssh root@109.104.153.228

# 1. Backup
cp -a /opt/sourcebd /opt/sourcebd-backup-$(date +%Y%m%d)
cp /opt/sourcebd/.env /root/sourcebd.env.$(date +%Y%m%d)
du -sh /opt/sourcebd/etl/raw /opt/sourcebd/etl/parsed /opt/sourcebd/etl/logs

# 2. Preserve secrets and ETL data
mv /opt/sourcebd/.env /root/sourcebd.env.migrate
mkdir -p /root/etl-preserve
rsync -a /opt/sourcebd/etl/raw/    /root/etl-preserve/raw/
rsync -a /opt/sourcebd/etl/parsed/ /root/etl-preserve/parsed/
rsync -a /opt/sourcebd/etl/logs/   /root/etl-preserve/logs/

# 3. Clone fresh repo (use deploy key or HTTPS with token on VPS)
git clone -b main https://github.com/Rezx100/SourceBD.git /opt/sourcebd-new
cp /root/sourcebd.env.migrate /opt/sourcebd-new/.env
chmod 600 /opt/sourcebd-new/.env

# 4. Restore ETL persistent data
rsync -a /root/etl-preserve/raw/    /opt/sourcebd-new/etl/raw/
rsync -a /root/etl-preserve/parsed/ /opt/sourcebd-new/etl/parsed/
rsync -a /root/etl-preserve/logs/ /opt/sourcebd-new/etl/logs/

# 5. Swap directories
mv /opt/sourcebd /opt/sourcebd-old
mv /opt/sourcebd-new /opt/sourcebd
chown -R sourcebd:sourcebd /opt/sourcebd
ln -sf /opt/sourcebd/ops/Caddyfile /etc/caddy/Caddyfile

# 6. First git-backed deploy
cd /opt/sourcebd
bash ops/deploy_vps.sh --ref=main --require-git
curl -sf http://127.0.0.1:3000/api/health && echo OK
```

Keep `/opt/sourcebd-old` until smoke tests pass, then archive or delete **only after explicit approval**.

---

## Required backup before production deploy

The deploy script (`ops/deploy_vps.sh`) records rollback metadata automatically. Operators should also:

| Layer | Command / action |
|-------|------------------|
| **Git rollback ref** | Written to `/opt/sourcebd/.deploy/previous-sha` by deploy script |
| **Docker image** | Tagged `sourcebd-web:rollback-<sha>` before rebuild |
| **VPS tree** | `cp -a /opt/sourcebd /opt/sourcebd-backup-YYYYMMDD` (major releases) |
| **`.env`** | `cp /opt/sourcebd/.env /root/sourcebd.env.YYYYMMDD` |
| **ETL data** | `tar -czf /root/etl-data-YYYYMMDD.tar.gz -C /opt/sourcebd etl/raw etl/parsed` |
| **Database** | Supabase dashboard backup / note PITR window |

---

## Persistent VPS paths (never delete on deploy)

| Path | Purpose |
|------|---------|
| `/opt/sourcebd/.env` | Runtime secrets — **never overwrite from git/tarball** |
| `/opt/sourcebd/etl/raw/` | Scraped raw data |
| `/opt/sourcebd/etl/parsed/` | Parsed ETL output |
| `/opt/sourcebd/etl/logs/` | ETL logs |
| `/opt/sourcebd/.deploy/` | Rollback SHA metadata (created by deploy script) |
| **Supabase** (hosted) | Primary database — external to VPS |
| **BunnyCDN** | Mirrored documents — external to VPS |
| `/etc/caddy/Caddyfile` | Usually symlink → `ops/Caddyfile` |

**Safe to rebuild from git:** application source, `public/` assets committed to repo, Docker web container.

---

## Static asset policy

| Asset type | Policy |
|------------|--------|
| `public/icons/products/**` | **Commit to git** — required at runtime |
| `public/inapp-logos/**` | **Commit to git** — registry/compliance UI |
| `ops/screenshots/**` | **Never commit or deploy** — local QA only |
| `ops/_icon_candidates/`, `__pycache__/` | **Never commit or deploy** |
| Generated `.next/`, `node_modules/` | Built inside Docker — never rsync from laptop |

---

## Rollback procedure

### 1. Application (fast)

```bash
ssh root@109.104.153.228
cd /opt/sourcebd
PREV=$(cat .deploy/previous-sha)
bash ops/deploy_vps.sh --ref="$PREV" --require-git
```

### 2. Docker image (if git rollback insufficient)

```bash
docker tag sourcebd-web:rollback-<sha> sourcebd-web:latest
cd /opt/sourcebd && docker compose up -d --no-deps web
```

### 3. Full filesystem

```bash
cp -a /opt/sourcebd-backup-YYYYMMDD/. /opt/sourcebd/
# Restore .env if needed
bash ops/deploy_vps.sh --ref=<known-good-sha> --require-git
```

### 4. Database

Use Supabase PITR or restore from dump — only if a migration caused the incident.

---

## Post-deploy smoke checklist

- [ ] `curl -sf https://sourcebd.net/api/health` → 200
- [ ] `curl -sf http://109.104.153.228/api/health` → 200
- [ ] App supplier profile: `/app/suppliers/{slug}` — tabs, product icons
- [ ] Marketing profile: `/suppliers/{slug}` — parity with app
- [ ] Static icon: `/icons/products/jeans.png` → 200
- [ ] Login/signup smoke (if auth touched)
- [ ] Record deploy summary: SHA, tag, backup status, smoke results, rollback ref

---

## Emergency stop rules

**Stop immediately if:**

- Target IP is not `109.104.153.228`
- `git status` shows unrelated dirty files in deploy scope
- `.env` would be overwritten (tarball/rsync scripts without exclusion)
- Auto-detect deploy would ship >20 files without explicit approval
- CI typecheck/lint/build failed
- `/api/health` fails after deploy — **rollback** using `.deploy/previous-sha`
- Operator has not confirmed deploy scope for contaminated working trees

**Do not** run `docker compose down -v`, `rm -rf etl/raw`, or `rsync --delete` without explicit written approval.

---

## GitHub Actions secrets

Configure in repo → Settings → Secrets and variables → Actions:

| Secret | Example | Required |
|--------|---------|----------|
| `VPS_HOST` | `109.104.153.228` | Yes |
| `VPS_USER` | `root` | Yes |
| `VPS_SSH_PRIVATE_KEY` | Ed25519 deploy key (full PEM) | Yes |
| `VPS_APP_DIR` | `/opt/sourcebd` | Optional (defaults in workflow) |

**Do not** store runtime `.env` in GitHub Secrets for the web container — VPS `.env` stays on server.

Create GitHub Environment **`production`** with required reviewers for manual approval.

---

## Scoped deploy: supplier profile UI

When the working tree is contaminated, deploy **only** the profile pass via git — never a dirty-tree tarball.

**Scope file:** `ops/deploy/scopes/supplier-profile-ui.txt`

Process:

1. Commit only scoped files to `feature/supplier-profile-ui`.
2. PR → `development` → CI green → merge.
3. PR → `main` (or tag release).
4. Deploy via GitHub Actions with that ref.

**Do not deploy unrelated dirty changes** unless the operator explicitly confirms all dirty files are intended for production.

---

## Deploy summary template (agents must produce)

```
## SourceBD Deploy Summary
- **Ref deployed:** vX.Y.Z / abc1234
- **Previous SHA (rollback):** def5678
- **Target VPS:** 109.104.153.228
- **Method:** GitHub Actions | manual VPS
- **Scope:** <feature area or file list>
- **Backup:** previous-sha recorded | docker rollback tag | manual backup Y/N
- **CI:** tsc ✓ lint ✓ build ✓
- **Smoke:** /api/health ✓ | profile pages ✓ | icons ✓
- **Rollback command:** bash ops/deploy_vps.sh --ref=def5678 --require-git
```

---

## Related files

| File | Role |
|------|------|
| `.cursor/rules/sourcebd-enterprise-deploy.mdc` | Agent deploy instructions |
| `.github/workflows/ci.yml` | PR/push verification |
| `.github/workflows/deploy-production.yml` | Manual production deploy |
| `ops/deploy_vps.sh` | Approved VPS deploy script |
| `ops/deploy/README.md` | Env contract and bootstrap notes |

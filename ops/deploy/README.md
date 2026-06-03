# P1 — Production VPS deploy notes

Target VPS: **`109.104.153.228`** (SourceBD).
**Do not** touch `37.49.227.151` (pixelsport-backend, off-limits).

This deploy stands up the Next.js web container only; the existing
`etl` compose service is unchanged.

## One-time bootstrap (operator, manual)

```bash
ssh root@109.104.153.228
apt-get update && apt-get install -y docker.io docker-compose-plugin caddy git curl
git clone -b development git@github.com:<org>/sourcebd.git /opt/sourcebd
cd /opt/sourcebd
cp .env.example .env
# edit .env — see "Env contract" below
ln -sf /opt/sourcebd/ops/Caddyfile /etc/caddy/Caddyfile
systemctl enable --now caddy
```

## Every-deploy workflow

From a local PowerShell:

```pwsh
# 1. Push to development branch
git push origin development

# 2. Trigger the deploy on the VPS (single-shot SSH, sequential)
ssh.exe -i $env:USERPROFILE\.ssh\sourcebd_vps -o BatchMode=yes -n root@109.104.153.228 'tmux new-session -d -s p1_deploy "cd /opt/sourcebd && bash ops/deploy_vps.sh 2>&1 | tee /tmp/p1_deploy.log"'

# 3. Tail the log
ssh.exe -i $env:USERPROFILE\.ssh\sourcebd_vps -o BatchMode=yes -n root@109.104.153.228 'tail -f /tmp/p1_deploy.log'

# 4. Verify
curl http://109.104.153.228/api/health
```

## Env contract

Every var from `.env.example` is mapped here to its production source.
**Required for the free beta** = must be set or the deploy script refuses
to start. **Optional** = unset is fine, the relevant feature degrades
gracefully.

### Required

| Var | Source | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | `https://stnrfxrxfonwexzcvvpv.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon public | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role | **Never** ship to the client; server-only. |
| `SUPABASE_DB_URL` | Supabase Dashboard → Connect → Transaction pooler (port 6543) | Used by the etl container only; the web container does not need it. |
| `NEXT_PUBLIC_SUPABASE_URL` | mirror of `SUPABASE_URL` | Browser bundle. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mirror of `SUPABASE_ANON_KEY` | Browser bundle. |
| `NEXT_PUBLIC_APP_URL` | `http://109.104.153.228` for the IP-only beta; swap to `https://<domain>` once DNS lands | Drives magic-link redirect URLs. |

### Recommended (graceful-degrade if unset)

| Var | Source | If unset |
|---|---|---|
| `RESEND_API_KEY` | Resend Dashboard → API Keys | Welcome / RFQ / password-reset emails fall back to the dev console log per H4. |
| `RESEND_FROM` | configured sender in Resend | Defaults to `SourceBD <noreply@sourcebd.com>`. |
| `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Sentry → Project Settings → Client Keys (DSN); auth token under Account → Auth Tokens | Sentry SDK disables itself (H1 contract); source-map upload is skipped at build time. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog → Project Settings | Analytics SDK no-ops (H1 contract). |
| `BUNNY_*` | Bunny dashboard → Storage / Pull Zones | Document mirroring (Specs 09 / 13 / 15) won't run on this container; etl-only. |

### Unset on purpose

| Var | Why unset |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe deferred (founder decision 3 Jun 2026, `phases.md` → "Deferred until post-beta"). |
| `STRIPE_WEBHOOK_SECRET` | Same. The `/api/stripe/webhook` route returns `{disabled:true}` 200 when these are unset. |
| `NEXT_PUBLIC_ICO_REGISTRATION_NUMBER`, `NEXT_PUBLIC_UK_GDPR_REP_*` | H7 contract — Privacy page renders explicit "Pending …" sentinels until the real values land out-of-band. |
| `RESTORE_TARGET_DATABASE_URL` | H8 quarterly drill only; not part of normal deploy. |
| `ONEPROVIDER_*` | Provider API not used at runtime; the VPS is configured manually. |

## Caddy

`ops/Caddyfile` is symlinked into `/etc/caddy/Caddyfile`. HTTP-only on
`:80` for the IP-only phase. When DNS lands:

1. Edit `ops/Caddyfile`: replace `:80 {` with `sourcebd.com, www.sourcebd.com {`.
2. Remove `auto_https off` from the global block.
3. `systemctl reload caddy` — Let's Encrypt provisions on first request.

## Migrations

Default deploy **does not** touch Supabase migrations. The production
project has migrations 0001 → 0047 applied via the per-migration psycopg
pattern (see `progress-tracker.md` decisions log). Run with
`--with-migrations` only when shipping a brand-new `supabase/migrations/*.sql`,
and then apply via the etl container's psycopg + `ops/_apply_one.py` —
not via Supabase CLI (CLI is not an approved tool per `architecture.md`).

## Rollback

```bash
ssh root@109.104.153.228
cd /opt/sourcebd
git checkout <previous-commit-sha>
bash ops/deploy_vps.sh
```

The image is rebuilt deterministically from the pinned commit. No
schema rollback needed because migrations are not part of the default
deploy path.

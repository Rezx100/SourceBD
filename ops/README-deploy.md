# VPS Deploy Notes

## Usage
```powershell
.\ops\deploy-vps.ps1 -VpsIp 109.104.153.228
```

## What the script does
1. Bootstrap VPS (apt packages, Docker, Caddy, ufw, non-root `sourcebd` user)
2. Build a tarball of all Next.js + ETL source (no node_modules/.next)
3. Upload + extract on VPS at `/opt/sourcebd/`
4. `docker compose build` — runs `pnpm build` on Linux (avoids Windows EPERM symlink issues with standalone output)
5. `docker compose run --rm etl ping` — verify DB connectivity
6. `docker compose up -d web` — start/restart the web container

## Files included in tarball
All Next.js source files are explicitly listed in the tar command, including:
- `sentry.edge.config.ts`, `sentry.server.config.ts` — required by instrumentation
- `middleware.ts`, `instrumentation.ts`, `instrumentation-client.ts`
- `app/`, `components/`, `lib/`, `public/`, `supabase/`

## SSH invocation pattern (critical)
Must use `ssh.exe -n -o BatchMode=yes` — no `cmd /c` wrapper, no stdin.
See user memory `scraping-ops.md` for full explanation.

## Caddy
Config at `ops/Caddyfile`, deployed to `/etc/caddy/Caddyfile` on VPS.
Listens on :80 and :443 (tls internal for CF Full SSL mode).

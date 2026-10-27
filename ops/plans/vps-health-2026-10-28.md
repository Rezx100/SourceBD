# SourceBD VPS health, 28 Oct 2026

Measured by `ops/vps_health_audit.sh` (read-only), run by the founder at 20:08 UTC
on 27 Oct 2026 against 109.104.153.228 (hostname `sourcebd-etl-01`). Re-run that
script and update this file in place; do not write a second measurement.

## Healthy

- Up 47 days, no reboot pending. 4 CPUs, load 0.5. Memory 2.1 of 7.8 GB used.
- Web container healthy on the live commit `78c80b9`; Caddy up since 11 Sep; port 3000
  bound to localhost only; site behind Cloudflare, certificate valid to 29 Dec 2026.
- No failed services. `.env` is mode 600. The app checkout has no modified tracked files.

## Problems, worst first

| # | What | Size / count | Why it matters |
|---|------|--------------|----------------|
| 1 | Disk 86% full | 64 of 79 GB, 11 GB free | A full disk stops deploys, logs and the database-facing jobs |
| 2 | Old rollback images, never removed | 146 images, ~40 GB reclaimable | Every deploy since June tagged one and nothing prunes them |
| 3 | Docker build cache | 25 GB, all reclaimable | Left by on-server builds; now that CI builds, mostly dead |
| 4 | System journal | 4.1 GB | No size cap set |
| 5 | Security updates pending | 153 security of 201 | 47 days without patching |
| 6 | No firewall, no fail2ban | ufw and fail2ban inactive; 1,107 failed SSH logins in 24 h | SSH open to the internet with nothing slowing attackers |
| 7 | World-readable copy of `.env` | `/opt/sourcebd-backup-20260630-0508/.env`, mode 666 | Production secrets readable by any user on the box |
| 8 | Old copies of the app | `/opt/sourcebd-backup-20260630-0508`, `/opt/sourcebd-old-20260630-0508` (53 MB each) | Leftovers of the June move to git |
| 9 | Stray files in the app folder | `reset`, `deploy`, `apply` at the root (likely shell redirects), 3 in `ops/plans`, 1 prod script, 2 stashes, 3 branches | Confusing; may hold old output |
| 10 | ETL logs | 130 MB, 73 files older than 90 days | No rotation |

## Fix plan

- Code (agent, via PR): the deploy script keeps only the last 5 rollback images and
  prunes build cache older than 7 days after every deploy, so 2 and 3 cannot come back.
- One-time cleanup (founder runs, after a dry-run listing): remove rollback images
  beyond the newest 5, prune build cache, cap the journal at 500 MB, delete the two
  June folders (after confirming nothing in them is needed), move the stray files.
- Security (founder runs): delete or `chmod 600` the backup `.env` today; apply
  security updates and reboot in a quiet hour; enable ufw allowing 22, 80, 443;
  enable fail2ban for SSH.

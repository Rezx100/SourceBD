#!/usr/bin/env bash
# Read-only health audit of the SourceBD VPS. It prints; it changes nothing.
# No secret is printed: for .env only its permissions are shown.
set -u
APP=/opt/sourcebd
G="git -C $APP -c safe.directory=*"
sec() { printf '\n===== %s =====\n' "$*"; }

sec host;            hostname; uptime; grep PRETTY /etc/os-release; uname -r
sec reboot-needed;   if [ -f /var/run/reboot-required ]; then cat /var/run/reboot-required; else echo no; fi
sec memory;          free -h
sec disk;            df -hT -x tmpfs -x devtmpfs -x overlay -x squashfs
sec inodes;          df -i / | tail -1
sec cpu;             nproc; top -bn1 | head -15
sec failed-units;    systemctl --failed --no-legend || true
sec services;        for s in docker caddy cron ssh fail2ban ufw unattended-upgrades; do printf '%-20s %s\n' "$s" "$(systemctl is-active "$s" 2>/dev/null)"; done
sec updates;         echo "pending: $(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)  security: $(apt list --upgradable 2>/dev/null | grep -ci security)"
sec firewall;        ufw status 2>/dev/null | head -20
sec listening;       ss -tlnp | awk 'NR>1 {print $4, $6}' | sort -u
sec docker-df;       docker system df
sec containers;      docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}'
sec images;          docker images --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}' | sort
sec image-counts;    echo "total $(docker images -q | wc -l)  dangling $(docker images -qf dangling=true | wc -l)  rollback-tags $(docker images --format '{{.Tag}}' | grep -c '^rollback-')"
sec volumes;         echo "total $(docker volume ls -q | wc -l)  unused $(docker volume ls -qf dangling=true | wc -l)"
sec build-cache;     docker buildx du 2>/dev/null | tail -3
sec container-logs;  find /var/lib/docker/containers -name '*-json.log' -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -5 | awk '{printf "%.1f MB\t%s\n", $1/1048576, $2}'
sec journald;        journalctl --disk-usage 2>/dev/null
sec var-log;         du -sh /var/log 2>/dev/null; du -sh /var/log/* 2>/dev/null | sort -rh | head -8
sec app-deployed;    $G log -1 --format='%h %cd %s'; cat "$APP/.deploy/current-sha" "$APP/.deploy/deployed-at" 2>/dev/null
sec app-git-status;  $G status --porcelain=v1 | cut -c1-2 | sort | uniq -c
sec app-untracked;   $G status --porcelain=v1 -uall | grep '^??' | cut -c4- | cut -d/ -f1-2 | sort | uniq -c | sort -rn | head -20
sec app-modified;    $G status --porcelain=v1 | grep -v '^??' | head -20
sec app-branches;    echo "local branches $($G branch | wc -l)  stashes $($G stash list | wc -l)"
sec app-sizes;       du -sh "$APP"/* "$APP"/.[!.]* 2>/dev/null | sort -rh | head -20
sec etl-data;        du -sh "$APP/etl/raw" "$APP/etl/parsed" "$APP/etl/logs" 2>/dev/null; echo "files older than 90 days: $(find "$APP/etl/raw" "$APP/etl/parsed" "$APP/etl/logs" -type f -mtime +90 2>/dev/null | wc -l)"
sec opt-and-root;    ls -la /opt; du -sh /opt/* /root /home/* 2>/dev/null | sort -rh | head -12
sec backups;         ls -lah /opt/*backup* /root/*backup* /var/backups 2>/dev/null | head -20
sec cron;            crontab -l 2>/dev/null; ls -la /etc/cron.d
sec env-file;        stat -c '%n %a %U %y' "$APP/.env" 2>/dev/null
sec caddy;           caddy version 2>/dev/null; systemctl status caddy --no-pager 2>/dev/null | head -5
sec app-health;      curl -s -m 5 http://127.0.0.1:3000/api/health; echo
sec logins;          last -n 5 2>/dev/null
sec ssh-failures-24h; journalctl -u ssh -u sshd --since '24 hours ago' 2>/dev/null | grep -cE 'Failed|Invalid'
echo; echo "===== done ====="

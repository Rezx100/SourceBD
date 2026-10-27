#!/usr/bin/env bash
# SourceBD — VPS bootstrap (Ubuntu 22.04/24.04)
# Idempotent. Safe to re-run.
set -euo pipefail

log() { printf '\n\033[1;36m[bootstrap] %s\033[0m\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo -i)." >&2
  exit 1
fi

log "apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release git tmux htop ufw \
  unattended-upgrades fail2ban rsync jq

log "Install Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl daemon-reload || true
  systemctl enable docker || true
  systemctl start docker || true
fi
# Wait for docker daemon
for i in 1 2 3 4 5 6 7 8 9 10; do docker info >/dev/null 2>&1 && break; sleep 2; done

log "Create non-root deploy user 'sourcebd'"
if ! id -u sourcebd >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G docker sourcebd
  mkdir -p /home/sourcebd/.ssh
  cp /root/.ssh/authorized_keys /home/sourcebd/.ssh/authorized_keys
  chown -R sourcebd:sourcebd /home/sourcebd/.ssh
  chmod 700 /home/sourcebd/.ssh
  chmod 600 /home/sourcebd/.ssh/authorized_keys
fi

log "Harden SSH (disable password auth)"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd || true

log "Caddy (reverse proxy in front of the web container; config is ops/Caddyfile)"
# Caddy's own repo: Ubuntu 24.04 ships 2.6, which rejects ops/Caddyfile's `persist_config` (Portland, 28 Oct 2026).
if [ ! -f /etc/apt/sources.list.d/caddy-stable.list ]; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
fi
apt-get install -y --no-install-recommends caddy

log "UFW firewall (SSH, and 80/443 for Cloudflare -> Caddy)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Enable unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades || true || true

log "Prepare app directory at /opt/sourcebd"
install -d -o sourcebd -g sourcebd /opt/sourcebd
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/raw
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/parsed
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/logs

log "DONE. Next: rsync source from laptop, then run docker compose build."

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

log "UFW firewall (allow 22/tcp only)"
ufw allow OpenSSH
ufw --force enable

log "Enable unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades || true || true

log "Prepare app directory at /opt/sourcebd"
install -d -o sourcebd -g sourcebd /opt/sourcebd
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/raw
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/parsed
install -d -o sourcebd -g sourcebd /opt/sourcebd/etl/logs

log "DONE. Next: rsync source from laptop, then run docker compose build."

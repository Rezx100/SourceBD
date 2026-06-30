<#
  SourceBD - VPS deploy from Windows laptop (LEGACY TARBALL)

  *** DEPRECATED FOR PRODUCTION ***
  Production deploys MUST use git-backed flow: docs/ENTERPRISE_DEPLOYMENT.md

  This script tarballs the local repo and rsyncs to VPS. It does NOT deploy
  from GitHub and historically included local .env in the tarball.

  Usage (bootstrap / one-time migration only):
    .\ops\deploy-vps.ps1 -VpsIp 109.104.153.228 -AllowLegacyTarballDeploy
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)] [string]$VpsIp,
  [string]$SshUser = 'root',
  [int]$SshPort = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\sourcebd_vps",
  [switch]$AllowLegacyTarballDeploy
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($VpsIp -eq '37.49.227.151') {
  throw 'FORBIDDEN: 37.49.227.151 is off-limits (pixelsport-backend). Use 109.104.153.228 only.'
}

if (-not $AllowLegacyTarballDeploy) {
  Write-Host @"

*** BLOCKED: ops/deploy-vps.ps1 is deprecated for production. ***

Use git-backed deploy: docs/ENTERPRISE_DEPLOYMENT.md
  GitHub Actions -> Deploy Production
  OR: ssh root@109.104.153.228 'cd /opt/sourcebd && bash ops/deploy_vps.sh --ref=<tag> --require-git'

For one-time bootstrap/migration only, pass -AllowLegacyTarballDeploy.

"@ -ForegroundColor Red
  exit 1
}

$KnownHosts = "$env:USERPROFILE\.ssh\known_hosts_sourcebd"

function Invoke-Ssh([string]$cmd) {
  & ssh.exe -i $KeyPath -p $SshPort -n -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$KnownHosts "$SshUser@$VpsIp" $cmd
  if ($LASTEXITCODE -ne 0) { throw "SSH failed: $cmd" }
}
function Invoke-Scp([string]$src, [string]$dst) {
  & scp.exe -i $KeyPath -P $SshPort -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$KnownHosts -r $src "$SshUser@${VpsIp}:$dst"
  if ($LASTEXITCODE -ne 0) { throw "SCP failed: $src -> $dst" }
}

if (-not (Test-Path $KeyPath)) { throw "SSH private key not found at $KeyPath" }
if ($VpsIp -ne '109.104.153.228') {
  Write-Warning "Expected SourceBD VPS 109.104.153.228; got $VpsIp — confirm before continuing."
}

Write-Host '==> Testing SSH' -ForegroundColor Cyan
Invoke-Ssh 'uname -a; cat /etc/os-release | head -2'

Write-Host '==> Uploading bootstrap script' -ForegroundColor Cyan
Invoke-Scp 'ops\bootstrap-vps.sh' '/root/bootstrap-vps.sh'
Invoke-Ssh 'sed -i "s/\r$//" /root/bootstrap-vps.sh; chmod +x /root/bootstrap-vps.sh; bash /root/bootstrap-vps.sh'

Write-Host '==> Building project tarball' -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP 'sourcebd-deploy.tar'
if (Test-Path $tmp) { Remove-Item $tmp -Force }
& tar --exclude='.git' --exclude='node_modules' --exclude='.next' `
      --exclude='etl/logs' --exclude='etl/parsed' `
      --exclude='.env' --exclude='.env.*' `
      --exclude='*.htm' --exclude='API Access*' --exclude='API Access_files' `
      --exclude='ops/_*' --exclude='prototypes' `
      --exclude='MASTER_AI_BUILD_TUTORIAL.md' --exclude='SourceBD_Data_Pipeline_Spec.md' `
      --exclude='SourceBD_Spec_Addendum.md' `
      -cf $tmp `
      Dockerfile Dockerfile.web docker-compose.yml `
      package.json pnpm-lock.yaml pyproject.toml `
      next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs `
      middleware.ts instrumentation.ts instrumentation-client.ts `
      sentry.edge.config.ts sentry.server.config.ts `
      next-env.d.ts `
      app components lib public supabase `
      context etl ops AGENTS.md
if ($LASTEXITCODE -ne 0) { throw 'tar failed' }

Write-Host '==> Uploading project tarball' -ForegroundColor Cyan
Invoke-Scp $tmp '/tmp/sourcebd-deploy.tar'

Write-Host '==> Extracting on VPS' -ForegroundColor Cyan
# Clean any leftover _incoming dirs from previous runs
Invoke-Ssh 'rm -rf /opt/sourcebd/_incoming; mkdir -p /opt/sourcebd/_incoming'
Invoke-Ssh 'tar -xf /tmp/sourcebd-deploy.tar -C /opt/sourcebd/_incoming'
Invoke-Ssh 'mkdir -p /opt/sourcebd/etl/raw /opt/sourcebd/etl/parsed /opt/sourcebd/etl/logs'
# rsync without --delete; never overwrite VPS .env or ETL persistent dirs
Invoke-Ssh 'rsync -a --exclude=.env --exclude=.env.* --exclude=etl/raw --exclude=etl/logs --exclude=etl/parsed /opt/sourcebd/_incoming/ /opt/sourcebd/'
Invoke-Ssh 'rm -rf /opt/sourcebd/_incoming; rm -f /tmp/sourcebd-deploy.tar'
Invoke-Ssh 'chown -R sourcebd:sourcebd /opt/sourcebd; echo OK_EXTRACT'

Write-Host '==> Building Docker image (first build can take 5-8 min)' -ForegroundColor Cyan
Invoke-Ssh 'cd /opt/sourcebd && docker compose build 2>&1 | tail -40'

Write-Host '==> Pinging DB from container' -ForegroundColor Cyan
Invoke-Ssh 'cd /opt/sourcebd && docker compose run --rm etl ping'

Write-Host '==> Starting web container' -ForegroundColor Cyan
Invoke-Ssh 'cd /opt/sourcebd && docker compose up -d web'

Write-Host '==> Waiting for web healthcheck' -ForegroundColor Cyan
Start-Sleep -Seconds 8
Invoke-Ssh 'curl -sf http://127.0.0.1:3000/api/health && echo WEB_OK'

Write-Host ''
Write-Host 'DEPLOY COMPLETE.' -ForegroundColor Green
Write-Host ("SSH:  ssh -i `"{0}`" {1}@{2}" -f $KeyPath, $SshUser, $VpsIp) -ForegroundColor Yellow
Write-Host 'Then: cd /opt/sourcebd; tmux new -s bkmea ''docker compose run --rm etl run bkmea_web; bash''' -ForegroundColor Yellow

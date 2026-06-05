# ops/deploy-quick.ps1 — Incremental deploy for SourceBD (Spec FE-PROTO debug)
#
# Why this exists:
#   The default `ops/deploy.ps1` ships the whole repo and runs
#   `docker compose build --no-cache web`, which forces pnpm install + a fresh
#   `next build` on every push (~3 min). For UI tweaks / one-file bug fixes
#   that's overkill — pnpm-lock and node_modules haven't moved.
#
# What this does:
#   1. Discover only the files that changed (vs origin/development, plus
#      anything dirty in the working tree). User can also pass an explicit
#      file list as positional args.
#   2. Tar just those files, scp the tarball, extract on the VPS.
#   3. `docker compose build web` (no --no-cache → pnpm install layer is
#      reused → saves ~30s; only the `COPY . .` + `next build` re-runs).
#   4. `up -d --no-deps --force-recreate web`.
#   5. Run the build/recreate inside a detached tmux session so this script
#      returns immediately; tail /tmp/_quick.log to follow.
#
# Hard rules (AGENTS.md + /memories/scraping-ops.md):
#   - VPS: 109.104.153.228 only. Never touch 37.49.227.151.
#   - One SSH at a time (no parallel ssh fan-out).
#   - Use `ssh.exe -i ... -o BatchMode=yes -n` so VS Code PS doesn't swallow
#     stdout.
#
# Usage:
#   pwsh ops/deploy-quick.ps1                            # auto-detect changed files
#   pwsh ops/deploy-quick.ps1 components/foo.tsx app/globals.css
#   pwsh ops/deploy-quick.ps1 -FromGit                   # explicit auto-detect (same as default)

param(
    [switch] $FromGit,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $ExplicitFiles
)

$ErrorActionPreference = "Stop"

$VpsIp  = "109.104.153.228"
$VpsKey = "$env:USERPROFILE\.ssh\sourcebd_vps"
$VpsApp = "/opt/sourcebd"
$Vps    = "root@${VpsIp}"

function Invoke-Ssh {
    param([Parameter(Mandatory)][string] $Cmd)
    & ssh.exe -i $VpsKey -o BatchMode=yes -n $Vps $Cmd
    if ($LASTEXITCODE -ne 0) { throw "ssh failed (exit $LASTEXITCODE): $Cmd" }
}

function Invoke-Scp {
    param([Parameter(Mandatory)][string] $Local, [Parameter(Mandatory)][string] $Remote)
    & scp.exe -i $VpsKey -o BatchMode=yes -q $Local "${Vps}:${Remote}"
    if ($LASTEXITCODE -ne 0) { throw "scp failed (exit $LASTEXITCODE)" }
}

# 1. Resolve the file list -------------------------------------------------
$files = @()
if ($ExplicitFiles -and $ExplicitFiles.Count -gt 0 -and -not $FromGit) {
    $files = $ExplicitFiles
} else {
    Write-Host "==> Auto-detecting changed files (origin/development vs HEAD + dirty tree)" -ForegroundColor Cyan
    $committed = git diff --name-only origin/development...HEAD 2>$null
    $dirty     = git diff --name-only HEAD 2>$null
    $untracked = git ls-files --others --exclude-standard 2>$null
    $files = @($committed) + @($dirty) + @($untracked) `
        | Where-Object { $_ } `
        | Sort-Object -Unique
}

# Filter: ship code/assets, skip junk that has no business in a deploy.
$files = $files | Where-Object {
    Test-Path -LiteralPath $_ -PathType Leaf
} | Where-Object {
    $_ -notmatch '^_' -and
    $_ -notmatch '^context/' -and
    $_ -notmatch '^docs/' -and
    $_ -notmatch '^prototypes/' -and
    $_ -notmatch '^inapp-logos/' -and
    $_ -notmatch '^ops/' -and
    $_ -notmatch '^supabase/' -and
    $_ -notmatch '^\.env' -and
    $_ -notmatch '/\.DS_Store$' -and
    $_ -match '\.(ts|tsx|js|jsx|mjs|cjs|css|json|svg|png|jpg|jpeg|webp|ico|woff|woff2|sql|py|md)$'
}

if (-not $files -or $files.Count -eq 0) {
    Write-Error "No deployable files found. Pass paths explicitly or commit first."
    exit 1
}

Write-Host "==> Files to ship ($($files.Count)):" -ForegroundColor Cyan
$files | ForEach-Object { Write-Host "    $_" }

# 2. Pack -----------------------------------------------------------------
$stamp     = Get-Date -Format "yyMMdd_HHmmss"
$tarName   = "_quick_${stamp}.tar.gz"
$scriptSh  = "_quick_${stamp}.sh"

Write-Host "==> Packing $tarName" -ForegroundColor Cyan
# Use Windows-bundled bsdtar; --files-from avoids command-line length limits.
$listFile = "_quick_${stamp}.list"
Set-Content -Path $listFile -Value $files -Encoding ASCII
& tar.exe -czf $tarName --files-from=$listFile
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
$tarBytes = (Get-Item $tarName).Length
Write-Host "    bundle size: $tarBytes bytes" -ForegroundColor DarkGray

# 3. Remote deploy script (build via tmux so PS returns fast) ------------
$remote = @"
#!/usr/bin/env bash
set -euo pipefail
cd $VpsApp
echo "==> Extracting bundle"
tar -xzf /tmp/$tarName -C $VpsApp/
echo "--- files now on disk:"
tar -tzf /tmp/$tarName

echo "==> docker compose build web (layer-cached, no --no-cache)"
docker compose build web

echo "==> docker compose up -d --no-deps --force-recreate web"
docker compose up -d --no-deps --force-recreate web

sleep 6
echo "==> health probe"
curl -sf http://127.0.0.1:3000/api/health && echo "  health OK"
docker compose ps web
echo "==> DONE"
"@
$remote = $remote -replace "`r`n", "`n"
Set-Content -Path $scriptSh -Value $remote -Encoding ASCII -NoNewline

# 4. Ship + run -----------------------------------------------------------
Write-Host "==> scp bundle + script to VPS" -ForegroundColor Cyan
Invoke-Scp -Local $tarName  -Remote "/tmp/$tarName"
Invoke-Scp -Local $scriptSh -Remote "/tmp/$scriptSh"

Write-Host "==> launching deploy inside tmux session 'quick'" -ForegroundColor Cyan
Invoke-Ssh "chmod +x /tmp/$scriptSh; tmux kill-session -t quick 2>/dev/null; tmux new-session -d -s quick 'bash /tmp/$scriptSh > /tmp/_quick.log 2>&1'; echo started"

Write-Host ""
Write-Host "==> Deploy running on VPS. Tail with:" -ForegroundColor Green
Write-Host "    ssh.exe -i `$env:USERPROFILE\.ssh\sourcebd_vps -o BatchMode=yes -n root@$VpsIp 'tail -60 /tmp/_quick.log; echo ---; tmux ls 2>/dev/null'" -ForegroundColor DarkGray
Write-Host ""

# 5. Local cleanup --------------------------------------------------------
Remove-Item -ErrorAction SilentlyContinue $tarName, $scriptSh, $listFile

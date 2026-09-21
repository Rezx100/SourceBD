# Installs the Claude Code config staged in this folder into the repo root.
# Run from the repository root:  powershell -ExecutionPolicy Bypass -File claude-config-staging\install.ps1
$ErrorActionPreference = 'Stop'
$stage = $PSScriptRoot
$root  = Split-Path -Parent $stage
if (-not (Test-Path (Join-Path $root 'AGENTS.md'))) { throw "Run this from inside the SourceBD repo; AGENTS.md not found at $root" }

New-Item -ItemType Directory -Force -Path (Join-Path $root '.claude\hooks')    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root '.claude\agents')   | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root '.claude\commands') | Out-Null

Copy-Item (Join-Path $stage 'settings.json')  (Join-Path $root '.claude\settings.json')     -Force
Copy-Item (Join-Path $stage 'hooks\guard.py') (Join-Path $root '.claude\hooks\guard.py')    -Force
Copy-Item (Join-Path $stage 'agents\*.md')    (Join-Path $root '.claude\agents\')           -Force
Copy-Item (Join-Path $stage 'commands\*.md')  (Join-Path $root '.claude\commands\')         -Force
Copy-Item (Join-Path $stage 'mcp.json')       (Join-Path $root '.mcp.json')                 -Force

Write-Host "Installed:"
Get-ChildItem -Recurse -File (Join-Path $root '.claude') | ForEach-Object { "  .claude\" + $_.FullName.Substring((Join-Path $root '.claude').Length + 1) }
Write-Host "  .mcp.json"
Write-Host ""
Write-Host "Now delete this staging folder:  Remove-Item -Recurse -Force '$stage'"

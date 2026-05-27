param(
  [string]$Base = "origin/main",
  [string]$Head = "HEAD",
  [string]$PrNumber = "",
  [switch]$AllowRedZoneDiff,
  [switch]$AllowNetworkFindings,
  [switch]$AllowSecretPatternReferences,
  [switch]$RequireGitHubChecks
)

$ErrorActionPreference = "Stop"

function Invoke-Checked([string]$Command) {
  Write-Host "`n> $Command" -ForegroundColor Cyan
  if ($IsWindows) {
    cmd /c $Command
  } else {
    bash -lc $Command
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

function Fail-Gate([string]$Message) {
  Write-Host "`n[homeAI premerge gate BLOCKED] $Message" -ForegroundColor Red
  throw $Message
}

function Invoke-GitLines([string[]]$ArgsList) {
  $output = & git @ArgsList 2>$null
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {
    throw "git $($ArgsList -join ' ') failed with exit code $LASTEXITCODE"
  }
  return @($output | Where-Object { $_ -ne $null -and $_ -ne "" })
}

function Get-ScanFiles([string[]]$Files) {
  return @(
    $Files | Where-Object {
      $_ -and
      ($_ -notmatch '(^|/)\.claude(/|$)') -and
      ($_ -notmatch '\.(md|mdx|txt|ps1|sh|bash|yml|yaml|json|lock)$') -and
      ($_ -notmatch '(^|/)docs/') -and
      ($_ -notmatch '(^|/)\.hermes/workflows/') -and
      ($_ -notmatch '(^|/)\.hermes/skills/') -and
      ($_ -notmatch '(^|/)\.github/')
    }
  )
}

function Invoke-GrepOnFiles([string]$Pattern, [string[]]$Files) {
  if ($Files.Count -eq 0) { return @() }
  $argsList = @('grep', '-nE', $Pattern, '--') + $Files
  $output = & git @argsList 2>$null
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {
    throw "git grep failed with exit code $LASTEXITCODE"
  }
  return @($output | Where-Object { $_ -ne $null -and $_ -ne "" })
}

Write-Host "# homeAI Premerge Gate" -ForegroundColor Green

Invoke-Checked "git status --short"
$dirty = Invoke-GitLines @('status', '--short')
if ($dirty.Count -gt 0) {
  Fail-Gate "working tree is dirty; commit or discard changes before premerge"
}

Invoke-Checked "git branch --show-current"
Invoke-Checked "git diff --name-only $Base...$Head"
$changedFiles = Invoke-GitLines @('diff', '--name-only', "$Base...$Head")

Write-Host "`n# Space Truth red-zone diff" -ForegroundColor Yellow
$redZonePaths = @(
  'apps/web/app/p1/**',
  'packages/floorplan-parser/**',
  'packages/geometry/**',
  'packages/scene/**',
  'packages/contracts/src/p1-*',
  'packages/contracts/src/scene*',
  'packages/contracts/src/design-kernel*',
  'packages/contracts/src/layout-intent*',
  'packages/contracts/src/anchor*',
  'packages/contracts/src/floorplan*'
)
$redZoneDiff = Invoke-GitLines (@('diff', '--name-only', "$Base...$Head", '--') + $redZonePaths)
$redZoneDiff | ForEach-Object { Write-Host $_ }
if ($redZoneDiff.Count -gt 0 -and -not $AllowRedZoneDiff) {
  Fail-Gate "Space Truth red-zone diff is non-empty without explicit override/GPT approval"
}

Write-Host "`n# Typecheck" -ForegroundColor Yellow
Invoke-Checked "corepack pnpm typecheck"

Write-Host "`n# Full tests" -ForegroundColor Yellow
Invoke-Checked "corepack pnpm test"

Write-Host "`n# Scope tests" -ForegroundColor Yellow
Invoke-Checked "corepack pnpm vitest tests/scope"

$scanFiles = Get-ScanFiles $changedFiles

Write-Host "`n# .claude committed scan" -ForegroundColor Yellow
$claudeFiles = @($changedFiles | Where-Object { $_ -match '(^|/)\.claude(/|$)' })
$claudeFiles | ForEach-Object { Write-Host $_ }
if ($claudeFiles.Count -gt 0) {
  Fail-Gate ".claude files must not be committed"
}

Write-Host "`n# Network/provider scan" -ForegroundColor Yellow
$networkMatches = Invoke-GrepOnFiles '(fetch\(|axios|undici|node-fetch|XMLHttpRequest|node:http|node:https)' $scanFiles
$networkMatches | ForEach-Object { Write-Host $_ }
if ($networkMatches.Count -gt 0 -and -not $AllowNetworkFindings) {
  Fail-Gate "unauthorized network/provider call pattern found in changed runtime files"
}

Write-Host "`n# Secrets scan" -ForegroundColor Yellow
$secretMatches = Invoke-GrepOnFiles '(OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DASHSCOPE_API_KEY|SECRET|TOKEN|PASSWORD)' $scanFiles
$secretMatches | ForEach-Object { Write-Host $_ }
if ($secretMatches.Count -gt 0 -and -not $AllowSecretPatternReferences) {
  Fail-Gate "secret/token/password pattern found in changed runtime files"
}

Write-Host "`n# Real provider disabled scan" -ForegroundColor Yellow
$providerMatches = Invoke-GrepOnFiles '(realProviderEnabled\s*:\s*true|networkCallsEnabled\s*:\s*true|requiresRealPaymentProvider\s*:\s*true)' $scanFiles
$providerMatches | ForEach-Object { Write-Host $_ }
if ($providerMatches.Count -gt 0) {
  Fail-Gate "real provider, network, or payment provider appears enabled"
}

Write-Host "`n# CRLF / hidden unicode scan" -ForegroundColor Yellow
$bidiPattern = [regex]"[\u202A-\u202E\u2066-\u2069]"
foreach ($file in $changedFiles) {
  if (-not (Test-Path $file)) { continue }
  $bytes = [System.IO.File]::ReadAllBytes($file)
  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
  if ($text -match "`r`n") { Fail-Gate "CRLF line endings found in changed file: $file" }
  if ($bidiPattern.IsMatch($text)) { Fail-Gate "hidden bidi unicode found in changed file: $file" }
}

if ($RequireGitHubChecks) {
  Write-Host "`n# GitHub PR checks" -ForegroundColor Yellow
  if ([string]::IsNullOrWhiteSpace($PrNumber)) {
    Fail-Gate "RequireGitHubChecks was set but PrNumber is empty"
  }
  $checks = & gh pr checks $PrNumber --json name,state 2>$null
  if ($LASTEXITCODE -ne 0) { Fail-Gate "gh pr checks failed for PR #$PrNumber" }
  $parsed = $checks | ConvertFrom-Json
  if ($parsed.Count -eq 0) { Fail-Gate "GitHub checks are missing/zero for PR #$PrNumber" }
  $bad = @($parsed | Where-Object { $_.state -notin @('SUCCESS') })
  if ($bad.Count -gt 0) {
    $bad | ConvertTo-Json -Compress | Write-Host
    Fail-Gate "GitHub checks are pending, skipped, failing, or otherwise non-success"
  }
}

Write-Host "`n# Gate passed. Hermes must still evaluate review/GPT/merge-policy requirements." -ForegroundColor Green

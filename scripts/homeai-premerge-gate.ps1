param(
  [string]$Base = "origin/main",
  [string]$Head = "HEAD"
)

$ErrorActionPreference = "Stop"

function Run($cmd) {
  Write-Host "\n> $cmd" -ForegroundColor Cyan
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $cmd"
  }
}

Write-Host "# homeAI Premerge Gate" -ForegroundColor Green

Run "git status --short"
Run "git branch --show-current"
Run "git diff --name-only $Base...$Head"

Write-Host "\n# Space Truth red-zone diff" -ForegroundColor Yellow
cmd /c "git diff --name-only $Base...$Head -- `"apps/web/app/p1/**`" `"packages/floorplan-parser/**`" `"packages/geometry/**`" `"packages/scene/**`" `"packages/contracts/src/p1-*`" `"packages/contracts/src/scene*`" `"packages/contracts/src/design-kernel*`" `"packages/contracts/src/layout-intent*`" `"packages/contracts/src/anchor*`" `"packages/contracts/src/floorplan*`""

Write-Host "\n# Typecheck" -ForegroundColor Yellow
Run "corepack pnpm typecheck"

Write-Host "\n# Full tests" -ForegroundColor Yellow
Run "corepack pnpm test"

Write-Host "\n# Scope tests" -ForegroundColor Yellow
Run "corepack pnpm vitest tests/scope"

Write-Host "\n# Network scan" -ForegroundColor Yellow
cmd /c "git grep -nE `"(fetch\(|axios|undici|node-fetch|XMLHttpRequest|node:http|node:https)`" -- . || exit /b 0"

Write-Host "\n# Secrets scan" -ForegroundColor Yellow
cmd /c "git grep -nE `"(OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DASHSCOPE_API_KEY|SECRET|TOKEN|PASSWORD)`" -- . || exit /b 0"

Write-Host "\n# Gate finished. Hermes must still evaluate review/GPT/merge-policy requirements." -ForegroundColor Green

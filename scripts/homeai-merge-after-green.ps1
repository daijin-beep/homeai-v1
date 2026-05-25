param(
  [Parameter(Mandatory=$true)][string]$PrNumber,
  [string]$Method = "squash"
)

$ErrorActionPreference = "Stop"

if ($Method -notin @("squash", "merge")) {
  throw "Unsupported merge method: $Method"
}

Write-Host "# homeAI Merge Executor" -ForegroundColor Green
Write-Host "This script assumes Hermes merge gate has already passed." -ForegroundColor Yellow

cmd /c "gh pr view $PrNumber --json number,title,headRefName,baseRefName,mergeStateStatus,reviewDecision,statusCheckRollup"
if ($LASTEXITCODE -ne 0) { throw "Cannot view PR" }

if ($Method -eq "squash") {
  cmd /c "gh pr merge $PrNumber --squash --delete-branch"
} else {
  cmd /c "gh pr merge $PrNumber --merge --delete-branch"
}

if ($LASTEXITCODE -ne 0) { throw "Merge failed" }

Write-Host "Merge command completed. Hermes must send final WeChat report." -ForegroundColor Green

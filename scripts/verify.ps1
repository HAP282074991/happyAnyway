param(
  [ValidateSet('all', 'docs', 'backend', 'wechat')]
  [string]$Scope = 'all'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Check([string]$Name, [string]$Directory, [scriptblock]$Action) {
  Write-Output "Running: $Name"
  Push-Location -LiteralPath $Directory
  try {
    & $Action
    $results.Add([pscustomobject]@{ Check = $Name; Result = 'PASS' })
  } catch {
    $results.Add([pscustomobject]@{ Check = $Name; Result = 'FAIL' })
    Write-Output "FAIL: $Name - $($_.Exception.Message)"
  } finally {
    Pop-Location
  }
}

Invoke-Check 'Shared documents and references' $projectRoot {
  & node scripts/check-docs.mjs
  if ($LASTEXITCODE -ne 0) { throw "node exited with $LASTEXITCODE" }
}
Invoke-Check 'Backend document structure' (Join-Path $projectRoot 'happyAnyway-api') {
  & ./scripts/check-structure.ps1
}
if ($Scope -in @('all', 'backend')) {
  Invoke-Check 'Backend build and tests' (Join-Path $projectRoot 'happyAnyway-api') {
    & mvn.cmd verify
    if ($LASTEXITCODE -ne 0) { throw "Maven exited with $LASTEXITCODE" }
  }
}
if ($Scope -in @('all', 'wechat')) {
  Invoke-Check 'WeChat lint, types, build and resources' (Join-Path $projectRoot 'happyAnyway-wechat') {
    & npm.cmd run verify
    if ($LASTEXITCODE -ne 0) { throw "npm exited with $LASTEXITCODE" }
  }
}
$results | Format-Table -AutoSize
Write-Output 'Only selected local checks ran. Independent review, business acceptance, MySQL and device validation are not implied.'
if (@($results | Where-Object Result -eq 'FAIL').Count -gt 0) { exit 1 }

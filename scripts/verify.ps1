param(
  [ValidateSet('all', 'docs', 'backend', 'wechat')]
  [string]$Scope = 'all',
  [switch]$CI
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$results = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTimeOffset]::Now.ToString('o')
$runName = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$reportDirectory = Join-Path $projectRoot ('.reports/verify/' + $runName)
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null

function Invoke-NativeCheck([string]$Program, [string[]]$Arguments) {
  Get-Command $Program -ErrorAction Stop | Out-Null
  # PowerShell 5 turns redirected native stderr into ErrorRecords. A warning on
  # stderr must not abort a successful build; the native exit code is authoritative.
  $local:ErrorActionPreference = 'Continue'
  $output = & $Program @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  foreach ($line in $output) { Write-Output $line.ToString() }
  if ($exitCode -ne 0) { throw "$Program exited with $exitCode" }
}

function Invoke-Check([string]$Name, [string]$Directory, [scriptblock]$Action) {
  Write-Output "Running: $Name"
  $locationPushed = $false
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $logName = ($Name -replace '[^a-zA-Z0-9]+', '-').Trim('-') + '.log'
  $logPath = Join-Path $reportDirectory $logName
  try {
    # Windows PowerShell can push the old location before rejecting a missing path.
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
      throw "Missing check directory: $Directory"
    }
    Push-Location -LiteralPath $Directory
    $locationPushed = $true
    # Windows PowerShell Tee-Object writes UTF-16; use explicit UTF-8 throughout
    # so failure details appended below cannot corrupt an otherwise readable log.
    & $Action 2>&1 | ForEach-Object {
      $_ | Out-File -LiteralPath $logPath -Append -Encoding utf8
      Write-Output $_
    }
    $results.Add([pscustomobject]@{ Check = $Name; Result = 'PASS'; Seconds = $timer.Elapsed.TotalSeconds; Log = $logName; Command = $Action.ToString().Trim() })
  } catch {
    $results.Add([pscustomobject]@{ Check = $Name; Result = 'FAIL'; Seconds = $timer.Elapsed.TotalSeconds; Log = $logName; Command = $Action.ToString().Trim() })
    $_.Exception.Message | Out-File -LiteralPath $logPath -Append -Encoding utf8
    Write-Output "FAIL: $Name - $($_.Exception.Message)"
  } finally {
    if ($locationPushed) { Pop-Location }
  }
}

Invoke-Check 'Document checker regression tests' $projectRoot {
  $testFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'scripts') -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
  if ($testFiles.Count -eq 0) { throw 'No checker regression tests found' }
  Invoke-NativeCheck -Program 'node' -Arguments (@('--test') + $testFiles)
}
Invoke-Check 'Task permissions and delivery evidence' $projectRoot {
  if ($CI) { Invoke-NativeCheck -Program 'node' -Arguments @('scripts/check-tasks.mjs', '--ci') }
  else { Invoke-NativeCheck -Program 'node' -Arguments @('scripts/check-tasks.mjs') }
}
Invoke-Check 'Shared documents and references' $projectRoot {
  Invoke-NativeCheck -Program 'node' -Arguments @('scripts/check-docs.mjs')
}
Invoke-Check 'Backend document structure' (Join-Path $projectRoot 'happyAnyway-api') {
  & ./scripts/check-structure.ps1
}
if ($Scope -in @('all', 'backend')) {
  Invoke-Check 'Backend build and tests' (Join-Path $projectRoot 'happyAnyway-api') {
    Invoke-NativeCheck -Program 'mvn.cmd' -Arguments @('verify')
  }
}
if ($Scope -in @('all', 'wechat')) {
  Invoke-Check 'WeChat lint, types, build and resources' (Join-Path $projectRoot 'happyAnyway-wechat') {
    Invoke-NativeCheck -Program 'npm.cmd' -Arguments @('run', 'verify')
  }
}
$results | Select-Object Check, Result, Seconds | Format-Table -AutoSize
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$sourceCommit = & git -C $projectRoot rev-parse HEAD 2>$null
$sourceAvailable = ($LASTEXITCODE -eq 0)
$gitRoot = & git -C $projectRoot rev-parse --show-toplevel 2>$null
$sourceAvailable = $sourceAvailable -and $gitRoot -and ([IO.Path]::GetFullPath($gitRoot) -eq [IO.Path]::GetFullPath($projectRoot))
if (-not $sourceAvailable) { $sourceCommit = $null }
$dirtyPaths = @(& git -C $projectRoot status --porcelain --untracked-files=normal 2>$null)
$ErrorActionPreference = $previousPreference
$nodeVersion = try { & node --version } catch { 'unavailable' }
$summary = [ordered]@{
  schemaVersion = 1
  startedAt = $startedAt
  finishedAt = [DateTimeOffset]::Now.ToString('o')
  scope = $Scope
  ci = [bool]$CI
  commit = $sourceCommit
  sourceAvailable = $sourceAvailable
  dirty = $(if ($sourceAvailable) { $dirtyPaths.Count -gt 0 } else { $null })
  environment = @{ os = [Environment]::OSVersion.ToString(); powershell = $PSVersionTable.PSVersion.ToString(); node = $nodeVersion }
  checks = @($results.ToArray())
  unverified = @('Independent review', 'Independent testing', 'Business acceptance', 'Real MySQL integration', 'WeChat device validation', 'Remote branch protection')
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reportDirectory 'summary.json') -Encoding utf8
Write-Output "Reports: $reportDirectory"
Write-Output 'Only selected local checks ran. Independent review, business acceptance, MySQL and device validation are not implied.'
if (@($results | Where-Object Result -eq 'FAIL').Count -gt 0) { exit 1 }

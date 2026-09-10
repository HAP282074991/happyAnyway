$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$required = @(
  'AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'docs/index.md', 'docs/quality.md',
  'docs/HANDOFF.md', 'docs/rules/development.md', 'docs/rules/testing.md',
  'docs/rules/review.md', 'docs/rules/api.md', 'docs/rules/database.md'
)
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative) -PathType Leaf)) { throw "Missing: $relative" }
}
function Get-ProjectDocuments([string]$directory) {
  foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
    if ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
    if ($entry.PSIsContainer) {
      if ($entry.Name -notin @('.git', 'target')) { Get-ProjectDocuments $entry.FullName }
    } elseif ($entry.Extension -eq '.md') { $entry }
  }
}
$documents = @(Get-ProjectDocuments $projectRoot)
foreach ($document in $documents) {
  $content = Get-Content -LiteralPath $document.FullName -Raw -Encoding UTF8
  foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\(([^)]+)\)')) {
    $target = $match.Groups[1].Value.Split('#')[0]
    if (-not $target -or $target -match '^[a-zA-Z]+:' -or $target.StartsWith('/')) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $document.DirectoryName $target))) { throw "Broken link in $($document.FullName): $target" }
  }
}
Write-Output 'PASS: Harness required files and local Markdown links (not semantic or application validation).'

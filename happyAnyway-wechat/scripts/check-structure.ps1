$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$required = @('AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'docs/index.md', 'docs/quality.md')
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative) -PathType Leaf)) { throw "Missing: $relative" }
}
$documents = Get-ChildItem -LiteralPath $projectRoot -Filter '*.md' -Recurse -File
foreach ($document in $documents) {
  $content = Get-Content -LiteralPath $document.FullName -Raw -Encoding UTF8
  foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\(([^)]+)\)')) {
    $target = $match.Groups[1].Value.Split('#')[0]
    if (-not $target -or $target -match '^[a-zA-Z]+:' -or $target.StartsWith('/')) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $document.DirectoryName $target))) { throw "Broken link in $($document.FullName): $target" }
  }
}
Write-Output 'PASS: scaffold files and local Markdown links (not application validation).'

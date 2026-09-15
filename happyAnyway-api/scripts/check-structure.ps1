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
# Use the same Markdown parser as the root and WeChat checks. Requires Node.js 22+.
& node (Join-Path $projectRoot '../scripts/check-docs.mjs') --markdown-tree $projectRoot
if ($LASTEXITCODE -ne 0) { throw "Markdown checks exited with $LASTEXITCODE" }
Write-Output 'PASS: Harness required files and local Markdown links (not semantic or application validation).'

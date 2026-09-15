import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('verify records a missing directory, continues, restores location and fails overall', t => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'happyAnyway-verify-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'happyAnyway-wechat'));
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'verify.ps1'), join(root, 'scripts/verify.ps1'));
  // Stub external commands, but execute the complete real orchestrator. The backend
  // directory is deliberately absent; no build, package install or recursive test runs.
  writeFileSync(join(root, 'run.ps1'), `
$ErrorActionPreference = 'Stop'
$initialLocation = (Get-Location).Path
$initialStackCount = @(Get-Location -Stack | ForEach-Object { $_ }).Count
$expectedWechat = (Get-Item -LiteralPath (Join-Path $PSScriptRoot 'happyAnyway-wechat')).FullName
function node { $global:LASTEXITCODE = 0 }
function npm.cmd {
  if ((Get-Item -LiteralPath (Get-Location).Path).FullName -ne $expectedWechat) { throw "Wrong working directory: actual=$((Get-Location).Path) expected=$expectedWechat" }
  if (@(Get-Location -Stack | ForEach-Object { $_ }).Count -ne ($initialStackCount + 1)) { throw "Location stack corrupted: initial=$initialStackCount actual=$(@(Get-Location -Stack | ForEach-Object { $_ }).Count)" }
  Write-Output 'WECHAT_CHECK_REACHED'
  $global:LASTEXITCODE = 0
}
try { & (Join-Path $PSScriptRoot 'scripts/verify.ps1') -Scope all }
finally {
  if ((Get-Location).Path -ne $initialLocation) { throw 'Location not restored' }
  if (@(Get-Location -Stack | ForEach-Object { $_ }).Count -ne $initialStackCount) { throw 'Location stack not restored' }
  Write-Output 'LOCATION_RESTORED'
}
exit $LASTEXITCODE
`);
  const result = spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'run.ps1')], { encoding: 'utf8', timeout: 20000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /FAIL: Backend document structure/, result.stderr);
  assert.match(result.stdout, /FAIL: Backend build and tests/);
  assert.match(result.stdout, /WECHAT_CHECK_REACHED/);
  assert.match(result.stdout, /LOCATION_RESTORED/);
  assert.doesNotMatch(result.stderr, /stack|not restored|Wrong working directory/);
});

test('a nonzero task checker fails the real orchestrator and persists evidence while later checks run', t => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'happyAnyway-verify-failure-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'happyAnyway-api/scripts'), { recursive: true });
  mkdirSync(join(root, 'happyAnyway-wechat'));
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'verify.ps1'), join(root, 'scripts/verify.ps1'));
  writeFileSync(join(root, 'scripts/fixture.test.mjs'), '// Never executed: node is stubbed.');
  writeFileSync(join(root, 'happyAnyway-api/scripts/check-structure.ps1'), "Write-Output 'STRUCTURE_REACHED'");
  writeFileSync(join(root, 'run.ps1'), `
function node {
  if ($args -contains 'scripts/check-tasks.mjs') { Write-Output 'TASK_FAILURE_SENTINEL'; $global:LASTEXITCODE = 23 }
  else { $global:LASTEXITCODE = 0 }
}
function mvn.cmd { & cmd.exe /d /c 'echo NATIVE_WARNING_SENTINEL 1>&2'; $global:LASTEXITCODE = 0 }
function npm.cmd { Write-Output 'WECHAT_REACHED_AFTER_FAILURE'; $global:LASTEXITCODE = 0 }
& (Join-Path $PSScriptRoot 'scripts/verify.ps1')
exit $LASTEXITCODE
`);
  const result = spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'run.ps1')], { encoding: 'utf8', timeout: 20000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /WECHAT_REACHED_AFTER_FAILURE/);
  const reports = join(root, '.reports/verify');
  const run = join(reports, readdirSync(reports)[0]);
  const summary = JSON.parse(readFileSync(join(run, 'summary.json'), 'utf8').replace(/^\uFEFF/, ''));
  const taskCheck = summary.checks.find(check => check.Check === 'Task permissions and delivery evidence');
  assert.equal(taskCheck.Result, 'FAIL');
  assert.equal(summary.checks.at(-1).Result, 'PASS');
  assert.match(readFileSync(join(run, taskCheck.Log), 'utf8'), /TASK_FAILURE_SENTINEL/);
  assert.match(readFileSync(join(run, taskCheck.Log), 'utf8'), /node exited with 23/);
  const backendCheck = summary.checks.find(check => check.Check === 'Backend build and tests');
  assert.equal(backendCheck.Result, 'PASS');
  assert.match(readFileSync(join(run, backendCheck.Log), 'utf8'), /NATIVE_WARNING_SENTINEL/);
  assert.ok(summary.unverified.includes('Independent review'));
});

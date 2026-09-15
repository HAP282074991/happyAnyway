import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync, readdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { previewBaseline, baselinePlan } from './baseline.mjs';
import { phaseOf, checkLifecycle, effectivePolicy } from './project-lifecycle.mjs';
import { checkProject } from './check-docs.mjs';
import { loadTasks } from './check-tasks.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const parent = realpathSync.native(mkdtempSync(join(tmpdir(), 'clean-baseline-')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  // Copy reusable assets into an explicitly staged fixture. Never change the
  // real project's phase or ask the production exporter to clean development.
  const seed = join(parent, 'seed');
  for (const path of baselinePlan(source).keep) {
    const destination = join(seed, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(source, path), destination);
  }
  writeFileSync(join(seed, 'docs/project-state.json'), JSON.stringify({ schemaVersion: 1, phase: 'architecture' }));
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
    for (const state of ['active', 'completed']) {
      const directory = join(seed, component, 'docs/exec-plans', state);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, '0001-development-setup.md'), '# Fixture preparation history\n');
    }
  }
  const project = join(parent, 'preview');
  previewBaseline(seed, project);
  const put = (path, value) => { mkdirSync(dirname(join(project, path)), { recursive: true }); writeFileSync(join(project, path), typeof value === 'string' ? value : JSON.stringify(value)); };
  const git = args => execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const cli = args => spawnSync(process.execPath, [join(project, 'scripts/check-tasks.mjs'), ...args], { cwd: project, encoding: 'utf8' });
  return { parent, seed, project, put, git, cli };
}

test('exported baseline has no preparation records or identities and passes checks without Git', t => {
  const before = readFileSync(join(source, 'docs/project-state.json'), 'utf8');
  const f = fixture(t);
  assert.equal(phaseOf(f.project), 'ready');
  assert.deepEqual(loadTasks(f.project), []);
  assert.equal(checkLifecycle(f.project), 'ready');
  assert.doesNotThrow(() => checkProject(f.project));
  assert.deepEqual(readdirSync(join(f.project, 'docs/tasks')).sort(), ['TEMPLATE.md', 'runtime.json']);
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
    assert.ok(existsSync(join(f.project, component, 'docs/exec-plans/README.md')));
    for (const state of ['active', 'completed']) {
      const path = `${component}/docs/exec-plans/${state}`;
      assert.deepEqual(readdirSync(join(f.project, path)), ['.gitkeep']);
      assert.equal(readFileSync(join(f.project, path, '.gitkeep')).length, 0);
      assert.ok(existsSync(join(f.seed, path, '0001-development-setup.md')), 'Source history must remain intact');
    }
  }
  const result = f.cli([]); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /zero tasks|zero runtime|零|Clean baseline/);
  assert.equal(f.cli(['--dispatch', 'TASK-20260915-001']).status, 1);
  assert.equal(readFileSync(join(source, 'docs/project-state.json'), 'utf8'), before);
  const policy = effectivePolicy(f.project);
  assert.ok(Object.values(policy.roles).every(role => role.enabled === false));
  for (const path of baselinePlan(f.project).keep) {
    if (!/\.(md|json|mjs|ps1|yml)$/.test(path) || path.endsWith('.test.mjs')) continue;
    const text = readFileSync(join(f.project, path), 'utf8');
    assert.doesNotMatch(text, /01a0[0-9a-f]{4}-|[CD]:[\\/]AIProject|C:[\\/]Users[\\/]Administrator|TASK-20260915-006|TASK-20260915-007/, path);
  }
});

test('preview refuses overwrite/development and excludes private environment and generated files', t => {
  const f = fixture(t);
  assert.throws(() => previewBaseline(f.seed, f.project), /already exists/);
  assert.throws(() => previewBaseline(f.seed, f.seed), /Unsafe/);
  f.put('.env', 'PRIVATE_FIXTURE');
  f.put('happyAnyway-wechat/project.private.config.json', '{}');
  f.put('happyAnyway-wechat/miniprogram/app.js', 'generated');
  const next = join(f.parent, 'second'); previewBaseline(f.project, next);
  assert.equal(existsSync(join(next, '.env')), false);
  assert.equal(existsSync(join(next, 'happyAnyway-wechat/project.private.config.json')), false);
  assert.equal(existsSync(join(next, 'happyAnyway-wechat/miniprogram/app.js')), false);
  assert.equal(existsSync(join(next, 'happyAnyway-api/.env.example')), true);
  f.put('docs/project-state.json', { schemaVersion: 1, phase: 'development' });
  assert.throws(() => previewBaseline(f.project, join(f.parent, 'third')), /active development/);
});

test('ready rejects runtime residue; architecture permits no roles but rejects business tasks', t => {
  const f = fixture(t);
  f.put('docs/tasks/runtime.json', { schemaVersion: 1, roles: { pm: { enabled: false } }, exceptions: {} });
  assert.throws(() => checkLifecycle(f.project), /no runtime/);
  f.put('docs/project-state.json', { schemaVersion: 1, phase: 'architecture' });
  assert.equal(checkLifecycle(f.project), 'architecture');
  assert.throws(() => checkLifecycle(f.project, [{ kind: 'business' }]), /Business tasks/);
});

test('ready rejects every excluded history location and changed reset document', t => {
  const f = fixture(t);
  for (const path of [
    'docs/decisions/progress-history-20260913.md',
    'docs/decisions/0001-multi-repository.md',
    'happyAnyway-api/docs/exec-plans/active/nested/history.md',
    'happyAnyway-api/docs/exec-plans/completed/history.md',
    'happyAnyway-wechat/docs/exec-plans/active/nested/history.md',
    'happyAnyway-wechat/docs/exec-plans/completed/0001-development-setup.md',
  ]) {
    f.put(path, '# historical residue');
    assert.throws(() => checkLifecycle(f.project), /excluded residue/);
    rmSync(join(f.project, path));
  }
  for (const path of ['docs/progress.md', 'docs/agent-init.md']) {
    const original = readFileSync(join(f.project, path));
    f.put(path, '# stale registration');
    assert.throws(() => checkLifecycle(f.project), /reset mismatch/);
    writeFileSync(join(f.project, path), original);
  }
  assert.equal(checkLifecycle(f.project), 'ready');
});

test('fresh development dispatch accepts not-yet-created output and rejects phase rollback', t => {
  const f = fixture(t);
  const registry = JSON.parse(readFileSync(join(f.project, 'docs/agents/versions.json'), 'utf8'));
  const config = registry.entries.find(e => e.path === 'AGENTS.md');
  const workflow = registry.entries.find(e => e.path === 'docs/workflow.md');
  const agentId = '11111111-1111-1111-1111-111111111111';
  f.put('docs/project-state.json', { schemaVersion: 1, phase: 'development' });
  f.put('docs/tasks/runtime.json', { schemaVersion: 1, roles: { pm: { enabled: true, agentId, config, workflow } }, exceptions: {} });
  f.git(['init']); f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'development baseline']);
  const id = 'TASK-20260915-001';
  const task = { schemaVersion: 1, id, title: 'New document', kind: 'infrastructure', status: 'draft', role: 'pm', agentId, senderId: agentId, config, workflow,
    createdAt: '2026-09-15T10:35:31+08:00', workDirectory: f.project.replaceAll('\\', '/'), baseCommit: f.git(['rev-parse', 'HEAD']).trim(), source: 'fixture baseline', dispatchSequence: 'D001',
    instructions: `${id} D001 docs/tasks/${id}.md`, writeScopes: ['docs/tasks/', 'docs/decisions/new.md'], artifactScopes: ['docs/decisions/new.md'], dependencies: [],
    acceptance: 'new document reviewed', verification: 'check links', estimate: 'this run', feedback: 'delivery', outOfScope: 'other code', evidence: {} };
  f.put(`docs/tasks/${id}.md`, '# task'); f.put(`docs/tasks/automation/${id}.json`, task);
  const result = f.cli(['--dispatch', id]); assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(f.project, 'docs/decisions/new.md')), false);
  f.put('docs/project-state.json', { schemaVersion: 1, phase: 'architecture' });
  assert.match(f.cli([]).stderr, /Cannot bypass development/);
});

test('ready rejects stale component references and preview resets both without changing its source', t => {
  const f = fixture(t);
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
    const path = `${component}/specs-reference.json`;
    const clean = JSON.parse(readFileSync(join(f.project, path), 'utf8'));
    for (const change of [{ status: 'pinned', revision: 'a'.repeat(40) }, { features: ['old-feature'] }, { revision: 'a'.repeat(40) }]) {
      f.put(path, { ...clean, ...change });
      assert.throws(() => checkLifecycle(f.project), /stale specification/);
    }
    f.put(path, { ...clean, status: 'pinned', revision: 'a'.repeat(40), features: ['old-feature'] });
  }
  f.put('docs/project-state.json', { schemaVersion: 1, phase: 'architecture' });
  const next = join(f.parent, 'reset');
  previewBaseline(f.project, next);
  assert.equal(checkLifecycle(next), 'ready');
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
    assert.equal(JSON.parse(readFileSync(join(f.project, component, 'specs-reference.json'), 'utf8')).status, 'pinned');
    assert.deepEqual(JSON.parse(readFileSync(join(next, component, 'specs-reference.json'), 'utf8')).features, []);
  }
});

// Child processes execute the complete lifecycle suite in each source phase;
// omit only this orchestration case inside children to avoid recursive spawning.
if (!process.env.LIFECYCLE_PHASE_CHILD) test('lifecycle suite runs from architecture, ready and development checkouts', t => {
  const f = fixture(t);
  for (const phase of ['architecture', 'ready', 'development']) {
    f.put('docs/project-state.json', { schemaVersion: 1, phase });
    const environment = { ...process.env, LIFECYCLE_PHASE_CHILD: '1' };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', 'scripts/project-lifecycle.test.mjs'], {
      cwd: f.project, encoding: 'utf8', env: environment,
    });
    assert.equal(result.status, 0, `${phase}: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /# tests 6\b/, `${phase}: child suite must actually execute`);
    assert.match(result.stdout, /# pass 6\b/);
  }
});

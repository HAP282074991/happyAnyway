import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate, snapshot, fileDigest, safePath, changedFiles, ciBase, loadTasks, checkTransitions } from './check-tasks.mjs';

const pm = '11111111-1111-1111-1111-111111111111';
const clone = value => structuredClone(value);
function fixture(t) {
  const project = mkdtempSync(join(tmpdir(), 'task-gate-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  const put = (path, content) => { mkdirSync(join(project, path, '..'), { recursive: true }); writeFileSync(join(project, path), content); };
  const git = args => execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']);
  put('docs/tasks/TASK-20260915-001.md', '# human dispatch\n');
  put('rules.md', '# V1\n');
  put('src/a.txt', 'original\n');
  git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
  const baseCommit = git(['rev-parse', 'HEAD']).trim();
  const config = { path: 'rules.md', version: 'V1', digest: fileDigest(readFileSync(join(project, 'rules.md'))) };
  const role = { enabled: true, agentId: pm, config, workflow: config, writeScopes: ['src/', 'docs/tasks/'] };
  const policy = { schemaVersion: 1, migrationBase: baseCommit, roles: { pm: role }, legacyTasks: [] };
  const task = { schemaVersion: 1, id: 'TASK-20260915-001', title: 'Fixture', status: 'in_progress', kind: 'infrastructure', role: 'pm', agentId: pm, senderId: pm, config, workflow: config, baseCommit, createdAt: '2026-09-15T10:11:57+08:00', workDirectory: project.replaceAll('\\', '/'), source: 'fixture commit', dispatchSequence: 'D001', instructions: 'TASK-20260915-001 D001 docs/tasks/TASK-20260915-001.md', acceptance: 'Check declared outputs', verification: 'node --test', estimate: 'this run', feedback: 'when checks finish', outOfScope: 'unrelated changes', writeScopes: ['src/'], artifactScopes: ['src/'], dependencies: [], evidence: {} };
  const check = (value = task, options = {}) => validate(project, policy, [value], options);
  const evidence = (value, stage, agentId) => {
    const report = `docs/tasks/${stage}.txt`;
    put(report, `${stage} passed\n`);
    value.evidence[stage] = { result: 'pass', digest: value.snapshot.digest, agentId, report, reportDigest: fileDigest(readFileSync(join(project, report))), command: 'fixture test', environment: 'isolated fixture', recordedAt: '2026-09-15T10:11:57+08:00' };
  };
  return { project, policy, task, put, git, check, evidence };
}

test('dispatch accepts confirmed identity, scope and versions; rejects missing or placeholder fields', t => {
  const f = fixture(t);
  assert.equal(f.check().active, 1);
  for (const key of ['acceptance', 'verification', 'estimate', 'feedback', 'instructions', 'createdAt']) {
    const value = clone(f.task); delete value[key];
    assert.throws(() => f.check(value), /missing|placeholder/);
  }
  const draft = { ...f.task, status: 'draft', acceptance: '待填写' };
  assert.equal(f.check(draft).active, 0);
  assert.throws(() => f.check(draft, { dispatch: draft.id }), /placeholder/);
  assert.throws(() => f.check({ ...f.task, status: 'cancelled' }, { dispatch: f.task.id }), /Closed task/);
  assert.throws(() => f.check({ ...f.task, artifactScopes: ['rules.md'] }), /omitted from delivery/);
});

test('duplicate ids, unregistered tasks, invalid recipients and unacknowledged rules fail', t => {
  const f = fixture(t);
  assert.throws(() => validate(f.project, f.policy, [f.task, f.task]), /Duplicate/);
  assert.throws(() => f.check({ ...f.task, agentId: 'not-confirmed' }), /identity/);
  assert.throws(() => f.check({ ...f.task, senderId: 'not-confirmed' }), /sender/);
  f.policy.roles.pm.enabled = false;
  assert.throws(() => f.check(), /recipient/);
  f.policy.roles.pm.enabled = true;
  assert.throws(() => f.check({ ...f.task, config: { ...f.task.config, version: 'V0' } }), /unacknowledged/);
  f.put('rules.md', '# V2\n');
  assert.throws(() => f.check(), /configuration changed/);
  f.put('docs/tasks/TASK-20260915-002.md', '# not registered');
  assert.throws(() => f.check(), /Missing machine-readable/);
});

test('path boundaries reject traversal, sibling prefixes and unauthorized task exceptions', t => {
  const f = fixture(t);
  for (const path of ['../secret', '/absolute', 'C:/secret', 'src/../secret', 'src\\secret', '.git/config', 'src//x', 'src./x']) assert.equal(safePath(path), false, path);
  assert.equal(safePath('.github/workflows/verify.yml'), true);
  assert.throws(() => f.check({ ...f.task, writeScopes: ['src-other/'] }), /unauthorized/);
  assert.throws(() => f.check(f.task, { changes: ['src-other/a.txt'] }), /no authorized/);
  assert.throws(() => f.check(f.task, { changes: ['../outside'] }), /Unsafe/);
  f.policy.exceptions = { [f.task.id]: { agentId: 'different', authorization: 'test', writeScopes: ['outside/'] } };
  assert.throws(() => f.check(), /exception authorization/);
});

test('development does not inherit architecture migration exemptions', t => {
  const f = fixture(t);
  f.put('old.txt', 'old repair\n');
  f.policy.legacyChanges = { 'old.txt': fileDigest(readFileSync(join(f.project, 'old.txt'))) };
  assert.throws(() => f.check(f.task, { changes: ['old.txt'] }), /no authorized/);
  f.put('old.txt', 'different\n');
  assert.throws(() => f.check(f.task, { changes: ['old.txt'] }), /no authorized/);
  assert.throws(() => f.check({ ...f.task, status: 'draft' }, { changes: ['src/a.txt'] }), /no authorized/);
});

test('dependencies reject unknown, unmet, cancelled and cyclic prerequisites', t => {
  const f = fixture(t);
  assert.throws(() => f.check({ ...f.task, dependencies: [{ id: 'missing', requiredStatus: 'tested' }] }), /dependency/);
  const other = { ...clone(f.task), id: 'TASK-20260915-002', status: 'draft', dependencies: [{ id: f.task.id, requiredStatus: 'tested' }] };
  f.put('docs/tasks/TASK-20260915-002.md', '# second task');
  f.task.dependencies = [{ id: other.id, requiredStatus: 'tested' }];
  assert.throws(() => validate(f.project, f.policy, [f.task, other]), /not ready/);
  f.task.status = 'draft';
  assert.throws(() => validate(f.project, f.policy, [f.task, other]), /Circular/);
  f.task.status = 'in_progress'; other.status = 'cancelled';
  assert.throws(() => validate(f.project, f.policy, [f.task, other]), /not ready/);
});

test('business work requires approval evidence and an existing pinned specification', t => {
  const f = fixture(t);
  assert.throws(() => f.check({ ...f.task, kind: 'business' }), /not approved/);
  assert.throws(() => f.check({ ...f.task, kind: 'business', specification: { approved: true, commit: f.task.baseCommit, approvalRecord: 'absent.md' } }), /missing business approval/);
});

test('snapshots detect modified, added and deleted artifacts, while LF/CRLF stays stable', t => {
  const f = fixture(t);
  f.task.status = 'self_checked';
  f.task.snapshot = snapshot(f.project, f.task); f.evidence(f.task, 'self', pm);
  assert.doesNotThrow(() => f.check());
  f.put('src/a.txt', 'original\r\n'); assert.doesNotThrow(() => f.check());
  f.put('src/a.txt', 'changed\n'); assert.throws(() => f.check(), /snapshot.*stale/);
  f.put('src/a.txt', 'original\n'); f.put('src/new.txt', 'new'); assert.throws(() => f.check(), /snapshot.*stale/);
  unlinkSync(join(f.project, 'src/new.txt')); unlinkSync(join(f.project, 'src/a.txt'));
  assert.throws(() => f.check(), /empty artifact/);
});

test('missing, stale, modified and self-authored independent evidence cannot pass delivery', t => {
  const f = fixture(t);
  f.task.status = 'self_checked'; f.task.snapshot = snapshot(f.project, f.task);
  assert.throws(() => f.check(), /self evidence missing/);
  f.evidence(f.task, 'self', pm);
  assert.throws(() => f.check(f.task, { delivery: f.task.id }), /review evidence missing/);
  f.task.evidence.self.digest = '0'.repeat(64);
  assert.throws(() => f.check(), /self evidence missing/);
  f.task.evidence.self.digest = f.task.snapshot.digest;
  f.put('docs/tasks/self.txt', 'modified report'); assert.throws(() => f.check(), /report missing or changed/);
  f.evidence(f.task, 'self', pm); f.evidence(f.task, 'review', pm);
  f.policy.roles.reviewer = clone(f.policy.roles.pm);
  assert.throws(() => f.check(f.task, { delivery: f.task.id }), /confirmed independent/);
  const reviewer = '22222222-2222-2222-2222-222222222222';
  const tester = '33333333-3333-3333-3333-333333333333';
  f.policy.roles.reviewer.agentId = reviewer;
  f.policy.roles.tester = { ...clone(f.policy.roles.pm), agentId: tester };
  f.evidence(f.task, 'review', reviewer); f.evidence(f.task, 'test', tester);
  f.task.status = 'tested'; assert.doesNotThrow(() => f.check(f.task, { delivery: f.task.id }));
  f.task.status = 'accepted'; assert.throws(() => f.check(), /deliveryCommit/);
  // Accepted records bind to an immutable commit, so future work does not stale
  // old deliveries. No commits are created in the actual project by this test.
  f.put('docs/agents/automation-policy.json', JSON.stringify(f.policy));
  f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'delivery']);
  f.task.deliveryCommit = f.git(['rev-parse', 'HEAD']).trim();
  assert.throws(() => f.check(), /user acceptance/);
  f.put('docs/tasks/acceptance.txt', 'fixture user acceptance');
  f.task.userAcceptance = { record: 'docs/tasks/acceptance.txt', digest: fileDigest(readFileSync(join(f.project, 'docs/tasks/acceptance.txt'))) };
  f.put('src/a.txt', 'next task changed source\n');
  f.put('rules.md', '# V2\n');
  assert.doesNotThrow(() => f.check());
  assert.throws(() => f.check(f.task, { changes: ['src/a.txt'] }), /no authorized/);
});

test('Git scope checks include staged, unstaged, untracked and both rename paths', t => {
  const f = fixture(t);
  f.git(['mv', 'src/a.txt', 'src/renamed.txt']); f.put('src/renamed.txt', 'edited\n'); f.put('untracked.txt', 'new');
  assert.deepEqual(changedFiles(f.project, f.task.baseCommit).sort(), ['src/a.txt', 'src/renamed.txt', 'untracked.txt']);
  assert.throws(() => changedFiles(f.project, '--help'), /full commit/);
});

test('CI uses event base and fallback; metadata filename must match task id', t => {
  const f = fixture(t);
  f.put('docs/agents/automation-policy.json', JSON.stringify(f.policy));
  for (const [name, event] of [['pull_request', { pull_request: { base: { sha: f.task.baseCommit } } }], ['push', { before: f.task.baseCommit }], ['merge_group', { merge_group: { base_sha: f.task.baseCommit } }], ['push', { before: '0'.repeat(40) }], ['workflow_dispatch', {}]]) assert.equal(ciBase(f.project, name, event), f.task.baseCommit);
  f.put('docs/tasks/automation/wrong.json', JSON.stringify(f.task));
  assert.throws(() => loadTasks(f.project), /filename\/id mismatch/);
});

test('dispatching a draft also checks the recipient currently executing another task', t => {
  const f = fixture(t);
  const draft = { ...clone(f.task), id: 'TASK-20260915-002', status: 'draft', instructions: 'TASK-20260915-002 D001 docs/tasks/TASK-20260915-002.md' };
  f.put('docs/tasks/TASK-20260915-002.md', '# draft');
  assert.throws(() => validate(f.project, f.policy, [f.task, draft], { dispatch: draft.id }), /concurrent active tasks/);
});

test('state rollback needs an authorization record and preserves previous evidence', t => {
  const f = fixture(t);
  const previous = { ...clone(f.task), status: 'self_checked', snapshot: { digest: 'old' }, evidence: { self: { result: 'pass' } } };
  assert.throws(() => checkTransitions(f.project, [f.task], [previous], f.policy), /rollback/);
  f.put('docs/tasks/rework.txt', 'recorded rework authorization');
  f.task.transition = { from: previous.status, to: f.task.status, reason: 'review requested correction', authorizedBy: pm, record: 'docs/tasks/rework.txt', digest: fileDigest(readFileSync(join(f.project, 'docs/tasks/rework.txt'))) };
  assert.throws(() => checkTransitions(f.project, [f.task], [previous], f.policy), /preserve previous/);
  f.task.history = [{ status: previous.status, snapshot: previous.snapshot, evidence: previous.evidence }];
  assert.doesNotThrow(() => checkTransitions(f.project, [f.task], [previous], f.policy));
  assert.throws(() => checkTransitions(f.project, [], [previous], f.policy), /record deleted/);
});

test('business dispatch requires matching references for every affected component and snapshots them', t => {
  const f = fixture(t);
  f.put('docs/requirements/README.md', '# requirements');
  f.put('docs/requirements/specification.md', '# approved specification');
  f.put('docs/tasks/approval.txt', 'fixture approval');
  f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'specification']);
  const revision = f.git(['rev-parse', 'HEAD']).trim();
  f.task.kind = 'business';
  f.task.specification = { approved: true, commit: revision, approvalRecord: 'docs/tasks/approval.txt' };
  f.policy.roles.pm.writeScopes.push('happyAnyway-api/', 'happyAnyway-wechat/');
  f.task.writeScopes = ['happyAnyway-api/src/'];
  f.task.artifactScopes = ['happyAnyway-api/src/'];
  f.put('happyAnyway-api/src/a.txt', 'backend');
  const reference = { schemaVersion: 1, repository: 'happyAnyway', repositoryPath: '..', documentsPath: 'docs/requirements', features: [], status: 'bootstrap-unpinned', revision: null };
  const putReference = (component, changes) => f.put(`${component}/specs-reference.json`, JSON.stringify({ ...reference, ...changes }));
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) putReference(component, {});
  const dispatch = () => f.check(f.task, { dispatch: f.task.id });
  assert.throws(dispatch, /must be pinned/);
  putReference('happyAnyway-api', { status: 'pinned', revision: f.task.baseCommit });
  assert.throws(dispatch, /must be pinned/);
  putReference('happyAnyway-api', { status: 'pinned', revision });
  assert.doesNotThrow(dispatch); // Unaffected WeChat reference may remain bootstrap.
  const before = snapshot(f.project, f.task);
  assert.ok(before.files['happyAnyway-api/specs-reference.json']);
  putReference('happyAnyway-api', { status: 'pinned', revision, features: ['changed'] });
  assert.notEqual(snapshot(f.project, f.task).digest, before.digest);
  f.task.artifactScopes.push('happyAnyway-wechat/');
  assert.throws(dispatch, /happyAnyway-wechat.*must be pinned/);
  putReference('happyAnyway-wechat', { status: 'pinned', revision });
  assert.doesNotThrow(dispatch);
  putReference('happyAnyway-wechat', { status: 'pinned', revision, repositoryPath: '../elsewhere' });
  assert.throws(dispatch, /Invalid root repository/);
  putReference('happyAnyway-wechat', { status: 'pinned', revision });
  // A later task may advance live references; historical acceptance must still
  // validate the references and source captured by its delivery commit.
  const reviewer = '22222222-2222-2222-2222-222222222222';
  const tester = '33333333-3333-3333-3333-333333333333';
  f.policy.roles.reviewer = { ...clone(f.policy.roles.pm), agentId: reviewer };
  f.policy.roles.tester = { ...clone(f.policy.roles.pm), agentId: tester };
  f.task.status = 'tested'; f.task.snapshot = snapshot(f.project, f.task);
  f.evidence(f.task, 'self', pm); f.evidence(f.task, 'review', reviewer); f.evidence(f.task, 'test', tester);
  f.put('docs/agents/automation-policy.json', JSON.stringify(f.policy));
  f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'business delivery']);
  f.task.status = 'accepted'; f.task.deliveryCommit = f.git(['rev-parse', 'HEAD']).trim();
  f.put('docs/tasks/acceptance.txt', 'fixture acceptance');
  f.task.userAcceptance = { record: 'docs/tasks/acceptance.txt', digest: fileDigest(readFileSync(join(f.project, 'docs/tasks/acceptance.txt'))) };
  putReference('happyAnyway-api', {});
  assert.doesNotThrow(() => f.check());
});

test('accepted evidence is immutable; append-only notes and authorized rollback retain original reports', t => {
  const f = fixture(t);
  const reviewer = '22222222-2222-2222-2222-222222222222';
  const tester = '33333333-3333-3333-3333-333333333333';
  f.policy.roles.reviewer = { ...clone(f.policy.roles.pm), agentId: reviewer };
  f.policy.roles.tester = { ...clone(f.policy.roles.pm), agentId: tester };
  f.task.status = 'tested'; f.task.snapshot = snapshot(f.project, f.task);
  f.evidence(f.task, 'self', pm); f.evidence(f.task, 'review', reviewer); f.evidence(f.task, 'test', tester);
  f.put('docs/agents/automation-policy.json', JSON.stringify(f.policy));
  f.git(['add', '.']);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'delivery']);
  f.task.status = 'accepted'; f.task.deliveryCommit = f.git(['rev-parse', 'HEAD']).trim();
  f.put('docs/tasks/acceptance.txt', 'fixture acceptance');
  f.task.userAcceptance = { record: 'docs/tasks/acceptance.txt', digest: fileDigest(readFileSync(join(f.project, 'docs/tasks/acceptance.txt'))) };
  f.check();
  const old = clone(f.task);
  const transition = value => checkTransitions(f.project, [value], [old], f.policy);
  assert.doesNotThrow(() => transition({ ...clone(old), notes: ['follow-up task'] }));
  for (const key of ['deliveryCommit', 'snapshot', 'userAcceptance', 'specification', 'artifactScopes']) {
    const value = clone(old); value[key] = 'replacement';
    assert.throws(() => transition(value), /immutable|cannot be overwritten/);
  }
  const rewritten = clone(old);
  f.put('docs/tasks/test.txt', 'rewritten report');
  rewritten.evidence.test.reportDigest = fileDigest(readFileSync(join(f.project, 'docs/tasks/test.txt')));
  assert.throws(() => transition(rewritten), /historical report missing or changed/);
  f.put('docs/tasks/test.txt', 'test passed\n');
  rewritten.evidence.test = { ...old.evidence.test, command: 'replaced command' };
  assert.throws(() => transition(rewritten), /recorded test evidence/);
  f.put('docs/tasks/rework.txt', 'authorized rework');
  const rework = { ...clone(old), status: 'in_progress', snapshot: undefined, evidence: {}, history: [clone(old)],
    transition: { from: 'accepted', to: 'in_progress', reason: 'new defect', authorizedBy: pm,
      record: 'docs/tasks/rework.txt', digest: fileDigest(readFileSync(join(f.project, 'docs/tasks/rework.txt'))) } };
  assert.doesNotThrow(() => transition(rework));
  const lostHistory = { ...clone(rework), history: [] };
  assert.throws(() => checkTransitions(f.project, [lostHistory], [rework], f.policy), /append-only prefix/);
  f.put('docs/tasks/test.txt', 'overwritten after rollback');
  assert.throws(() => checkTransitions(f.project, [rework], [rework], f.policy), /historical report missing or changed/);
});

test('forward progress adds new evidence without rewriting completed stages', t => {
  const f = fixture(t);
  f.task.status = 'self_checked'; f.task.snapshot = snapshot(f.project, f.task); f.evidence(f.task, 'self', pm);
  const old = clone(f.task);
  f.task.status = 'reviewed'; f.evidence(f.task, 'review', '22222222-2222-2222-2222-222222222222');
  assert.doesNotThrow(() => checkTransitions(f.project, [f.task], [old], f.policy));
  f.task.evidence.self.command = 'replaced command';
  assert.throws(() => checkTransitions(f.project, [f.task], [old], f.policy), /recorded self evidence/);
});

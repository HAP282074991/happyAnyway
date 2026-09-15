import { readFileSync, readdirSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { configDigest } from './config-digest.mjs';
import { effectivePolicy, checkLifecycle } from './project-lifecycle.mjs';
import { checkReference } from './check-docs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const states = ['draft', 'ready', 'in_progress', 'self_checked', 'reviewed', 'tested', 'accepted', 'cancelled'];
const idPattern = /^TASK-\d{8}-\d{3,}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = value => typeof value === 'string' && value.trim() && !/待填写|待确定|TODO|YYYYMMDD|<[^>]+>/.test(value);
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
export function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !/[\\:*?\x00-\x1f]/.test(path)
    && !path.startsWith('/') && !path.split('/').some(p => ['.', '..', '.git', '.codex', '.agents'].includes(p))
    && !path.replace(/\/$/, '').split('/').some(p => !p || /[. ]$/.test(p));
}
export function covers(scope, path) { return scope.endsWith('/') ? path.startsWith(scope) : path === scope; }
function affectedComponents(task) {
  return ['happyAnyway-api', 'happyAnyway-wechat'].filter(component =>
    [...(task.writeScopes ?? []), ...(task.artifactScopes ?? [])].some(scope =>
      covers(component + '/', scope) || covers(scope, component + '/')));
}
function inside(project, path) {
  assert(safePath(path), `Unsafe path: ${path}`);
  const absolute = resolve(project, path);
  if (existsSync(absolute)) {
    const actual = relative(realpathSync(project), realpathSync(absolute));
    assert(actual !== '..' && !actual.startsWith('..' + sep), `Path escapes repository: ${path}`);
    assert(!lstatSync(absolute).isSymbolicLink(), `Symlink not allowed: ${path}`);
  }
  return absolute;
}
export function fileDigest(bytes) {
  // Text uses the same checkout-independent normalization as role configurations.
  // Binary data retains exact bytes (including NUL-containing UTF-8).
  if (!bytes.includes(0)) {
    try { return configDigest(bytes); } catch { /* binary */ }
  }
  return createHash('sha256').update(bytes).digest('hex');
}
function git(project, args) { return execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
export function inventory(project) {
  return [...new Set(git(project, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
}
export function snapshot(project, task, revision) {
  const files = {};
  const artifactScopes = [...task.artifactScopes, ...(task.kind === 'business'
    ? affectedComponents(task).map(component => `${component}/specs-reference.json`) : [])];
  if (revision) {
    assert(commitPattern.test(revision), 'Delivery revision must be a full commit SHA');
    git(project, ['cat-file', '-e', `${revision}^{commit}`]);
  }
  const paths = revision ? git(project, ['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean).sort() : inventory(project);
  for (const path of paths) {
    if (!artifactScopes.some(scope => covers(scope, path))) continue;
    if (revision) {
      assert(safePath(path), `Unsafe artifact path: ${path}`);
      const entry = git(project, ['ls-tree', revision, '--', path]);
      assert(/^100(?:644|755) blob /.test(entry), `Not a regular committed artifact: ${path}`);
      files[path] = fileDigest(execFileSync('git', ['show', `${revision}:${path}`], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] }));
      continue;
    }
    const absolute = inside(project, path);
    if (existsSync(absolute)) {
      assert(lstatSync(absolute).isFile(), `Not a regular artifact: ${path}`);
      files[path] = fileDigest(readFileSync(absolute));
    }
  }
  assert(Object.keys(files).length > 0, `${task.id}: empty artifact snapshot`);
  const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { algorithm: 'sha256-file-map-v1', digest, files };
}
export function changedFiles(project, base) {
  assert(commitPattern.test(base), 'Change base must be a full commit SHA');
  git(project, ['cat-file', '-e', `${base}^{commit}`]);
  // --no-renames includes both deleted source and new destination; includes staged
  // and unstaged changes relative to base, with NUL delimiters for unusual names.
  return [...new Set((git(project, ['diff', '--no-renames', '--name-only', '-z', base, '--'])
    + git(project, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean))];
}
export function loadTasks(project) {
  const directory = resolve(project, 'docs/tasks/automation');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(name => name.endsWith('.json')).map(name => {
    const task = json(resolve(directory, name));
    assert(name === task.id + '.json', `Task filename/id mismatch: ${name}`);
    return task;
  });
}
function checkConfig(project, expected, label, revision) {
  assert(expected && text(expected.path) && text(expected.version) && shaPattern.test(expected.digest), `${label}: invalid configuration receipt`);
  inside(project, expected.path);
  const bytes = revision ? execFileSync('git', ['show', `${revision}:${expected.path}`], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] }) : readFileSync(inside(project, expected.path));
  assert(configDigest(bytes) === expected.digest && bytes.toString('utf8').includes(expected.version), `${label}: configuration changed or version mismatched`);
}
export function validate(project, policy, tasks, { dispatch, delivery, changes } = {}) {
  assert(policy.schemaVersion === 1 && policy.roles && Array.isArray(policy.legacyTasks), 'Invalid automation policy');
  const ids = new Set();
  for (const task of tasks) {
    assert(task.schemaVersion === 1 && idPattern.test(task.id), 'Invalid task schema/id');
    assert(!ids.has(task.id), `Duplicate task id: ${task.id}`); ids.add(task.id);
    assert(states.includes(task.status), `${task.id}: invalid status`);
    assert(existsSync(inside(project, `docs/tasks/${task.id}.md`)), `${task.id}: missing human-readable record`);
  }
  const byId = new Map(tasks.map(task => [task.id, task]));
  for (const name of readdirSync(resolve(project, 'docs/tasks')).filter(name => /^(TASK-|HARNESS-).*\.md$/.test(name))) {
    assert(ids.has(name.slice(0, -3)) || policy.legacyTasks.includes(name.slice(0, -3)), `Missing machine-readable task: ${name}`);
  }
  for (const id of [dispatch, delivery].filter(Boolean)) assert(byId.has(id), `Unknown task: ${id}`);
  if (dispatch) assert(!['accepted', 'cancelled'].includes(byId.get(dispatch).status), 'Closed task cannot be dispatched without a recorded new task');
  if (delivery) assert(byId.get(delivery).status !== 'cancelled', 'Cancelled task cannot be delivered');
  const active = tasks.filter(task => !['draft', 'cancelled'].includes(task.status) || task.id === dispatch || task.id === delivery);
  const busy = new Set();
  for (const task of active) {
    const fail = message => `${task.id}: ${message}`;
    let taskPolicy = policy;
    const revision = task.status === 'accepted' ? task.deliveryCommit : undefined;
    if (task.status === 'accepted') {
      assert(commitPattern.test(revision), fail('accepted tasks require an immutable deliveryCommit'));
      const committedRules = JSON.parse(git(project, ['show', `${revision}:docs/agents/automation-policy.json`]).replace(/^\uFEFF/, ''));
      if (committedRules.schemaVersion === 2) {
        const runtime = JSON.parse(git(project, ['show', `${revision}:docs/tasks/runtime.json`]).replace(/^\uFEFF/, ''));
        taskPolicy = { roles: Object.fromEntries(Object.entries(committedRules.roles).map(([name, rule]) => [name, { ...runtime.roles[name], writeScopes: rule.writeScopes }])), exceptions: runtime.exceptions };
      } else taskPolicy = committedRules;
    }
    for (const key of ['title', 'createdAt', 'workDirectory', 'instructions', 'acceptance', 'verification', 'estimate', 'feedback', 'source', 'outOfScope']) {
      assert(text(task[key]), fail(`missing or placeholder field ${key}`));
    }
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(task.createdAt) && Number.isFinite(Date.parse(task.createdAt)), fail('invalid timestamp'));
    assert(/^(?:[A-Za-z]:\/|\/)/.test(task.workDirectory), fail('workDirectory must be absolute'));
    assert(commitPattern.test(task.baseCommit), fail('invalid base commit'));
    git(project, ['cat-file', '-e', `${task.baseCommit}^{commit}`]);
    assert(task.dispatchSequence && /^D\d{3,}$/.test(task.dispatchSequence), fail('invalid dispatch sequence'));
    assert(task.instructions.includes(task.id) && task.instructions.includes(task.dispatchSequence)
      && task.instructions.includes(`docs/tasks/${task.id}.md`), fail('instructions must reference task, dispatch sequence and record'));
    const role = taskPolicy.roles[task.role];
    assert(role?.enabled && uuidPattern.test(role.agentId) && task.agentId === role.agentId, fail('recipient not confirmed or identity mismatch'));
    assert(task.senderId === taskPolicy.roles.pm.agentId && taskPolicy.roles.pm.enabled, fail('sender identity mismatch'));
    for (const key of ['config', 'workflow']) {
      checkConfig(project, role[key], fail(key), revision);
      assert(['path', 'version', 'digest'].every(field => task[key]?.[field] === role[key][field]), fail(`unacknowledged ${key} version`));
    }
    assert(Array.isArray(task.writeScopes) && task.writeScopes.every(safePath), fail('invalid write scopes'));
    const exceptions = taskPolicy.exceptions?.[task.id];
    if (exceptions) assert(exceptions.agentId === task.agentId && text(exceptions.authorization), fail('invalid exception authorization'));
    const allowed = [...role.writeScopes, ...(exceptions?.writeScopes ?? [])];
    for (const scope of task.writeScopes) assert(allowed.some(parent => covers(parent, scope)), fail(`unauthorized scope ${scope}`));
    assert(Array.isArray(task.artifactScopes) && task.artifactScopes.length > 0, fail('missing artifact scopes'));
    for (const scope of task.artifactScopes) {
      // A delivery also depends on shared read-only files (e.g. existing checkers).
      // Snapshotting these does not grant permission to modify them.
      assert(safePath(scope) && !scope.startsWith('docs/tasks/'), fail(`invalid artifact scope ${scope}`));
    }
    for (const scope of task.writeScopes) {
      if (scope.startsWith('docs/tasks/') || ['docs/progress.md', 'docs/agent-init.md'].includes(scope)) continue;
      assert(task.artifactScopes.some(parent => covers(parent, scope)), fail(`write scope omitted from delivery artifacts: ${scope}`));
    }
    assert(Array.isArray(task.dependencies), fail('missing dependencies'));
    for (const dep of task.dependencies) {
      const prerequisite = byId.get(dep.id);
      assert(prerequisite && dep.id !== task.id && ['self_checked', 'reviewed', 'tested', 'accepted'].includes(dep.requiredStatus), fail('invalid dependency'));
      assert(prerequisite.status !== 'cancelled' && states.indexOf(prerequisite.status) >= states.indexOf(dep.requiredStatus), fail(`dependency not ready: ${dep.id}`));
    }
    assert(task.kind === 'infrastructure' || task.kind === 'business', fail('invalid kind'));
    if (task.kind === 'business') {
      assert(task.specification?.approved === true && commitPattern.test(task.specification.commit) && text(task.specification.approvalRecord), fail('business specification not approved/pinned'));
      assert(existsSync(inside(project, task.specification.approvalRecord)), fail('missing business approval record'));
      git(project, ['cat-file', '-e', `${task.specification.commit}:docs/requirements/specification.md`]);
      for (const component of affectedComponents(task)) {
        const path = `${component}/specs-reference.json`;
        const absolute = inside(project, path);
        const reference = revision
          ? JSON.parse(git(project, ['show', `${revision}:${path}`]).replace(/^\uFEFF/, '')) : json(absolute);
        checkReference(reference, absolute, resolve(project));
        assert(reference.status === 'pinned' && reference.revision === task.specification.commit,
          fail(`${component}: specification reference must be pinned to the task specification commit`));
      }
    }
    if (['ready', 'in_progress'].includes(task.status) || task.id === dispatch) {
      assert(!busy.has(task.agentId), fail('recipient has concurrent active tasks')); busy.add(task.agentId);
    }
    const evidenceStages = states.indexOf(task.status) >= 3 && task.status !== 'cancelled'
      ? ['self', ...(states.indexOf(task.status) >= 4 ? ['review'] : []), ...(states.indexOf(task.status) >= 5 ? ['test'] : [])] : [];
    if (task.id === delivery) {
      for (const stage of ['self', 'review', 'test']) if (!evidenceStages.includes(stage)) evidenceStages.push(stage);
    }
    if (evidenceStages.length) {
      const current = snapshot(project, task, revision);
      assert(task.snapshot?.algorithm === current.algorithm && task.snapshot.digest === current.digest
        && Object.keys(task.snapshot.files ?? {}).length === Object.keys(current.files).length
        && Object.entries(current.files).every(([path, digest]) => task.snapshot.files[path] === digest), fail('delivery snapshot is missing or stale'));
      const actors = new Set([task.agentId]);
      for (const stage of evidenceStages) {
        const evidence = task.evidence?.[stage];
        assert(evidence?.result === 'pass' && evidence.digest === current.digest, fail(`${stage} evidence missing, failed or stale`));
        for (const key of ['command', 'environment', 'recordedAt']) assert(text(evidence[key]), fail(`${stage} missing ${key}`));
        assert(Number.isFinite(Date.parse(evidence.recordedAt)), fail(`${stage} invalid evidence time`));
        const report = inside(project, evidence.report);
        assert(existsSync(report) && fileDigest(readFileSync(report)) === evidence.reportDigest, fail(`${stage} report missing or changed`));
        if (stage === 'self') assert(evidence.agentId === task.agentId, fail('self-check identity mismatch'));
        else {
          const verifier = taskPolicy.roles[stage === 'review' ? 'reviewer' : 'tester'];
          assert(verifier?.enabled && verifier.agentId === evidence.agentId && !actors.has(evidence.agentId), fail(`${stage} must be a confirmed independent role`));
          checkConfig(project, verifier.config, fail(stage), revision);
          checkConfig(project, verifier.workflow, fail(stage), revision);
          actors.add(evidence.agentId);
        }
      }
      if (task.status === 'accepted') {
        assert(text(task.userAcceptance?.record), fail('missing user acceptance record'));
        const report = inside(project, task.userAcceptance.record);
        assert(existsSync(report) && fileDigest(readFileSync(report)) === task.userAcceptance.digest, fail('user acceptance record changed'));
      }
    }
  }
  const visit = (id, visiting = new Set(), visited = new Set()) => {
    assert(!visiting.has(id), `Circular dependency: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id)?.dependencies ?? []) if (byId.has(dep.id)) visit(dep.id, visiting, visited);
    visiting.delete(id); visited.add(id);
  };
  for (const task of tasks) visit(task.id);
  if (changes) {
    for (const path of changes) {
      inside(project, path);
      assert(active.some(task => task.status !== 'accepted' && task.writeScopes.some(scope => covers(scope, path))), `Changed path has no authorized active task: ${path}`);
    }
  }
  return { tasks: tasks.length, active: active.length, legacyTasks: policy.legacyTasks.length, changedPaths: changes?.length ?? null };
}
export function ciBase(project, eventName, event) {
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha
    : eventName === 'merge_group' ? event.merge_group?.base_sha
      : eventName === 'push' ? event.before : null;
  if (base && !/^0+$/.test(base)) { assert(commitPattern.test(base), 'Invalid CI base'); return base; }
  // New branches/manual runs have no previous push. There is no permanent
  // architecture migration exemption; local uncommitted changes still count.
  return git(project, ['rev-parse', 'HEAD']).trim();
}
export function checkTransitions(project, tasks, previous, policy) {
  const current = new Map(tasks.map(task => [task.id, task]));
  for (const old of previous) {
    const task = current.get(old.id);
    assert(task, `Task record deleted: ${old.id}; cancel with history instead`);
    const oldHistory = old.history ?? [];
    assert(oldHistory.every((entry, index) => isDeepStrictEqual(entry, task.history?.[index])),
      `${task.id}: existing history must be preserved as an append-only prefix`);
    // Check original report bytes even during an authorized rollback. Updating
    // a digest in the current task must not legitimize overwriting old evidence.
    for (const entry of [old, ...oldHistory]) {
      const reports = Object.values(entry.evidence ?? {}).filter(evidence => evidence?.report)
        .map(evidence => [evidence.report, evidence.reportDigest]);
      if (entry.userAcceptance?.record) reports.push([entry.userAcceptance.record, entry.userAcceptance.digest]);
      for (const [path, digest] of reports) {
        const report = inside(project, path);
        assert(existsSync(report) && fileDigest(readFileSync(report)) === digest,
          `${task.id}: historical report missing or changed: ${path}`);
      }
    }
    if ((states.indexOf(task.status) >= states.indexOf(old.status) && task.status !== 'cancelled') || task.status === old.status) {
      if (old.snapshot) assert(isDeepStrictEqual(task.snapshot, old.snapshot), `${task.id}: recorded snapshot cannot be overwritten without rollback`);
      for (const [stage, evidence] of Object.entries(old.evidence ?? {})) {
        assert(isDeepStrictEqual(task.evidence?.[stage], evidence), `${task.id}: recorded ${stage} evidence cannot be overwritten without rollback`);
      }
      if (old.status === 'accepted') {
        for (const key of ['deliveryCommit', 'userAcceptance', 'specification', 'artifactScopes', 'agentId', 'role', 'config', 'workflow']) {
          assert(isDeepStrictEqual(task[key], old[key]), `${task.id}: accepted field ${key} is immutable; use a recorded rollback or a new task`);
        }
      }
      continue;
    }
    const transition = task.transition;
    assert(transition?.from === old.status && transition.to === task.status && text(transition.reason)
      && transition.authorizedBy === policy.roles.pm.agentId, `${task.id}: state rollback/cancellation requires a recorded authorization`);
    const record = inside(project, transition.record);
    assert(existsSync(record) && fileDigest(readFileSync(record)) === transition.digest, `${task.id}: transition record missing or changed`);
    assert(task.history?.slice(oldHistory.length).some(item => ['status', 'snapshot', 'evidence', 'deliveryCommit', 'userAcceptance', 'specification']
      .every(key => isDeepStrictEqual(item[key], old[key]))), `${task.id}: preserve previous state and evidence before rollback`);
  }
}
function previousTasks(project, base) {
  return git(project, ['ls-tree', '-r', '--name-only', base, '--', 'docs/tasks/automation/']).split('\n').filter(path => path.endsWith('.json'))
    .map(path => JSON.parse(git(project, ['show', `${base}:${path}`]).replace(/^\uFEFF/, '')));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--ci') options.ci = true;
      else if (['--dispatch', '--delivery', '--snapshot', '--base'].includes(args[i])) {
        assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${args[i]}`);
        options[args[i].slice(2)] = args[++i];
      } else throw new Error(`Unknown option: ${args[i]}`);
    }
    const tasks = loadTasks(root);
    const phase = checkLifecycle(root, tasks);
    const base = options.base ?? (options.ci ? ciBase(root, process.env.GITHUB_EVENT_NAME, json(process.env.GITHUB_EVENT_PATH)) : (() => { try { return git(root, ['rev-parse', 'HEAD']).trim(); } catch { return null; } })());
    let previousPhase;
    if (base && commitPattern.test(base)) {
      try { previousPhase = JSON.parse(git(root, ['show', `${base}:docs/project-state.json`])).phase; } catch { /* first lifecycle adoption */ }
    }
    assert(previousPhase !== 'development' || phase === 'development', 'Cannot bypass development gates by changing lifecycle phase');
    if (phase !== 'development') {
      assert(!options.dispatch && !options.delivery && !options.snapshot, 'Task dispatch/delivery is a development-stage gate; architecture work uses recorded user authorization');
      console.log(JSON.stringify({ result: 'pass', phase, taskGate: 'not-applicable', reason: phase === 'architecture' ? 'Architecture checks run without business tasks or runtime identities; preparation records remain until acceptance.' : 'Clean baseline: zero tasks and zero runtime identities.' }));
      process.exit(0);
    }
    const policy = effectivePolicy(root);
    if (options.snapshot) {
      const task = tasks.find(t => t.id === options.snapshot);
      assert(task, 'Unknown snapshot task');
      console.log(JSON.stringify(snapshot(root, task), null, 2));
    } else {
      assert(base && commitPattern.test(base), 'Development requires a committed baseline');
      checkTransitions(root, tasks, previousTasks(root, base), policy);
      const result = validate(root, policy, tasks, { ...options, changes: changedFiles(root, base) });
      const sources = tasks.filter(task => ['self_checked', 'reviewed', 'tested', 'accepted'].includes(task.status)).map(task => ({
        taskId: task.id, snapshot: snapshot(root, task, task.status === 'accepted' ? task.deliveryCommit : undefined)
      }));
      console.log(JSON.stringify({ result: 'pass', base, ...result, sources }));
      console.log('PASS: recorded task fields, permissions, configuration receipts and applicable evidence. Records are not proof of human approval or OS isolation.');
    }
  } catch (error) {
    console.error('FAIL: ' + error.message); process.exitCode = 1;
  }
}

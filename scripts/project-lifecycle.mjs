import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configDigest } from './config-digest.mjs';

export const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
export function phaseOf(project) {
  const state = readJson(join(project, 'docs/project-state.json'));
  requireThat(state.schemaVersion === 1 && ['architecture', 'ready', 'development'].includes(state.phase), 'Invalid project lifecycle phase');
  return state.phase;
}
export function runtimeOf(project) {
  const path = join(project, 'docs/tasks/runtime.json');
  const runtime = existsSync(path) ? readJson(path) : { schemaVersion: 1, roles: {}, exceptions: {} };
  requireThat(runtime.schemaVersion === 1 && runtime.roles && runtime.exceptions, 'Invalid runtime registration');
  return runtime;
}
export function effectivePolicy(project) {
  const rules = readJson(join(project, 'docs/agents/automation-policy.json'));
  requireThat(rules.schemaVersion === 2, 'Expected reusable automation policy v2');
  const runtime = runtimeOf(project);
  const roles = {};
  for (const [role, rule] of Object.entries(rules.roles)) {
    const binding = runtime.roles[role];
    if (binding) {
      requireThat(binding.config?.path === rule.configPath && binding.workflow?.path === rules.workflowPath, `Unexpected role configuration path: ${role}`);
    }
    roles[role] = { ...binding, enabled: binding?.enabled === true, writeScopes: rule.writeScopes };
  }
  // No task IDs or historical content exemptions enter the development policy.
  return { schemaVersion: 1, roles, exceptions: runtime.exceptions, legacyTasks: [] };
}
export function checkLifecycle(project, tasks = []) {
  const phase = phaseOf(project);
  const registry = readJson(join(project, 'docs/agents/versions.json'));
  requireThat(registry.algorithm === 'sha256-utf8-lf-v1', 'Invalid configuration digest algorithm');
  for (const entry of registry.entries) {
    const bytes = readFileSync(join(project, entry.path));
    requireThat(configDigest(bytes) === entry.digest && bytes.toString('utf8').includes(entry.version), `Configuration mismatch: ${entry.path}`);
  }
  if (phase !== 'development') requireThat(!tasks.some(task => task.kind === 'business'), 'Business tasks require the development phase');
  if (phase === 'ready') {
    for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
      const reference = readJson(join(project, component, 'specs-reference.json'));
      requireThat(reference.status === 'bootstrap-unpinned' && reference.revision === null
        && Array.isArray(reference.features) && reference.features.length === 0,
      `Clean baseline contains stale specification reference: ${component}`);
    }
    requireThat(tasks.length === 0, 'Clean baseline must have no tasks');
    const runtime = runtimeOf(project);
    requireThat(Object.keys(runtime.roles).length === 0 && Object.keys(runtime.exceptions).length === 0 && !runtime.architectureHistory, 'Clean baseline must have no runtime identities or exceptions');
    const files = readdirSync(join(project, 'docs/tasks')).filter(name => name !== 'TEMPLATE.md' && name !== 'runtime.json');
    requireThat(files.length === 0, 'Clean baseline contains task history/evidence');
    const manifest = readJson(join(project, 'docs/baseline-manifest.json'));
    requireThat(manifest.schemaVersion === 1, 'Invalid baseline manifest');
    const local = path => {
      requireThat(typeof path === 'string' && path.length > 0 && !/[\\:*?]/.test(path)
        && !path.startsWith('/') && !path.split('/').some(part => ['.', '..', '.git'].includes(part)), 'Unsafe baseline path');
      return resolve(project, path);
    };
    for (const path of [...manifest.exclude, ...manifest.retain, ...manifest.emptyDirectories,
      ...Object.keys(manifest.resetTemplates), ...Object.values(manifest.resetTemplates)]) local(path);
    const allowed = new Set([...manifest.retain, 'docs/tasks/runtime.json']);
    for (const directory of manifest.emptyDirectories) allowed.add(directory.replace(/\/$/, '') + '/.gitkeep');
    const inspect = path => {
      const absolute = local(path);
      if (!existsSync(absolute)) return;
      requireThat(!lstatSync(absolute).isSymbolicLink(), `Clean baseline contains redirected path: ${path}`);
      if (lstatSync(absolute).isDirectory()) {
        for (const name of readdirSync(absolute)) inspect(path.replace(/\/$/, '') + '/' + name);
      } else {
        requireThat(allowed.has(path), `Clean baseline contains excluded residue: ${path}`);
        if (path.endsWith('/.gitkeep')) requireThat(readFileSync(absolute).length === 0, `Nonempty baseline placeholder: ${path}`);
      }
    };
    for (const path of [...manifest.exclude, ...manifest.emptyDirectories]) inspect(path.replace(/\/$/, ''));
    for (const [path, template] of Object.entries(manifest.resetTemplates)) {
      requireThat(configDigest(readFileSync(local(path))) === configDigest(readFileSync(local(template))),
        `Clean baseline reset mismatch: ${path}`);
    }
  }
  return phase;
}

import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readJson, phaseOf } from './project-lifecycle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', '.reports', 'node_modules', 'target', '.git-migration-backup', 'coverage', 'miniprogram_npm']);
const match = (scope, path) => scope.endsWith('/') ? path.startsWith(scope) : scope === path;
function localPath(project, path) {
  if (typeof path !== 'string' || !path || /[\\:*?]/.test(path) || path.startsWith('/') || path.split('/').some(p => ['.', '..', '.git'].includes(p))) throw new Error('Unsafe baseline path: ' + path);
  return resolve(project, path);
}
function files(project, prefix = '') {
  const result = [];
  for (const item of readdirSync(join(project, prefix), { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const path = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error('Baseline does not follow symlinks: ' + path);
    if (item.isDirectory()) result.push(...files(project, path + '/'));
    else if (item.isFile() && item.name !== 'project.private.config.json'
      && !(path.startsWith('happyAnyway-wechat/miniprogram/') && /\.js(?:\.map)?$/.test(path))
      && (!/^(?:\.env(?:\..+)?|.*\.log|Thumbs\.db|\.DS_Store)$/.test(item.name) || item.name === '.env.example')) result.push(path);
  }
  return result.sort();
}
export function baselinePlan(project) {
  const manifest = readJson(join(project, 'docs/baseline-manifest.json'));
  if (manifest.schemaVersion !== 1) throw new Error('Invalid baseline manifest');
  for (const path of [...manifest.exclude, ...manifest.retain, ...Object.keys(manifest.resetTemplates), ...Object.values(manifest.resetTemplates), ...manifest.emptyDirectories]) localPath(project, path);
  let all = files(project);
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (realpathSync(top).toLowerCase() === realpathSync(project).toLowerCase()) {
      const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\0'));
      all = all.filter(path => tracked.has(path));
    }
  } catch { /* A clean exported baseline need not have Git metadata yet. */ }
  const remove = all.filter(path => manifest.exclude.some(scope => match(scope, path)) && !manifest.retain.includes(path));
  return { remove, keep: all.filter(path => !remove.includes(path)), reset: { ...manifest.resetTemplates, 'docs/project-state.json': 'ready', 'docs/tasks/runtime.json': 'empty' }, manifest };
}
export function previewBaseline(project, destination) {
  if (phaseOf(project) === 'development') throw new Error('Do not clean an active development project');
  project = realpathSync(project);
  const target = resolve(destination);
  const within = relative(project, target);
  if (target === project || within === '..' || project.startsWith(target + sep) || /(^|[\\/])\.git([\\/]|$)/.test(target)) throw new Error('Unsafe baseline destination');
  if (existsSync(target)) throw new Error('Preview destination already exists; choose a new directory');
  // Resolve existing ancestors to prevent junction/symlink targets from redirecting writes.
  let ancestor = dirname(target);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (realpathSync(ancestor).toLowerCase() !== ancestor.toLowerCase() || lstatSync(ancestor).isSymbolicLink()) throw new Error('Preview destination uses a redirected ancestor');
  const plan = baselinePlan(project);
  mkdirSync(target, { recursive: true });
  for (const path of plan.keep) {
    const dest = localPath(target, path); mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(localPath(project, path), dest);
  }
  for (const [path, template] of Object.entries(plan.manifest.resetTemplates)) copyFileSync(localPath(project, template), localPath(target, path));
  writeFileSync(join(target, 'docs/project-state.json'), JSON.stringify({ schemaVersion: 1, phase: 'ready' }, null, 2) + '\n');
  mkdirSync(join(target, 'docs/tasks'), { recursive: true });
  writeFileSync(join(target, 'docs/tasks/runtime.json'), JSON.stringify({ schemaVersion: 1, roles: {}, exceptions: {} }, null, 2) + '\n');
  for (const path of plan.manifest.emptyDirectories) {
    mkdirSync(localPath(target, path), { recursive: true });
    writeFileSync(join(localPath(target, path), '.gitkeep'), '');
  }
  return { destination: target, copied: plan.keep.length, removedFromPreview: plan.remove.length, sourceModified: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--plan' && process.argv.length === 3) {
      const plan = baselinePlan(root); console.log(JSON.stringify({ remove: plan.remove, reset: plan.reset, keptFiles: plan.keep.length }, null, 2));
    } else if (process.argv[2] === '--preview' && process.argv.length === 4) console.log(JSON.stringify(previewBaseline(root, process.argv[3]), null, 2));
    else throw new Error('Usage: node scripts/baseline.mjs --plan | --preview NEW_DIRECTORY');
  } catch (error) { console.error('FAIL: ' + error.message); process.exitCode = 1; }
}

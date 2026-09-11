import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['AGENTS.md', 'README.md', 'scripts/verify.ps1', 'happyAnyway-api/AGENTS.md', 'happyAnyway-wechat/AGENTS.md', 'docs/requirements/README.md', 'docs/requirements/analysis.md', 'docs/requirements/specification.md', 'docs/requirements/change-management.md', 'docs/requirements/overview.md', 'docs/requirements/roadmap.md', 'docs/requirements/contracts.md', 'docs/progress.md', 'docs/agent-init.md', 'docs/project-management.md', 'docs/workflow.md'];
for (const path of required) {
  if (!existsSync(join(root, path))) throw new Error('Missing: ' + path);
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', '.git-migration-backup'].includes(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.md')) {
      for (const match of readFileSync(path, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (target && !/^[a-zA-Z]+:/.test(target) && !existsSync(resolve(dirname(path), target))) throw new Error('Broken link: ' + path + ' -> ' + target);
      }
    }
  }
}
walk(root);
for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
  const path = join(root, component, 'specs-reference.json');
  const ref = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const repository = resolve(root, component, ref.repositoryPath);
  if (ref.repository !== 'happyAnyway' || repository !== root) throw new Error('Invalid root repository reference: ' + path);
  if (typeof ref.documentsPath !== 'string' || resolve(repository, ref.documentsPath) !== join(root, 'docs', 'requirements')) throw new Error('Invalid requirements reference: ' + path);
  if (!existsSync(join(repository, ref.documentsPath, 'README.md'))) throw new Error('Missing requirements: ' + path);
  if (!Array.isArray(ref.features)) throw new Error('Invalid features: ' + path);
  if (ref.status === 'bootstrap-unpinned' ? ref.revision !== null : !/^[a-f0-9]{40}$/.test(ref.revision ?? '')) throw new Error('Invalid revision: ' + path);
}
console.log('PASS: project documentation links and specification references; business approval and commit contents are not checked.');

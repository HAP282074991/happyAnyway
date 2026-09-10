import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = (path) => { if (!existsSync(path)) throw new Error('Missing: ' + path); };
for (const file of ['AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'docs/index.md', 'docs/quality.md']) check(join(root, file));
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.md')) {
      for (const match of readFileSync(path, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (target && !/^[a-zA-Z]+:/.test(target) && !target.startsWith('/')) check(resolve(dirname(path), target));
      }
    }
  }
}
walk(root);
const app = JSON.parse(readFileSync(join(root, 'miniprogram/app.json'), 'utf8'));
for (const page of app.pages) for (const ext of ['.ts', '.js', '.json', '.wxml', '.wxss']) check(join(root, 'miniprogram', page + ext));
console.log('PASS: local documentation links and compiled page resources');

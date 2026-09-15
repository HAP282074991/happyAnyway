import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Run the real entrypoints against owned temporary fixtures, never the worktree.
for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
  test(`${component}: shared Markdown semantics and missing-file rejection`, t => {
    const root = mkdtempSync(join(tmpdir(), 'happyAnyway-entrypoints-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const put = (relative, text = '') => {
      const path = join(root, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    };
    for (const relative of ['scripts/check-docs.mjs', `${component}/scripts/check-structure.${component.endsWith('api') ? 'ps1' : 'mjs'}`]) {
      put(relative);
      copyFileSync(join(source, relative), join(root, relative));
    }
    for (const file of ['AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'docs/index.md', 'docs/quality.md', 'docs/HANDOFF.md', 'docs/rules/development.md', 'docs/rules/testing.md', 'docs/rules/review.md', 'docs/rules/api.md', 'docs/rules/database.md']) put(`${component}/${file}`);
    put(`${component}/miniprogram/app.json`, JSON.stringify({ pages: ['pages/index/index'] }));
    for (const ext of ['ts', 'js', 'json', 'wxml', 'wxss']) put(`${component}/miniprogram/pages/index/index.${ext}`);
    const invoke = () => {
      const script = join(root, component, 'scripts', component.endsWith('api') ? 'check-structure.ps1' : 'check-structure.mjs');
      const result = component.endsWith('api')
        ? spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { encoding: 'utf8' })
        : spawnSync(process.execPath, [script], { encoding: 'utf8' });
      assert.ifError(result.error);
      return result;
    };
    put(`${component}/README.md`, '[入口](AGENTS.md "说明")\n[x][ref]\n[ref]: ARCHITECTURE.md\n\n```md\n[x](missing-example.md)\n```\n');
    let result = invoke();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    put(`${component}/README.md`, '[x][ref]\n[ref]: missing-real.md\n');
    result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /Broken link/);
    put(`${component}/README.md`, '[入口](AGENTS.md "说明")');
    // Retain component-specific checks alongside the shared link parser.
    rmSync(join(root, component, component.endsWith('api') ? 'docs/rules/testing.md' : 'miniprogram/pages/index/index.wxml'));
    result = invoke();
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /Missing/);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkMarkdown, checkReference, checkProject } from './check-docs.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'happyAnyway-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['README.md', 'a b.md', 'a(b).md', 'docs/requirements/README.md']) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), '');
  }
  return root;
}

test('valid local destinations, titles, encoding, parentheses and references', t => {
  const root = fixture(t);
  for (const text of [
    '[x](README.md "title")', '[x](README.md \'title\')',
    '[x](<a b.md>)', '[x](a%20b.md#heading)', '[x](a(b).md)',
    '[x](a\\(b\\).md)', '[x][ref]\n[ref]: README.md "title"',
    '[x][]\n[x]: <a b.md>', '[x]\n[x]: README.md',
    '[x](https://example.com)', '[x](#heading)',
  ]) assert.doesNotThrow(() => checkMarkdown(join(root, 'README.md'), text), text);
});

test('missing inline, image and reference destinations fail', t => {
  const root = fixture(t);
  for (const text of ['[x](missing.md)', '![x](missing.png)', '[x][ref]\n[ref]: missing.md', '[x][]\n[x]: missing.md', '[x]\n[x]: missing.md']) {
    assert.throws(() => checkMarkdown(join(root, 'README.md'), text), /Broken link/);
  }
});

test('code samples are ignored', t => {
  const root = fixture(t);
  for (const text of ['```md\n[x](missing.md)\n```', '~~~md\n[x](missing.md)\n~~~', '`[x](missing.md)`', '    [x](missing.md)']) {
    assert.doesNotThrow(() => checkMarkdown(join(root, 'README.md'), text));
  }
  assert.throws(() => checkMarkdown(join(root, 'README.md'), '```\nexample\n```\n[x](missing.md)'), /Broken link/);
});

test('absolute local paths and malformed encoding do not bypass validation', t => {
  const root = fixture(t);
  const missing = join(root, 'missing.md').replaceAll('\\', '/');
  assert.throws(() => checkMarkdown(join(root, 'README.md'), `[x](${missing})`), /Broken link/);
  assert.throws(() => checkMarkdown(join(root, 'README.md'), '[x](bad%ZZ.md)'), /Invalid link encoding/);
});

test('reference schema, status, feature values and revision are validated', t => {
  const root = fixture(t);
  const path = join(root, 'happyAnyway-api', 'specs-reference.json');
  const valid = { schemaVersion: 1, repository: 'happyAnyway', repositoryPath: '..', documentsPath: 'docs/requirements', features: [], status: 'bootstrap-unpinned', revision: null };
  assert.doesNotThrow(() => checkReference(valid, path, root));
  assert.doesNotThrow(() => checkReference({ ...valid, status: 'pinned', revision: 'a'.repeat(40), features: ['FEATURE-001'] }, path, root));
  for (const change of [
    { schemaVersion: 2 }, { status: 'typo', revision: 'a'.repeat(40) },
    { status: undefined, revision: 'a'.repeat(40) }, { features: [null, 123] },
    { features: [''] }, { features: [' x'] }, { features: ['x', 'x'] },
    { status: 'pinned', revision: null }, { revision: 'a'.repeat(40) },
    { repositoryPath: null }, { documentsPath: '..' },
  ]) assert.throws(() => checkReference({ ...valid, ...change }, path, root), /Invalid/);
});

test('task template is required even without incoming Markdown links', t => {
  const root = fixture(t);
  // Fill preceding required files as reported, stopping specifically at the template.
  for (let attempt = 0; attempt < 40; attempt++) {
    let error;
    try { checkProject(root); } catch (caught) { error = caught; }
    assert.ok(error);
    const match = error.message.match(/^Missing required file: (.+)$/);
    assert.ok(match, error.message);
    if (match[1] === 'docs/tasks/TEMPLATE.md') return;
    const file = resolve(root, match[1]);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, '');
  }
  assert.fail('Task template was not required');
});

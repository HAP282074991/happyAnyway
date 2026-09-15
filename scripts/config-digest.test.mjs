import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configDigest, digestAlgorithm } from './config-digest.mjs';

test('UTF-8 LF, CRLF and optional BOM share a configuration digest', () => {
  const text = '# 岗位\n\n职责：按派工执行。\n';
  const expected = configDigest(Buffer.from(text));
  for (const bom of ['', '\uFEFF']) {
    for (const content of [text, text.replaceAll('\n', '\r\n')]) {
      assert.equal(configDigest(Buffer.from(bom + content)), expected);
    }
  }
});

test('content, whitespace and trailing-newline changes remain detectable', () => {
  const text = '权限：只读\n';
  for (const altered of ['权限：读写\n', '权限：只读 \n', '权限：只读', '权限：只读\r']) {
    assert.notEqual(configDigest(Buffer.from(altered)), configDigest(Buffer.from(text)));
  }
  assert.throws(() => configDigest(Buffer.from([0xff])), /encoded data/);
});

test('registered configuration versions and digests match actual source files', () => {
  const root = new URL('../', import.meta.url);
  const registry = JSON.parse(readFileSync(new URL('docs/agents/versions.json', root), 'utf8'));
  assert.equal(registry.algorithm, digestAlgorithm);
  const expected = ['product-designer', 'backend-developer', 'wechat-developer', 'reviewer', 'tester']
    .map(name => `docs/agents/${name}.md`).concat('docs/workflow.md', 'AGENTS.md');
  assert.deepEqual(registry.entries.map(entry => entry.path).sort(), expected.sort());
  for (const entry of registry.entries) {
    const bytes = readFileSync(new URL(entry.path, root));
    assert.equal(configDigest(bytes), entry.digest, entry.path);
    assert.ok(bytes.toString('utf8').includes(entry.version), entry.path + ': version');
    assert.deepEqual(Object.keys(entry).sort(), ['digest', 'path', 'version'], 'Registry must contain reusable rule credentials only');
  }
  assert.deepEqual(Object.keys(registry).sort(), ['algorithm', 'entries']);
});

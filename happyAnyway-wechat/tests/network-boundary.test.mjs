import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint();
for (const expression of ['wx.request({});', 'wx["request"]({});', "wx['request']({});", 'wx?.["request"]({});', 'const request = wx["request"]; request({});']) {
  test(`network boundary rejects ${expression}`, async () => {
    const [result] = await eslint.lintText(expression, { filePath: 'miniprogram/pages/probe.ts' });
    assert.ok(result.messages.some(message => message.ruleId === 'no-restricted-syntax'));
  });
}
test('platform transport and unrelated computed properties remain allowed', async () => {
  for (const [filePath, text] of [
    ['miniprogram/platform/probe.ts', 'wx.request({}); wx["request"]({});'],
    ['miniprogram/pages/probe.ts', 'const request = "getStorage"; wx[request]({});'],
  ]) {
    const [result] = await eslint.lintText(text, { filePath });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  }
});

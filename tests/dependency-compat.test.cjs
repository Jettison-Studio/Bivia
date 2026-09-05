const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const queryString = require('query-string');

test('Expo Router query-string API preserves Unicode, repeated values, and empty parameters', () => {
  const parsed = queryString.parse('name=Bivia&city=New%20York&emoji=%F0%9F%98%80&tag=one&tag=two&empty=&flag');
  assert.deepEqual({ ...parsed }, { name: 'Bivia', city: 'New York', emoji: '😀', tag: ['one', 'two'], empty: '', flag: null });
  assert.equal(queryString.stringify({ category: 'food & drink', page: 2 }), 'category=food%20%26%20drink&page=2');
});

test('array options and malformed URL inputs retain useful data', () => {
  assert.deepEqual({ ...queryString.parse('topic[]=science&topic[]=music', { arrayFormat: 'bracket' }) }, { topic: ['science', 'music'] });
  assert.deepEqual({ ...queryString.parse('bad=%E0%A4%A&valid=hello%20world&literal=100%25') }, { bad: '%E0%A4%A', valid: 'hello world', literal: '100%' });
});

test('large malformed percent sequences finish within a bounded worker lifetime', () => {
  const queryStringPath = require.resolve('query-string');
  const child = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const queryString = require(${JSON.stringify(queryStringPath)});
    const malformed = '%FF'.repeat(100000);
    const result = queryString.parse('bad=' + malformed + '&ok=yes');
    assert.equal(result.bad, malformed);
    assert.equal(result.ok, 'yes');
  `], { timeout: 5000, encoding: 'utf8', maxBuffer: 100000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});

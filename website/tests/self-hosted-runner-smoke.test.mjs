import test from 'node:test';
import assert from 'node:assert/strict';

test('website CI executes Node 22 or newer', () => {
  assert(Number(process.versions.node.split('.')[0]) >= 22);
});

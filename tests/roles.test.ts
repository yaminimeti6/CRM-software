import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRole, roles } from '../src/lib/roles.ts';
test('only the four PDF roles are accepted', () => {
  for (const role of roles) assert.equal(isRole(role), true);
  for (const role of ['owner', 'Admin', null, undefined, {}, '']) assert.equal(isRole(role), false);
});

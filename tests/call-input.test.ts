import { test } from 'node:test'; import assert from 'node:assert/strict'; import { validateCall } from '../src/lib/call-input.ts';
test('call request validation rejects spoofing and enforces retry/version inputs', () => {
    const base = { version: 1, request_id: '00000000-0000-0000-0000-000000000001', status_id: '00000000-0000-0000-0000-000000000002' };
    assert.equal(validateCall(base).data?.notes, '');
    for (const value of [{ ...base, caller_id: 'spoof' }, { ...base, attempted_at: 'yesterday' }, { ...base, organization_id: 'other' }, { ...base, version: 0 }, { ...base, request_id: 'bad' }, { ...base, notes: 'x'.repeat(4001) }]) assert.ok(validateCall(value).error);
});

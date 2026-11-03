import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayChanges } from '../src/lib/history-display.ts';
test('history shows exact Notes before/after and readable status and quiz changes', () => {
    const rows = displayChanges({ notes: { before: 'Old note\nsecond line', after: 'Saved note' }, status_id: { before: 'old-id', after: 'new-id' }, answers: { before: { Age: '20', Weight: '60' }, after: { Age: '21', Weight: '60', Question: 'Yes' } } }, new Map([['old-id', 'New'], ['new-id', 'Retry']]));
    assert.deepEqual(rows, [{ field: 'Notes', before: 'Old note\nsecond line', after: 'Saved note' }, { field: 'Status', before: 'New', after: 'Retry' }, { field: 'Quiz: Age', before: '20', after: '21' }, { field: 'Quiz: Question', before: 'Not set', after: 'Yes' }]);
});
test('missing values and unknown status use safe labels without raw IDs or JSON', () => {
    const rows = displayChanges({ notes: { before: null, after: '' }, status_id: { before: null, after: 'missing-uuid' }, other: { before: { nested: 'value' }, after: null } }, new Map());
    assert.equal(rows[0].before, 'Not set'); assert.equal(rows[0].after, 'Empty');
    assert.equal(rows[1].after, 'Unavailable status'); assert.equal(rows[2].before, 'Value unavailable');
    assert.deepEqual(displayChanges(null, new Map()), []);
});

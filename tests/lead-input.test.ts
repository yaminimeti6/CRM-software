import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateLeadInput} from '../src/lib/lead-input.ts';
test('lead validation preserves phone text and rejects protected fields or malformed answers',()=>{
 const base={name:' Test ',mobile_no:'0012345678',answers:{'Age/WGHT':'30'}};
 assert.equal(validateLeadInput(base).data?.mobile_no,'0012345678');
 assert.equal(validateLeadInput(base).data?.name,'Test');
 for(const input of [{...base,name:''},{...base,mobile_no:123456},{...base,mobile_no:'hello'},{...base,organization_id:'other'},{...base,answers:{Bad:123}},{...base,created_by:'spoof'},{...base,status_id:'spoof'}])assert.ok(validateLeadInput(input).error);
});

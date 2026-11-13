import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitAnswers} from '../src/lib/answer-display.ts';
import {statusHelp} from '../src/lib/status-help.ts';

test('answer display keeps unknown and structured customer answers and separates only known metadata without changing originals',()=>{
 const original=JSON.parse('{"utm_source":"instagram","AdCrevId":"00123","course_price":"0499","utm_preference":"customer question","source":"personal referral","new_question":{"choice":"A","consent":false,"quantity":0},"__proto__":"literal answer"}');
 const before=JSON.stringify(original),v=splitAnswers(original);
 assert.equal(v.details.utm_source,'instagram');assert.equal(v.details.AdCrevId,'00123');assert.equal(v.details.course_price,'0499');
 assert.equal(v.customer.utm_preference,'customer question');assert.equal(v.customer.source,'personal referral');assert.deepEqual(v.customer.new_question,{choice:'A',consent:false,quantity:0});assert.equal(v.customer.__proto__,'literal answer');
 assert.equal(Object.keys(v.customer).length+Object.keys(v.details).length,Object.keys(original).length);assert.equal(JSON.stringify(original),before);
});
test('status help explains operational effects without inventing a CNP expansion or counting status changes as calls',()=>{
 assert.match(statusHelp({label:'CNP',category:'other'}),/has not been defined/);
 assert.match(statusHelp({label:'Retry',category:'other'}),/does not set a next-call date/);
 assert.match(statusHelp({label:'Confirm',category:'confirmed'}),/only when you save a call result/);
 assert.match(statusHelp({label:'Cancel',category:'cancelled'}),/pending follow-up stays pending/);
 assert.match(statusHelp({label:'Custom',category:'other'}),/Team-defined/);
});

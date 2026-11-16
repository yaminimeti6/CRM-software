import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indiaShortTime,indiaTime} from '../src/lib/crm-time.ts';
import {isLocalSource} from '../src/lib/source-display.ts';
test('compact row dates use IST across midnight while full details retain the year',()=>{
 assert.equal(indiaShortTime('2026-12-31T18:35:00Z'),'01/01 00:05');
 assert.match(indiaTime('2026-12-31T18:35:00Z'),/2027/);
});
test('compact source display recognizes local hosts without hiding real website names or paths',()=>{
 for(const s of ['localhost','localhost:3108/Wife/','http://localhost:3000','https://test.localhost/','127.0.0.1:3000','http://[::1]:3000/'])assert(isLocalSource(s),s);
 for(const s of ['dailyhealthfocus.info','https://dailyhealthfocus.info/localhost','My local landing page','localhost.example.com',''])assert(!isLocalSource(s),s);
});

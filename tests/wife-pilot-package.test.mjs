import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';

test('conditional pilot config fails before either destination until a public HTTPS origin is configured',async()=>{
 const code=readFileSync('integrations/codlive/wife-pilot-config.js','utf8');let calls=0;
 for(const base of ['https://CRM-ENDPOINT.invalid','http://crm.example.test','https://localhost','https://crm.example.test/path']){
  const context={URL,window:{createCodLiveCRM:()=>{calls++;throw Error('Must not initialize');}}};
  runInNewContext(code.replace('https://CRM-ENDPOINT.invalid',base),context);
  await assert.rejects(context.window.submitCodLivePilotOrder({},()=>{calls++;}),/Configure the authorized public HTTPS CRM origin/);
 }assert.equal(calls,0);
 let settings;const context={URL,window:{createCodLiveCRM:value=>{settings=value;return()=>Promise.resolve();}}};
 runInNewContext(code.replace('https://CRM-ENDPOINT.invalid','https://crm.example.test'),context);
 await context.window.submitCodLivePilotOrder({},()=>{});
 assert.equal(settings.base,'https://crm.example.test');assert.equal(settings.formId,'codlive_wife_pilot_v1');assert.equal(settings.version,'codlive-v1');
});

test('pilot patch applies to the supplied ZIP and preserves its complete Sheet function',{skip:!existsSync('../CodLive.zip')?'Supplied private reference ZIP not available':false},()=>{
 const original=execFileSync('tar',['-xOf','../CodLive.zip','CodLive/index.html'],{encoding:'utf8',maxBuffer:2000000});
 const dir='.cache/wife-pilot-patch-check';mkdirSync(dir+'/CodLive',{recursive:true});writeFileSync(dir+'/CodLive/index.html',original);
 execFileSync('git',['apply','--check','--directory='+dir,'integrations/codlive/wife-pilot.patch']);
 execFileSync('git',['apply','--directory='+dir,'integrations/codlive/wife-pilot.patch']);
 const changed=readFileSync(dir+'/CodLive/index.html','utf8');
 const sheet=s=>s.slice(s.indexOf('    function submitOrderToSheet(payload)'),s.indexOf('    function validatePhone()')).replaceAll('\r\n','\n');
 assert(sheet(original).length>100);assert.equal(sheet(changed),sheet(original));
 assert(changed.includes('submitCodLivePilotOrder(payload, submitOrderToSheet)'));assert(changed.includes('src="wife-pilot-config.js"'));
});

// Explicit operator verification against the running main CRM and existing backend.
// Retains only this fixed synthetic inquiry/source; removes temporary staff afterward.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {configuration,clients,reportFailure} from './lib/operator.mjs';
import {sendPublicLead} from './send-public-lead.mjs';

const base='http://localhost:3000',origin=base;
const inquiry=JSON.parse(readFileSync('examples/public-lead.synthetic.json','utf8'));
const sourceName='Synthetic /Wife/ HTTP API demo (local)';
const responses={};let db,admin,sourceId,viewerId,browser,stage='configuration',enabledByTest=false;
const baseline={};let tables=[];
async function hashes(table){return(await db.query(`select md5(to_jsonb(x)::text) h,count(*)::int n from public."${table}" x where coalesce(to_jsonb(x)->>'id','')<>$1 and coalesce(to_jsonb(x)->>'source_id','')<>$1 group by 1`,[sourceId??'__none__'])).rows;}
async function post(value,contentType='application/json',requestOrigin=origin){
  const r=await fetch(base+'/api/public/leads?form_id='+inquiry.form_id,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':contentType},body:typeof value==='string'?value:JSON.stringify(value),signal:AbortSignal.timeout(30000)});
  return {status:r.status,body:await r.json()};
}
async function challenge(){const r=await fetch(base+'/api/public/lead-challenge?form_id='+inquiry.form_id,{headers:{Origin:origin},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const c=await r.json();await new Promise(r=>setTimeout(r,1100));return c.challenge;}
try{
  const config=configuration();({db,admin}=clients(config));await db.connect();
  assert.equal((await fetch(base+'/login',{signal:AbortSignal.timeout(10000)})).status,200);
  const existing=(await db.query('select * from public.ingestion_sources where form_id=$1',[inquiry.form_id])).rows[0];
  if(existing){assert.equal(existing.name,sourceName);assert.equal(existing.form_version,inquiry.form_version);assert.equal(existing.enabled,false);assert.deepEqual(existing.allowed_origins,[origin]);sourceId=existing.id;}
  tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename<>'lead_change_signals' order by tablename")).rows.map(r=>r.tablename);
  for(const t of tables)baseline[t]=await hashes(t);
  const authBefore=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
  const owner=(await db.query("select s.user_id,m.organization_id from crm_private.bootstrap_state s join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner);
  stage='synthetic source';
  if(existing){assert.equal(existing.organization_id,owner.organization_id);assert.equal(existing.created_by,owner.user_id);
    const prior=(await db.query('select original_submission from public.lead_ingestion where source_id=$1',[sourceId])).rows;assert.equal(prior.length,1);assert.deepEqual(prior[0].original_submission,inquiry);
    await db.query('update public.ingestion_sources set enabled=true where id=$1',[sourceId]);
  }else{
    await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.user_id]);await db.query('set local role authenticated');
    sourceId=(await db.query('select public.save_ingestion_source(null,0,$1::jsonb) id',[JSON.stringify({name:sourceName,form_id:inquiry.form_id,form_version:inquiry.form_version,allowed_origins:[origin],enabled:true})])).rows[0].id;await db.query('commit');
  }
  enabledByTest=true;
  stage='anonymous HTTP acceptance';
  const preflight=await fetch(base+'/api/public/leads?form_id='+inquiry.form_id,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);responses.preflight={status:preflight.status};
  responses.initial=await sendPublicLead({base,origin,inquiry});assert.equal(responses.initial.status,existing?200:201);assert.equal(responses.initial.body.accepted,true);assert.equal(responses.initial.body.replayed,!!existing);
  mkdirSync('.cache/public-lead-http',{recursive:true});
  if(responses.initial.status===201)writeFileSync('.cache/public-lead-http/first-acceptance.json',JSON.stringify(responses.initial,null,2));
  responses.retry=await sendPublicLead({base,origin,inquiry});assert.equal(responses.retry.status,200);assert.deepEqual(responses.retry.body,{ok:true,accepted:true,replayed:true,submission_id:inquiry.submission_id});
  responses.cli_retry=JSON.parse(execFileSync(process.execPath,['scripts/send-public-lead.mjs','examples/public-lead.synthetic.json',base,origin],{encoding:'utf8',timeout:45000,windowsHide:true}));assert.equal(responses.cli_retry.status,200);assert.equal(responses.cli_retry.body.replayed,true);
  responses.form_encoded_retry=await sendPublicLead({base,origin,inquiry,encoded:true});assert.equal(responses.form_encoded_retry.status,200);assert.equal(responses.form_encoded_retry.body.replayed,true);
  stage='actual error responses';
  const token=await challenge();
  responses.conflict=await post({...inquiry,challenge:token,name:'Synthetic conflicting content'});assert.equal(responses.conflict.status,409);assert.equal(responses.conflict.body.error.code,'IDEMPOTENCY_CONFLICT');
  responses.validation=await post({...inquiry,challenge:token,mobile_no:'invalid'});assert.equal(responses.validation.status,400);assert.equal(responses.validation.body.error.code,'VALIDATION');
  responses.protected=await post({...inquiry,challenge:token,status_id:randomUUID()});assert.equal(responses.protected.status,400);assert.equal(responses.protected.body.error.code,'VALIDATION');
  responses.bot=await post(inquiry);assert.equal(responses.bot.status,400);assert.equal(responses.bot.body.error.code,'BOT_CHECK');
  responses.malformed=await post('{');assert.equal(responses.malformed.status,400);assert.equal(responses.malformed.body.error.code,'INVALID_PAYLOAD');
  responses.oversized=await post(JSON.stringify({...inquiry,padding:'x'.repeat(33000)}));assert.equal(responses.oversized.status,413);
  responses.origin=await post({...inquiry,challenge:token},'application/json','https://not-allowed.example');assert.equal(responses.origin.status,403);assert.equal(responses.origin.body.error.code,'SOURCE_UNAVAILABLE');
  responses.unknown_source=await post({...inquiry,form_id:'synthetic_unregistered_http_demo',challenge:token});assert.equal(responses.unknown_source.status,403);
  stage='stored data';
  const saved=(await db.query('select l.id,l.name,l.mobile_no,l.address,l.created_at,l.status_id,i.original_submission,i.original_answers,i.source_snapshot from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.source_id=$1',[sourceId])).rows;
  assert.equal(saved.length,1);const lead=saved[0];assert.deepEqual(lead.original_submission,inquiry);assert.deepEqual(lead.original_answers.Sir_Demo_Typed_Answer,inquiry.answers.Sir_Demo_Typed_Answer);
  assert.equal(lead.source_snapshot.name,sourceName);assert.equal(lead.source_snapshot.reported_traffic_source,'instagram');
  assert.equal((await db.query("select count(*)::int n from public.source_quiz_fields where source_id=$1 and form_version=$2 and field_key='Sir_Demo_Question_20261105'",[sourceId,inquiry.form_version])).rows[0].n,1);
  stage='authenticated main All Leads';
  viewerId=randomUUID();const email='http-demo-'+viewerId+'@example.test',password='Synthetic-'+randomUUID()+'!Aa1';
  assert.ifError((await admin.auth.admin.createUser({id:viewerId,email,password,email_confirm:true})).error);
  await db.query('insert into public.staff_profiles(id,full_name)values($1,$2)',[viewerId,'Synthetic HTTP verifier']);
  await db.query("insert into public.organization_memberships(user_id,organization_id,role)values($1,$2,'telecaller')",[viewerId,owner.organization_id]);
  browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});
  const page=await browser.newPage({viewport:{width:4000,height:1000}});await page.goto(base+'/login');await page.getByLabel('Username or email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/app');
  const rowUrl=base+'/app?q='+encodeURIComponent(inquiry.name);await page.goto(rowUrl);const row=page.locator('tr[data-lead-id="'+lead.id+'"]');await row.waitFor();
  const text=await row.innerText();for(const expected of [sourceName,'dailyhealthfocus.info','instagram','1 Month','499'])assert(text.includes(expected),expected);
  mkdirSync('.cache/public-lead-http',{recursive:true});await row.screenshot({path:'.cache/public-lead-http/all-leads-row.png'});
  await row.getByRole('button',{name:'Open lead '+inquiry.name,exact:true}).click();const drawer=page.getByRole('dialog',{name:inquiry.name,exact:true});assert((await drawer.innerText()).includes(inquiry.lead_id));assert((await drawer.innerText()).includes(inquiry.submission_id));await drawer.getByRole('tab',{name:'Answers',exact:true}).click();assert((await drawer.innerText()).includes(inquiry.answers.Sir_Demo_Question_20261105));assert((await drawer.innerText()).includes('"quantity":2'));await drawer.getByRole('button',{name:'Close lead details',exact:true}).click();
  await page.getByText('Choose quiz columns',{exact:false}).click();await page.getByLabel(`Sir_Demo_Question_20261105 [${inquiry.form_id} / ${inquiry.form_version}]`,{exact:true}).check();
  assert((await row.innerText()).includes(inquiry.answers.Sir_Demo_Question_20261105));
  await row.screenshot({path:'.cache/public-lead-http/all-leads-details.png'});
  stage='cleanup and preservation';await browser.close();browser=null;assert.ifError((await admin.auth.admin.deleteUser(viewerId)).error);viewerId=null;
  await db.query('update public.ingestion_sources set enabled=false,revision=revision+1 where id=$1',[sourceId]);enabledByTest=false;
  responses.disabled=await post({...inquiry,challenge:token});assert.equal(responses.disabled.status,403);assert.equal(responses.disabled.body.error.code,'SOURCE_UNAVAILABLE');
  for(const t of tables){const after=new Map((await hashes(t)).map(x=>[x.h,x.n]));for(const r of baseline[t])assert((after.get(r.h)??0)>=r.n,'Pre-existing row changed in '+t);}
  const authAfter=new Map((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users")).rows.map(x=>[x.id,x.h]));for(const r of authBefore)assert.equal(authAfter.get(r.id),r.h);
  const evidence={verified_at:new Date().toISOString(),base,row_url:rowUrl,lead_id:lead.id,submission_id:inquiry.submission_id,source_id:sourceId,lead_count:1,unknown_field_registered:true,typed_original_preserved:true,main_ui_verified:true,source_enabled:false,pre_existing_data_passwords_preserved:true,responses};
  writeFileSync('.cache/public-lead-http/evidence.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
}catch(e){await db?.query('rollback').catch(()=>{});console.error('Stage: '+stage);if(e.name==='AssertionError'||e.name==='TimeoutError')console.error(String(e.message).split('\n')[0]);reportFailure(e,'main public lead HTTP verification');}
finally{await browser?.close();if(viewerId&&admin)await admin.auth.admin.deleteUser(viewerId);if(enabledByTest&&sourceId&&db)await db.query('update public.ingestion_sources set enabled=false where id=$1',[sourceId]).catch(()=>{});await db?.end();}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base=process.env.CRM_TEST_BASE_URL??'http://localhost:3000',tag=`CRM_TEST_${randomUUID()}`;
if(!/^http:\/\/localhost:\d+$/.test(base))throw new Error('Live UI tests require a local application server.');
let db,admin,browser,testPage;const orgs=[],users=[],authClients=[];let stage='configuration';
const preservedTables=['organizations','staff_profiles','organization_memberships','leads','lead_edit_history','lead_field_definitions','lead_statuses'];
async function preservationSnapshot(){
 const result={};
 for(const table of preservedTables){
  // Hash inside PostgreSQL: existing customer details never enter tool output.
  result[table]=(await db.query(`select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as digest from public.${table} t`)).rows[0];
 }
 return result;
}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();
 const initial=(await db.query('select count(*)::int as n from auth.users')).rows[0].n;
 const preserved=await preservationSnapshot();
 for(const suffix of ['A','B'])orgs.push((await db.query('insert into public.organizations(name) values($1) returning id',[`${tag}_${suffix}`])).rows[0].id);
 async function fixture(role,org){
  const id=randomUUID(),email=`crm-test-${randomUUID()}@example.com`,password=`Test-${randomUUID()}!Aa1`;
  const created=await admin.auth.admin.createUser({id,email,password,email_confirm:true});assert.ifError(created.error);users.push(id);
  await db.query('insert into public.staff_profiles(id,full_name) values($1,$2)',[id,`${tag}_${role}`]);
  await db.query('insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,$3)',[id,org,role]);
  const client=createClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});authClients.push(client);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);return {id,email,password,client};
 }
 stage='synthetic staff fixtures';
 const tele=await fixture('telecaller',orgs[0]),manager=await fixture('manager',orgs[0]),analyst=await fixture('creative_analyst',orgs[0]),outsider=await fixture('telecaller',orgs[1]);
 // Retain an active synthetic Admin while a second fixture exercises temporary
 // Admin permissions. Step 3 correctly forbids demoting a sole Admin.
 await fixture('admin',orgs[0]);
 const path=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
 browser=await chromium.launch({executablePath:path,headless:true});
 async function login(account){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${base}/login`);await page.getByLabel('Username or email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/app');return {context,page};}
 const {context,page}=await login(tele);
 testPage=page;
 const api=async(method,path,data)=>{
  const cookie=(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
  const response=await fetch(`${base}${path}`,{method,headers:{Origin:base,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
  return {status:()=>response.status,json:()=>response.json()};
 };
 stage='UI add lead and dynamic quiz field';
 await page.getByRole('heading',{name:'All Leads',exact:true}).waitFor();
 await page.locator('summary').filter({hasText:/^Add Lead$/}).click();
 await page.getByLabel('Name',{exact:true}).fill(tag);
 await page.getByLabel('Mobile number',{exact:true}).fill('001234567890');
 await page.getByLabel('Address (optional)',{exact:true}).fill('Synthetic address');
 await page.getByRole('button',{name:'Add question',exact:true}).click();
 const question=`Quiz_${randomUUID().slice(0,8)}`;
 await page.getByLabel('Question 1',{exact:true}).fill(question);await page.getByLabel('Answer 1',{exact:true}).fill('Synthetic answer');
 await page.getByRole('button',{name:'Create lead',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Lead saved to Supabase.'}).waitFor();
 const stored=(await db.query('select * from public.leads where organization_id=$1 and name=$2',[orgs[0],tag])).rows[0];assert.ok(stored);
 assert.equal(stored.created_by,tele.id);assert.equal(stored.mobile_no,'001234567890');assert.equal(stored.answers[question],'Synthetic answer');assert.ok(stored.created_at);
 const statuses=(await db.query('select * from public.lead_statuses where organization_id=$1',[orgs[0]])).rows;
 const initialStatus=statuses.find(s=>s.is_new),retry=statuses.find(s=>s.label==='Retry');assert.equal(stored.status_id,initialStatus.id);
 assert.ok((await tele.client.from('lead_field_definitions').select('*')).data.some(f=>f.field_key===question));
 await page.reload();await page.locator(`[data-lead-id="${stored.id}"]`).waitFor();
 await page.locator('summary').filter({hasText:'Choose quiz columns'}).click();await page.getByRole('checkbox',{name:question,exact:true}).check();
 assert.equal(await page.getByLabel(`${question} for ${tag}`,{exact:true}).inputValue(),'Synthetic answer');
 console.log('PASS: UI-created lead persisted in real Supabase with text mobile, server UUID/time, configured New status, JSONB answer and registered selectable column; page refresh preserves it.');
 stage='inline edit and actual audit history';
 const row=page.locator(`[data-lead-id="${stored.id}"]`);
 await row.getByLabel(`Address for ${tag}`,{exact:true}).fill('Edited synthetic address');
 await row.getByLabel(`Notes for ${tag}`,{exact:true}).fill('Ordinary edit, not a call');
 await row.getByLabel(`Status for ${tag}`,{exact:true}).selectOption(retry.id);
 stage='inline Save row request';
 const saved=page.waitForResponse(r=>r.url().endsWith(`/api/leads/${stored.id}`)&&r.request().method()==='PATCH');
 await row.getByRole('button',{name:'Save row'}).click();assert.equal((await saved).status(),200);
 stage='edited row refresh';
 await page.reload();await page.locator(`[data-lead-id="${stored.id}"]`).waitFor();
 assert.equal(await page.getByLabel(`Address for ${tag}`,{exact:true}).inputValue(),'Edited synthetic address');
 assert.equal(await page.getByLabel(`Status for ${tag}`,{exact:true}).inputValue(),retry.id);
 stage='audit history API assertions';
 const history=await (await api('GET',`/api/leads/${stored.id}/history`)).json();assert.equal(history.total,2);assert.equal(history.history[0].editor_id,tele.id);assert.equal(history.history[0].changes.address.after,'Edited synthetic address');
 const payload={name:tag,mobile_no:'001234567890',address:'Edited synthetic address',notes:'Concurrent winner',answers:{[question]:'Synthetic answer'},status_id:retry.id,version:2};
 stage='concurrent edit HTTP assertions';
 const cookie=(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
 const concurrentPatch=async data=>{
   const response=await fetch(`${base}/api/leads/${stored.id}`,{method:'PATCH',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
   await response.body?.cancel();return {status:()=>response.status};
 };
 const diagnostic=setTimeout(()=>{void db.query(`select state,wait_event_type,wait_event,cardinality(pg_blocking_pids(pid)) as blockers,
   case when query ilike '%update_lead%' then 'lead update' else 'other' end as operation
   from pg_stat_activity where datname=current_database() and state<>'idle'`).then(r=>console.log('Concurrent-test wait categories (no SQL/values):',r.rows)).catch(()=>{});},5000);
 let concurrent;try{concurrent=await Promise.all([concurrentPatch(payload),concurrentPatch({...payload,notes:'Other concurrent editor'})]);}finally{clearTimeout(diagnostic);}
 assert.deepEqual(concurrent.map(r=>r.status()).sort(),[200,409]);
 assert.equal((await db.query('select version from public.leads where id=$1',[stored.id])).rows[0].version,3);
 console.log('PASS: inline fields/notes/status save and refresh, actual editor/time/changed-fields history, simultaneous writes produce one success and one 409 conflict.');
 stage='pagination search status filters and validation';
 for(let i=0;i<5;i++){stage=`pagination fixture ${i+1} creation`;const r=await api('POST','/api/leads',{name:`${tag}_${i}`,mobile_no:`00999999999${i}`,answers:{}});assert.equal(r.status(),201);await r.json();}
 stage='server pagination and literal search';
 assert.equal((await (await api('GET','/api/leads?size=5&page=1')).json()).leads.length,5);
 assert.equal((await (await api('GET','/api/leads?size=5&page=2')).json()).leads.length,1);
 assert.equal((await (await api('GET',`/api/leads?q=${encodeURIComponent(tag+'_3')}`)).json()).total,1);
 assert.equal((await (await api('GET','/api/leads?q=001234567890')).json()).total,1);
 assert.equal((await (await api('GET',`/api/leads?status=${retry.id}`)).json()).total,1);
 stage='backend input/protected-field validation';
 assert.equal((await api('POST','/api/leads',{name:'Bad mobile',mobile_no:'abc'})).status(),400);
 assert.equal((await api('POST','/api/leads',{name:'Spoof',mobile_no:'0012345678',organization_id:orgs[1]})).status(),400);
 assert.equal((await api('PATCH',`/api/leads/${stored.id}`,{...payload,version:3,created_by:manager.id})).status(),400);
 assert.equal((await context.request.post(`${base}/api/leads`,{data:{name:'CSRF',mobile_no:'0012345678'},headers:{Origin:'https://invalid.example'}})).status(),403);
 stage='UI page size selection';
 await page.reload();await page.getByLabel('Rows per page',{exact:true}).selectOption('5');
 stage='UI next-page click';
 await page.getByRole('button',{name:'Next',exact:true}).click();
 stage='UI page 2 result';
 await page.getByText('Page 2 · 6 leads',{exact:true}).waitFor();
 stage='UI mobile search submission';
 await page.getByLabel('Search name or mobile',{exact:true}).fill('001234567890');await page.getByRole('button',{name:'Search',exact:true}).click();
 stage='UI mobile search result';
 await page.getByText('Page 1 · 1 leads',{exact:true}).waitFor();
 stage='UI validation error';
 await page.locator('summary').filter({hasText:/^Add Lead$/}).click();
 await page.getByLabel('Name',{exact:true}).fill('Synthetic invalid lead');await page.getByLabel('Mobile number',{exact:true}).fill('abc');
 await page.getByRole('button',{name:'Create lead',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Enter a mobile number'}).waitFor();
 console.log('PASS: real server-side pagination, UI next/search, name/mobile search, status filters, invalid input/protected fields and cross-origin writes rejected.');
 stage='role restrictions and tenant isolation';
 const mgrReads=await manager.client.from('leads').select('*');assert.ifError(mgrReads.error);assert.equal(mgrReads.data.length,6);
 const mgrEdit=await manager.client.rpc('update_lead',{p_id:stored.id,p_version:3,p_input:{...payload,version:undefined,notes:'Manager edit'}});
 // Remove transport-only version from the RPC payload (undefined is omitted by JSON).
 assert.ifError(mgrEdit.error);
 stage='two independent browser sessions reject a stale Save row';
 await page.reload();
 const staleRow=page.locator(`[data-lead-id="${stored.id}"]`);
 await staleRow.waitFor();
 await staleRow.getByLabel(`Notes for ${tag}`,{exact:true}).fill('Stale session value must not win');
 const secondSession=await login(manager);
 const secondRow=secondSession.page.locator(`[data-lead-id="${stored.id}"]`);
 await secondRow.waitFor();
 await secondRow.getByLabel(`Notes for ${tag}`,{exact:true}).fill('Second session saved value');
 const winningSave=secondSession.page.waitForResponse(r=>r.url().endsWith(`/api/leads/${stored.id}`)&&r.request().method()==='PATCH');
 await secondRow.getByRole('button',{name:'Save row',exact:true}).click();
 assert.equal((await winningSave).status(),200);
 const staleSave=page.waitForResponse(r=>r.url().endsWith(`/api/leads/${stored.id}`)&&r.request().method()==='PATCH');
 await staleRow.getByRole('button',{name:'Save row',exact:true}).click();
 assert.equal((await staleSave).status(),409);
 await staleRow.getByRole('status').filter({hasText:'Someone changed this lead'}).waitFor();
 const surviving=(await db.query('select notes,version,answers from public.leads where id=$1',[stored.id])).rows[0];
 assert.equal(surviving.notes,'Second session saved value');assert.equal(surviving.version,5);assert.equal(surviving.answers[question],'Synthetic answer');
 assert.equal((await db.query('select count(*)::int as n from public.lead_edit_history where lead_id=$1',[stored.id])).rows[0].n,5);
 await secondSession.context.close();
 console.log('PASS: two separate real browser sessions edit one lead; newer save persists, stale Save row shows 409 error and creates no overwrite or extra audit record.');
 stage='Admin role authorization using disposable staff only';
 await db.query("update public.organization_memberships set role='admin' where user_id=$1",[manager.id]);
 const temporaryAdmin=await login(manager);
 assert.equal((await temporaryAdmin.context.request.get(`${base}/api/admin/access`)).status(),200);
 assert.equal((await temporaryAdmin.context.request.get(`${base}/api/leads`)).status(),200);
 await temporaryAdmin.context.close();
 await db.query("update public.organization_memberships set role='manager' where user_id=$1",[manager.id]);
 stage='Creative Analyst and cross-tenant authorization';
 for(const account of [analyst,outsider]){
  const read=await account.client.from('leads').select('*').eq('id',stored.id);assert.ifError(read.error);assert.deepEqual(read.data,[]);
  assert.ok((await account.client.rpc('update_lead',{p_id:stored.id,p_version:4,p_input:{name:tag,mobile_no:'001234567890',answers:{}}})).error);
 }
 assert.ok((await analyst.client.rpc('create_lead',{p_input:{name:'Forbidden',mobile_no:'001234567890'}})).error);
 assert.ok((await tele.client.from('leads').update({organization_id:orgs[1]}).eq('id',stored.id)).error);
 assert.ok((await tele.client.from('lead_edit_history').delete().eq('lead_id',stored.id)).error);
 const analystBrowser=await login(analyst);
 await analystBrowser.page.getByRole('heading',{name:'Customer access restricted'}).waitFor();assert.equal((await analystBrowser.context.request.get(`${base}/api/leads`)).status(),403);
 await analystBrowser.context.close();
 const outsiderBrowser=await login(outsider);
 assert.equal((await outsiderBrowser.context.request.patch(`${base}/api/leads/${stored.id}`,{headers:{Origin:base},data:{...payload,version:4}})).status(),403);
 assert.equal((await (await outsiderBrowser.context.request.get(`${base}/api/leads/${stored.id}/history`)).json()).total,0);await outsiderBrowser.context.close();
 const anon=createClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});assert.ok((await anon.from('leads').select('*')).error);
 await assert.rejects(db.query("update public.lead_statuses set label='Confirm' where id=$1",[retry.id]),/check constraint/);
 console.log('PASS: Manager shared read/edit, Creative Analyst customer denial in UI/API/database, cross-organization read/write/history isolation, direct protected writes/history deletion denied, anonymous database denial, non-confirmation statuses cannot be relabeled to bypass confirmation tracking.');
 stage='authentication regression';
 await page.reload();await page.getByRole('heading',{name:'All Leads',exact:true}).waitFor();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');
 assert.equal((await context.request.get(`${base}/api/leads`)).status(),401);assert.equal((await context.request.get(`${base}/api/me`)).status(),401);
 assert.equal((await context.request.get(`${base}/api/leads/${stored.id}/history`)).status(),401);
 assert.equal((await context.request.post(`${base}/api/leads`,{headers:{Origin:base},data:{name:'Unauthorized',mobile_no:'001234567890'}})).status(),401);
 await page.goto(`${base}/app`);await page.waitForURL('**/login');await context.close();
 console.log('PASS: real staff login, session refresh and logout still protect pages and APIs.');
 await db.query('delete from public.leads where organization_id=any($1::uuid[])',[orgs]);
 await db.query('delete from public.organizations where id=any($1::uuid[])',[orgs]);orgs.length=0;
 for(const client of authClients)await client.auth.signOut({scope:'local'});
 for(const id of users)assert.ifError((await admin.auth.admin.deleteUser(id)).error);users.length=0;
 assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,initial);
 assert.deepEqual(await preservationSnapshot(),preserved);
 console.log('PASS: all synthetic fixtures removed; existing account count unchanged; exact database fingerprints confirm pre-existing organizations/profiles/memberships/leads/history/fields/statuses unchanged.');
}catch(error){console.error(`Live Step 2 verification stopped at: ${stage}. Error type: ${error?.name??'unknown'}.`);if(testPage){const text=await testPage.locator('.pagination').textContent({timeout:1000}).catch(()=>'');console.log('Pagination UI state:',text.match(/Page \d+ · \d+ leads/)?.[0]??'unavailable');console.log('UI error visible:',await testPage.getByRole('alert').count().catch(()=>0)>0);}if(error?.name==='AssertionError'&&typeof error.actual==='number'&&typeof error.expected==='number')console.error(`Expected numeric value ${error.expected}; received ${error.actual}.`);reportFailure(error,stage);}
finally{
 if(db&&orgs.length)await db.query('delete from public.leads where organization_id=any($1::uuid[])',[orgs]).catch(()=>{console.error('Fixture lead cleanup required.');process.exitCode=1;});
 if(db&&orgs.length)await db.query('delete from public.organizations where id=any($1::uuid[])',[orgs]).catch(()=>{console.error('Fixture organization cleanup required.');process.exitCode=1;});
 for(const client of authClients)await client.auth.signOut({scope:'local'}).catch(()=>{});
 for(const id of users){const r=await admin.auth.admin.deleteUser(id).catch(()=>({error:true}));if(r.error){console.error('Fixture user cleanup required.');process.exitCode=1;}}
 if(browser)await browser.close();if(db)await db.end().catch(()=>{});
}

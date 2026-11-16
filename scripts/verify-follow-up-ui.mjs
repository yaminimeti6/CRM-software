import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/follow-up-ui';
let db,admin,auth,browser,stage='configuration';const writes=[],errors=[];
async function snapshot(){
 const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
 return (await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;
}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();
 const before=await snapshot();const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select s.user_id,u.email from crm_private.bootstrap_state s join auth.users u on u.id=s.user_id join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner?.email);
 const lead=(await db.query('select l.id,l.name,l.status_id,i.source_id from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.submission_id=$1',['6875bfac-874e-4784-ab30-41807442951d'])).rows[0];assert(lead,'Existing retained API example is required; do not create a replacement.');
 stage='temporary local session for existing Admin';
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>{cookies.splice(0,cookies.length,...values);}}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:!process.argv.includes('--visible')});
 const context=await browser.newContext({viewport:{width:1600,height:780}});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.dismiss());
 let callRequests=[],callbackRequests=[],patches=[],releaseCall;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['POST','PATCH','DELETE','PUT'].includes(request.method())&&url.origin===base&&url.pathname!=='/api/leads/search'){
   const body=request.postDataJSON();writes.push(url.pathname);
   if(url.pathname.endsWith('/calls')){callRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });



 stage='existing follow-ups and themes';mkdirSync(root,{recursive:true});
 const mask=[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')];
 for(const theme of ['Light','Dark','Mixed']){
  await page.goto(base+'/app/follow-ups');
  await page.getByRole('button',{name:'All pending',exact:false}).first().waitFor();
  await page.waitForFunction(()=>!document.querySelector('.follow-up-refresh')?.textContent.includes('Loading callbacks'));
  await chooseTheme(page,theme);await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('.follow-up-queue').length===4&&!document.querySelector('.follow-up-refresh')?.textContent.includes('Loading callbacks'));
  assert.equal(await page.locator('.crm-shell').getAttribute('data-crm-theme'),theme.toLowerCase());
  assert.equal(await page.locator('.follow-up-queue').count(),4);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'.png',mask});
 }
 stage='real server filters';
 for(const [value,label] of [['due_today','Due Today'],['overdue','Overdue'],['upcoming','Upcoming']]){
  const r=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/follow-ups'&&new URL(r.url()).searchParams.get('view')===value);
  await page.locator('.follow-up-queues').getByRole('button',{name:new RegExp(label)}).click();assert.equal((await r).status(),200);assert.equal(await page.getByLabel('Follow-up filter',{exact:true}).inputValue(),value);
 }
 const myReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/follow-ups'&&new URL(r.url()).searchParams.get('my')==='true');
 await page.getByLabel('My Follow-ups',{exact:true}).check();assert.equal((await myReply).status(),200);
 stage='isolated browser response fixture, never saved';
 const fixture={id:'browser-only-preview',lead_id:lead.id,lead_name:lead.name,mobile_no:'9000000000',due_at:'2026-12-01T05:00:00Z',notes:'Browser UI preview only; not saved.',assigned_to:null,assigned_name:'',assigned_active:true,creator_name:'UI preview',state:'pending',revision:1,lead_status:'New',lead_category:'new'};
 await page.route('**/api/follow-ups?*',route=>route.fulfill({json:{items:[fixture],total:1,counts:{pending:1,due_today:0,overdue:0,upcoming:1}}}));
 await page.goto(base+'/app/follow-ups');
 const row=page.locator('tr[data-follow-up-id="browser-only-preview"]');await row.waitFor();
 assert.deepEqual(await page.locator('.follow-up-table th').allTextContents(),['Lead / Mobile','Next call (IST)','Assigned to','Notes','State','Actions']);
 assert((await row.innerText()).includes('Unassigned'));
 await row.getByRole('button',{name:'Manage follow-up',exact:true}).click();
 const editor=page.getByRole('form',{name:'Callback editor'});await editor.waitFor();
 await editor.getByLabel('Callback date/time (Asia/Kolkata)',{exact:true}).fill('2026-12-02T10:30');
 await editor.getByRole('button',{name:'Save follow-up',exact:true}).click();
 await editor.getByRole('button',{name:'Retry same follow-up',exact:true}).waitFor();assert.equal(callbackRequests.length,1);
 await editor.getByRole('button',{name:'Retry same follow-up',exact:true}).click();
 await page.waitForTimeout(300);assert.equal(callbackRequests.length,2);assert.deepEqual(callbackRequests[0],callbackRequests[1]);
 assert(await editor.getByLabel('Callback date/time (Asia/Kolkata)',{exact:true}).isDisabled());
 stage='mobile table containment';await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:root+'/mobile-diagnostic.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('.crm-content,.follow-up-refresh,.follow-up-queues,.follow-up-toolbar,.follow-up-table-scroll')).map(e=>({class:e.className,width:e.getBoundingClientRect().width,scroll:e.scrollWidth})))));
 await page.screenshot({path:root+'/mobile-browser-fixture.png'});
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);
 writeFileSync(root+'/evidence.json',JSON.stringify({themes:['Light','Dark','Mixed'],real_server_queue_filters:true,my_filter:true,populated_table:'isolated browser response fixture only',editor_retry_identical_intercepted_payload:true,mobile_no_page_overflow:true,all_public_records_and_passwords_unchanged:true,saved_business_writes:0},null,2));
 console.log('PASS: three themes, real queue/My filters, isolated populated-table/editor retry, mobile containment; all public records/passwords unchanged; zero saved business writes.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

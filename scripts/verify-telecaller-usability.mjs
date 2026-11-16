import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing operational identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/telecaller-usability';
let db,admin,auth,browser,stage='configuration';const writes=[],errors=[];
async function snapshot(){
 const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
 return (await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;
}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();
 const before=await snapshot();const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select m.user_id,u.email,m.role from public.organization_memberships m join auth.users u on u.id=m.user_id join crm_private.bootstrap_state b on exists(select 1 from public.organization_memberships bm where bm.user_id=b.user_id and bm.organization_id=m.organization_id) where m.active and m.role in ('telecaller','admin') and b.completed_at is not null order by case when m.role='telecaller' then 0 else 1 end,m.user_id limit 1")).rows[0];assert(owner?.email);
 const lead=(await db.query('select l.id,l.name,l.status_id,i.source_id from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.submission_id=$1',['6875bfac-874e-4784-ab30-41807442951d'])).rows[0];assert(lead,'Existing retained API example is required; do not create a replacement.');
 stage='temporary local session for existing Admin';
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>{cookies.splice(0,cookies.length,...values);}}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:!process.argv.includes('--visible')});
 const context=await browser.newContext({viewport:{width:1600,height:780}});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.dismiss());
 let simulateSuccess=false;let callRequests=[],callbackRequests=[],patches=[],releaseCall;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['POST','PATCH','DELETE','PUT'].includes(request.method())&&url.origin===base&&url.pathname!=='/api/leads/search'){
   const body=request.postDataJSON();writes.push(url.pathname);
   if(url.pathname.endsWith('/calls')){callRequests.push(body);if(simulateSuccess)return route.fulfill({status:201,json:{replayed:false}});return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });

 stage='simple default';
 const searchReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/leads/search'&&r.request().method()==='POST');
 await page.goto(base+'/app?q='+encodeURIComponent(lead.name));
 const saved=(await (await searchReply).json()).leads.find(l=>l.id===lead.id);assert(saved?.work_summary,'Read-only activity enrichment must load');
 const last=(await db.query('select attempted_at,outcome_label,notes from public.call_attempts where lead_id=$1 order by attempted_at desc,id desc limit 1',[lead.id])).rows[0]??null;
 const next=(await db.query("select due_at,notes from public.follow_ups where lead_id=$1 and state='pending' order by due_at,id limit 1",[lead.id])).rows[0]??null;
 assert.equal(saved.work_summary.last_call?.attempted_at?new Date(saved.work_summary.last_call.attempted_at).toISOString():null,last?.attempted_at.toISOString()??null);
 assert.equal(saved.work_summary.next_follow_up?.due_at?new Date(saved.work_summary.next_follow_up.due_at).toISOString():null,next?.due_at.toISOString()??null);
 const card=page.locator('tr[data-lead-id="'+lead.id+'"]');await card.waitFor();
 assert.equal(await page.locator('.leads-workspace').getAttribute('data-calling-view'),'simple');
 assert.equal(await page.getByLabel('Scrollable leads table',{exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Apply filters',exact:true}).isVisible(),false);
 assert.equal(await page.locator('.inquiry-card').count(),0);assert(await card.locator('.freeze-name').isVisible());assert(await card.locator('.freeze-mobile').isVisible());
 mkdirSync(root,{recursive:true});
 const mask=[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')];
 for(const theme of ['Light','Dark','Mixed']){
  await chooseTheme(page,theme);await page.reload();await card.waitFor();
  assert.equal(await page.locator('.crm-shell').getAttribute('data-crm-theme'),theme.toLowerCase());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'.png',mask});
 }
 stage='reachable row call action';
 await card.getByRole('button',{name:'Open call form',exact:true}).click();assert.equal(await page.getByRole('dialog').getByRole('tab',{name:'Calls',exact:true}).getAttribute('aria-selected'),'true');await page.getByRole('button',{name:'Close lead details',exact:true}).click();
 const box=await card.boundingBox();assert(box.y+box.height<780,'First row must be visible without page scrolling');
 stage='inline status without Edit row';
 const statusSelect=card.getByLabel('Status for '+lead.name,{exact:true});assert(await statusSelect.isVisible());
 const nextStatus=await statusSelect.locator('option').evaluateAll(options=>options.map(o=>o.value));const alternative=nextStatus.find(id=>id!==lead.status_id);assert(alternative,'An existing second status is needed; do not create one.');
 await statusSelect.selectOption(alternative);await card.getByText('Browser-only intercepted stale edit. Reload latest before saving.',{exact:true}).first().waitFor();
 assert.equal(patches.length,1);assert.equal(patches[0].status_id,alternative);assert.equal(await statusSelect.inputValue(),lead.status_id);assert(Number.isSafeInteger(patches[0].version));
 stage='simple order and details';await card.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();
 const drawer=page.getByRole('dialog',{name:lead.name,exact:true});await drawer.waitFor();
 assert.equal(await drawer.getByRole('tab').count(),4);assert.equal(await drawer.locator('.record-overview').count(),1);await drawer.screenshot({path:root+'/record-overview.png'});
 await drawer.getByRole('tab',{name:'Answers',exact:true}).click();const answers=drawer.getByRole('tabpanel',{name:'Answers',exact:true});
 assert.match(await answers.innerText(),/Sir Demo Typed Answer/);assert(!(await answers.innerText()).includes('paid_social'));assert(!(await answers.innerText()).includes('{"choice"'));
 await answers.getByText('Order & tracking fields',{exact:true}).click();assert((await answers.innerText()).includes('paid_social'));await answers.getByText('Order & tracking fields',{exact:true}).click();
 await drawer.getByRole('tab',{name:'Order',exact:true}).click();
 await drawer.getByRole('button',{name:'More details & history',exact:true}).click();assert.equal(await drawer.getByRole('tab').count(),6);
 await drawer.getByRole('tab',{name:'Source',exact:true}).click();await drawer.getByRole('button',{name:'Hide extra details',exact:true}).click();
 assert.equal(await drawer.getByRole('tab',{name:'Order',exact:true}).getAttribute('aria-selected'),'true');
 await drawer.getByRole('button',{name:'Open call form',exact:true}).click();
 const call=drawer.getByRole('region',{name:'Lead calls'});
 const outcome=drawer.getByLabel('Call outcome',{exact:true});await outcome.waitFor();
 await page.waitForFunction(()=>!document.querySelector('.call-panel form button')?.disabled);
 assert.equal(await outcome.inputValue(),'');await drawer.getByRole('button',{name:'Save call result',exact:true}).click();assert.equal(callRequests.length,0);assert.equal(await outcome.evaluate(el=>el.validity.valueMissing),true);await outcome.selectOption(lead.status_id);
 await drawer.getByLabel('Call notes (optional)',{exact:true}).fill('Intercepted browser verification; never sent to server.');
 await drawer.getByLabel('Call again later',{exact:true}).check();
 await drawer.locator('input[type="datetime-local"]').fill('2026-12-01T10:30');
 await drawer.getByRole('tab',{name:'Order',exact:true}).click();await drawer.getByRole('tab',{name:'Calls',exact:true}).click();
 assert.equal(await drawer.getByLabel('Call notes (optional)',{exact:true}).inputValue(),'Intercepted browser verification; never sent to server.');
 await drawer.getByRole('button',{name:'Save call result',exact:true}).scrollIntoViewIfNeeded();const actionBox=await drawer.getByRole('button',{name:'Save call result',exact:true}).boundingBox();assert(actionBox.y>=0&&actionBox.y+actionBox.height<750,'Call action must remain above drawer footer');
 await page.screenshot({path:root+'/call-form.png',mask});
 stage='same request retry without business writes';
 await drawer.getByRole('button',{name:'Save call result',exact:true}).click();
 await drawer.getByRole('button',{name:'Retry saving',exact:true}).waitFor();
 assert.equal(callRequests.length,1);assert(callRequests[0].follow_up);
 await drawer.getByRole('button',{name:'Retry saving',exact:true}).click();
 await page.waitForTimeout(300);assert.equal(callRequests.length,2);assert.deepEqual(callRequests[0],callRequests[1]);assert(await outcome.isDisabled());
 await drawer.getByText('Previous calls & confirmation history',{exact:true}).click();
 await drawer.getByRole('button',{name:'Refresh previous calls',exact:true}).click();
 assert.equal(callRequests.length,2);
 await page.getByRole('button',{name:'Close lead details',exact:true}).click();assert(await drawer.isVisible(),'Dismissed guard must retain uncertain attempt');
 // Discard only browser-local test draft through an explicitly accepted close dialog.
 page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Close lead details',exact:true}).click();await drawer.waitFor({state:'hidden'});
 stage='simulated successful call plus follow-up';
 simulateSuccess=true;await card.getByRole('button',{name:'Open call form',exact:true}).click();
 const successDrawer=page.getByRole('dialog',{name:lead.name,exact:true});
 await successDrawer.getByLabel('Call outcome',{exact:true}).selectOption(alternative);
 await successDrawer.getByLabel('Call notes (optional)',{exact:true}).fill('Simulated usability check; not a real call.');
 await successDrawer.getByLabel('Call again later',{exact:true}).check();
 await successDrawer.locator('input[type="datetime-local"]').fill('2026-12-02T11:00');
 await successDrawer.getByRole('button',{name:'Save call result',exact:true}).click();
 await successDrawer.getByRole('status').filter({hasText:'Call result saved. Next call date saved.'}).waitFor();
 await successDrawer.getByRole('button',{name:'Call recorded',exact:true}).waitFor();assert(await successDrawer.getByRole('button',{name:'Call recorded',exact:true}).isDisabled());
 assert(callRequests.at(-1).follow_up);assert.equal(callRequests.length,3);
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Close lead details"]')?.disabled);await successDrawer.screenshot({path:root+'/simulated-success.png'});
 await page.getByRole('button',{name:'Close lead details',exact:true}).click();await successDrawer.waitFor({state:'hidden'});await card.waitFor();
 stage='real server new queue';
 const sent=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/leads/search'&&r.method()==='POST'&&r.postDataJSON().definition.statuses.length>0);
 await page.getByRole('button',{name:'New leads',exact:true}).click();const request=await sent;assert.equal((await request.response()).status(),200);assert(request.postDataJSON().definition.statuses.length>0);
 await page.getByRole('navigation',{name:'Choose your calling work'}).getByRole('link',{name:"Today's follow-ups",exact:true}).click();await page.waitForURL('**/app/follow-ups?view=due_today');
 assert.equal(await page.getByLabel('Follow-up filter',{exact:true}).inputValue(),'due_today');
 stage='mobile';await page.goto(base+'/app?q='+encodeURIComponent(lead.name));await card.waitFor();await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>{const s=document.querySelector('.crm-sidebar');return s?.inert&&s.getBoundingClientRect().right<=1&&document.documentElement.scrollWidth<=innerWidth;});await page.screenshot({path:root+'/mobile.png',mask:[page.locator('.crm-profile-label')]});
 await card.locator('.mobile-lead-call').click();const mobileDrawer=page.getByRole('dialog',{name:lead.name,exact:true});await mobileDrawer.getByLabel('Call again later',{exact:true}).check();
 const date=mobileDrawer.locator('input[type="datetime-local"]');await date.fill('2026-12-03T10:30');await date.scrollIntoViewIfNeeded();
 assert(await date.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),'Date must be reachable, not covered by save');
 await page.screenshot({path:root+'/mobile-date-uncovered.png',mask:[page.locator('.crm-profile-label')]});
 const mobileAction=mobileDrawer.getByRole('button',{name:'Save call result',exact:true});await mobileAction.scrollIntoViewIfNeeded();const mobileBox=await mobileAction.boundingBox();assert(mobileBox.y>=0&&mobileBox.y+mobileBox.height<814,'Mobile save action must stay visible');
 await page.screenshot({path:root+'/mobile-call-form.png',mask:[page.locator('.crm-profile-label')]});await page.getByRole('button',{name:'Close lead details',exact:true}).click();
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);
 writeFileSync(root+'/evidence.json',JSON.stringify({base,required_result_checked:true,desktop_mobile_save_reachable:true,mobile_date_uncovered:true,answers_grouped_without_loss:true,mobile_row_call_accessible:true,success_button_label_verified:true,actor_role:owner.role,simulated_success_only:true,real_persisted_call_or_follow_up:false,simple_default:true,inline_status_dropdown:true,activity_summary_matches_existing_database:true,reachable_row_call_action:true,first_row_visible:true,intercepted_stale_status_rollback:true,themes:['light','dark','mixed'],mobile_no_overflow:true,server_new_queue:true,today_followups:true,draft_retained:true,uncertain_retry_same_payload:2,intercepted_total_call_requests:callRequests.length,call_and_followup_writes:'intercepted, not persisted',all_public_records_and_passwords_unchanged:true,new_leads:0,new_users:0,live_website_integration:'pending'},null,2));
 console.log('PASS ('+owner.role+', local, simulated save only): inline Status without Edit row; intercepted versioned save/stale rollback; simple default; three themes; mobile; real server New filter; today follow-ups; details; call/follow-up draft; intercepted stable retry; all public data/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

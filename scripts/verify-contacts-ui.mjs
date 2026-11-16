import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/contacts-ui';
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


 stage='contacts default';
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/leads/search'&&r.request().method()==='POST');
 await page.goto(base+'/app?q='+encodeURIComponent(lead.name));
 const saved=(await (await response).json()).leads.find(l=>l.id===lead.id);assert(saved);
 const row=page.locator('tr[data-lead-id="'+lead.id+'"]');await row.waitFor();
 const headers=['Name','Mobile','Course / Price','Status','Source','Next Callback'];
 assert.deepEqual(await page.locator('.compact-leads-table th').allTextContents(),headers);
 assert(await row.getByLabel('Status for '+lead.name,{exact:true}).isVisible());
 assert((await row.locator('td').nth(2).innerText()).includes(saved.order_details.price));
 assert((await row.locator('td').nth(4).innerText()).includes(saved.order_details.traffic_source||'Unknown'));
 const next=(await db.query("select due_at from public.follow_ups where lead_id=$1 and state='pending' order by due_at,id limit 1",[lead.id])).rows[0];
 assert.equal(saved.work_summary.next_follow_up?.due_at?new Date(saved.work_summary.next_follow_up.due_at).toISOString():null,next?.due_at.toISOString()??null);
 assert(await page.locator('.crm-sidebar').getByRole('link',{name:'Leads',exact:true}).isVisible());
 stage='sidebar visibility and collapse';
 const sidebar=page.getByRole('complementary',{name:'Main navigation',exact:true});
 assert.equal(await sidebar.getByRole('link').count(),11);
 for(const link of await sidebar.getByRole('link').all())assert(await link.isVisible());
 await sidebar.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 assert.equal(await page.locator('.crm-shell').getAttribute('data-collapsed'),'true');
 assert.equal(await sidebar.getByRole('link',{name:'Leads',exact:true}).getAttribute('title'),'Leads');
 await sidebar.getByRole('button',{name:'Expand sidebar',exact:true}).click();
 stage='filters and existing create form';
 await page.getByRole('button',{name:'Filters',exact:true}).click();assert(await page.getByRole('button',{name:'Apply filters',exact:true}).isVisible());
 assert.deepEqual(await page.locator('.compact-leads-table th').allTextContents(),headers);
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 await page.getByRole('button',{name:'+ Add Lead',exact:true}).click();assert(await page.locator('.add-form input[name=name]').isVisible());
 await page.locator('.lead-create-panel>summary').click();
 mkdirSync(root,{recursive:true});
 const mask=[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')];
 for(const theme of ['Light','Dark','Mixed']){
  await chooseTheme(page,theme);await page.reload();await row.waitFor();assert.equal(await page.locator('.crm-shell').getAttribute('data-crm-theme'),theme.toLowerCase());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'.png',mask});
  await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();
  const drawer=page.getByRole('dialog');assert.deepEqual(await drawer.getByRole('tab').allTextContents(),['Order Details','Log Call','Follow-up']);
  await drawer.getByRole('tab',{name:'Log Call',exact:true}).click();await drawer.getByRole('button',{name:'Save call result',exact:true}).waitFor();
  await drawer.getByRole('tab',{name:'Follow-up',exact:true}).click();await drawer.getByText('Schedule follow-up',{exact:true}).first().waitFor();
  await drawer.getByRole('tab',{name:'Order Details',exact:true}).click();
  await drawer.getByRole('button',{name:'More details & history',exact:true}).click();assert(await drawer.getByRole('tab',{name:'Answers',exact:true}).isVisible());
  await drawer.getByRole('button',{name:'Hide extra details',exact:true}).click();
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'-panel.png',mask});
  await drawer.getByRole('button',{name:'Close lead details',exact:true}).click();
 }
 stage='mobile';await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('.leads-workspace')?.textContent.includes('Loading leads'));await row.waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:root+'/mobile.png'});
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 const navigation=page.getByRole('dialog',{name:'Main navigation',exact:true});await navigation.waitFor();
 assert(await navigation.getByRole('link',{name:'Leads',exact:true}).isVisible());
 await page.screenshot({path:root+'/mobile-sidebar.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('.crm-shell').getAttribute('data-mobile-open'),'false');
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 writeFileSync(root+'/evidence.json',JSON.stringify({headers,themes:['Light','Dark','Mixed'],existing_order_price_source:true,next_callback_matches_database:true,filters_keep_columns:true,existing_add_form:true,existing_call_followup_panels:true,dynamic_answers_available:true,mobile_no_page_overflow:true,all_public_data_and_passwords_unchanged:true,business_writes:0,live_website_integration:'pending'},null,2));
 console.log('PASS: six columns, existing order/source/callback, filters, create form, existing detail/call/follow-up panels, three persisted themes, mobile; all public data/passwords unchanged; zero business writes.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

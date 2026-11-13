// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/all-leads-ui';
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
   if(url.pathname.endsWith('/calls')){callRequests.push(body);if(callRequests.length===1)await new Promise(resolve=>{releaseCall=resolve;});return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });
 stage='compact table and frozen columns';
 await page.goto(base+'/app?q='+encodeURIComponent(lead.name));await page.getByRole('button',{name:'More tools',exact:true}).click();const row=page.locator('tr[data-lead-id="'+lead.id+'"]');await row.waitFor();await page.waitForFunction(()=>!document.querySelector('.daily-lead-buttons button')?.disabled);assert.equal(await row.locator('input').count(),0);const firstRowBox=await row.boundingBox();if(firstRowBox.y+firstRowBox.height>=780){mkdirSync(root,{recursive:true});await page.screenshot({path:root+'/above-fold-failure.png',mask:[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')]});console.log({first_row_top:firstRowBox.y,first_row_height:firstRowBox.height});}assert(firstRowBox.y+firstRowBox.height<780,'First lead must be visible at 1600x780 without page scrolling');assert(!(await row.innerText()).includes('6875bfac-874e-4784-ab30-41807442951d'));assert(!(await row.innerText()).includes('https://'));
 const grid=page.getByLabel('Scrollable leads table',{exact:true});const first=await row.locator('.freeze-name').boundingBox(),second=await row.locator('.freeze-mobile').boundingBox();
 await grid.evaluate(el=>{el.scrollLeft=450;});const shifted=await row.locator('.freeze-name').boundingBox(),shiftedMobile=await row.locator('.freeze-mobile').boundingBox();assert(Math.abs(first.x-shifted.x)<2);assert(Math.abs(second.x-shiftedMobile.x)<2);await grid.evaluate(el=>{el.scrollLeft=0;});
 mkdirSync(root,{recursive:true});const mask=[page.locator('.app-header > span')];await page.locator('.leads-workspace').screenshot({path:root+'/all-leads-table.png'});await page.screenshot({path:root+'/all-leads-above-fold.png',mask,maskColor:'#f3f6fa'});
 stage='theme preview and navigation';
 const themeRoot='.cache/crm-theme-preview';mkdirSync(themeRoot,{recursive:true});
 const shell=page.locator('.crm-shell');assert.equal(await shell.getAttribute('data-crm-theme'),'mixed');
 assert.equal(await page.locator('.crm-sidebar a[aria-current="page"]').getAttribute('href'),'/app');
 assert.equal(await row.locator('td').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),14);
 const themeColors={light:{surface:'rgb(255, 255, 255)',nav:'rgb(255, 255, 255)'},dark:{surface:'rgb(22, 33, 50)',nav:'rgb(12, 21, 35)'},mixed:{surface:'rgb(255, 255, 255)',nav:'rgb(17, 28, 45)'}};
 for(const theme of ['light','dark','mixed']){
  await page.getByRole('button',{name:'Theme '+theme[0].toUpperCase()+theme.slice(1),exact:true}).click();
  await page.reload();await row.waitFor();await page.waitForFunction(expected=>document.querySelector('.crm-shell')?.getAttribute('data-crm-theme')===expected,theme);
  const colors=await page.evaluate(()=>({surface:getComputedStyle(document.querySelector('.leads-workspace')).backgroundColor,nav:getComputedStyle(document.querySelector('.crm-sidebar')).backgroundColor,top:getComputedStyle(document.querySelector('.crm-topbar')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(colors.surface,themeColors[theme].surface);assert.equal(colors.nav,themeColors[theme].nav);assert.equal(colors.overflow,false);
  if(theme==='mixed')assert.equal(colors.top,'rgb(17, 28, 45)');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:themeRoot+'/'+theme+'.png',mask:[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')],maskColor:theme==='light'?'#ffffff':'#111c2d'});
  await page.getByText('Add Lead',{exact:true}).click();assert.equal(await page.getByLabel('Mobile number',{exact:true}).evaluate(el=>getComputedStyle(el).fontSize),'14px');assert.equal(await page.getByLabel('Mobile number',{exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),theme==='dark'?'rgb(16, 27, 43)':'rgb(255, 255, 255)');await page.getByText('Add Lead',{exact:true}).click();
  await page.locator('.source-filter-menu > summary').click();assert.equal(await page.locator('.source-filter-content').evaluate(el=>getComputedStyle(el).backgroundColor),themeColors[theme].surface);await page.locator('.source-filter-menu > summary').click();
  await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();const preview=page.getByRole('dialog',{name:lead.name,exact:true});
  await preview.getByRole('tab',{name:'Source',exact:true}).click();assert.equal(await preview.evaluate(el=>getComputedStyle(el).backgroundColor),themeColors[theme].surface);await preview.screenshot({path:themeRoot+'/'+theme+'-panel.png'});
  await preview.getByRole('button',{name:'Close lead details',exact:true}).click();await row.waitFor();
 }
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.reload();await row.waitFor();assert.equal(await shell.getAttribute('data-collapsed'),'true');await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
 await page.locator('.crm-profile-menu > summary').click();assert(await page.getByText('Your staff account',{exact:true}).isVisible());await page.locator('.crm-profile-menu > summary').click();
 await page.getByLabel('Callback reminders',{exact:true}).click();assert(await page.getByRole('link',{name:/Due today/}).isVisible());await page.getByLabel('Callback reminders',{exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();assert.equal(await shell.getAttribute('data-mobile-open'),'true');assert(await page.locator('.crm-sidebar').getByRole('link',{name:'All Leads',exact:true}).isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.crm-shell').getAttribute('data-mobile-open')==='false');
 await page.screenshot({path:themeRoot+'/mobile-mixed.png',mask:[page.locator('.crm-profile-label')]});
 await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'Close lead details',exact:true}).click();
 await page.setViewportSize({width:1600,height:780});await page.evaluate(()=>scrollTo(0,0));
 stage='all six detail tabs';await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();const drawer=page.getByRole('dialog',{name:lead.name,exact:true});await drawer.waitFor();assert((await drawer.innerText()).includes('6875bfac-874e-4784-ab30-41807442951d'));
 await drawer.getByRole('tab',{name:'Source',exact:true}).click();assert((await drawer.innerText()).includes('dailyhealthfocus.info'));assert((await drawer.innerText()).includes('instagram'));assert((await drawer.innerText()).includes('https://dailyhealthfocus.info/Wife/'));
 await drawer.screenshot({path:root+'/all-leads-source-panel.png'});
 await drawer.getByRole('tab',{name:'Answers',exact:true}).click();assert((await drawer.innerText()).includes('Sir Demo Typed Answer'));
 const callResponse=page.waitForResponse(r=>r.url().includes('/calls?page=')&&r.status()===200);await drawer.getByRole('tab',{name:'Calls',exact:true}).click();await callResponse;await drawer.getByLabel('Call notes (optional)',{exact:true}).fill('Unsaved browser check - never sent');
 await drawer.getByRole('tab',{name:'Source',exact:true}).click();await drawer.getByRole('tab',{name:'Calls',exact:true}).click();assert.equal(await drawer.getByLabel('Call notes (optional)',{exact:true}).inputValue(),'Unsaved browser check - never sent');
 await drawer.getByRole('button',{name:'Close lead details',exact:true}).click();assert(await drawer.isVisible());
 stage='call in-flight guard and frozen retry (intercepted)';await drawer.getByRole('button',{name:'Save call result',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Close lead details"]').disabled);assert(releaseCall);releaseCall();await drawer.getByRole('button',{name:'Retry same call',exact:true}).waitFor();await drawer.getByRole('button',{name:'Retry same call',exact:true}).click();await drawer.getByRole('alert').filter({hasText:'Browser-only intercepted uncertain call'}).waitFor();assert.equal(callRequests.length,2);assert.deepEqual(callRequests[0],callRequests[1]);
 stage='follow-up draft and frozen retry (intercepted)';const followResponse=page.waitForResponse(r=>r.url().includes('/api/follow-ups?')&&r.status()===200);await drawer.getByRole('tab',{name:'Follow-ups',exact:true}).click();await followResponse;await drawer.getByRole('button',{name:'Schedule follow-up',exact:true}).click();await drawer.getByLabel('Callback date/time (Asia/Kolkata)',{exact:true}).fill('2026-11-06T10:30');
 await drawer.getByRole('tab',{name:'Order',exact:true}).click();await drawer.getByRole('tab',{name:'Follow-ups',exact:true}).click();assert.equal(await drawer.getByLabel('Callback date/time (Asia/Kolkata)',{exact:true}).inputValue(),'2026-11-06T10:30');
 await drawer.getByRole('button',{name:'Save follow-up',exact:true}).click();await drawer.getByRole('button',{name:'Retry same follow-up',exact:true}).click();assert.equal(callbackRequests.length,2);assert.deepEqual(callbackRequests[0],callbackRequests[1]);
 const historyResponse=page.waitForResponse(r=>r.url().includes('/history?page=')&&r.status()===200);await drawer.getByRole('tab',{name:'History',exact:true}).click();await historyResponse;await drawer.getByRole('heading',{name:'Lead history',exact:true}).waitFor();
 // Reload abandons only in-memory intercepted drafts, not a real operation.
 stage='server filters and stale inline editing';await page.reload();await row.waitFor();await row.getByRole('button',{name:'Edit row for '+lead.name,exact:true}).click();await row.getByLabel('Notes for '+lead.name,{exact:true}).fill('Unsaved local browser edit');await row.getByRole('button',{name:'Save row',exact:true}).click();await row.getByRole('status').filter({hasText:'Browser-only intercepted stale edit'}).waitFor();assert.equal(patches.length,1);assert.equal(patches[0].notes,'Unsaved local browser edit');assert(patches[0].version);await row.getByRole('button',{name:'Cancel edit',exact:true}).click();assert.equal(await row.locator('input').count(),0);
 await page.locator('.source-filter-menu > summary').click();await page.getByLabel('Website: dailyhealthfocus.info',{exact:true}).check();await page.getByLabel('Traffic source: instagram',{exact:true}).check();const searchResponse=page.waitForResponse(r=>r.url().endsWith('/api/leads/search')&&r.request().method()==='POST');await page.getByRole('button',{name:'Apply filters',exact:true}).click();const result=await(await searchResponse).json();assert.equal(result.total,1);assert.equal(result.leads[0].id,lead.id);
 await page.locator('.source-filter-menu > summary').click();await page.getByLabel('Status filter',{exact:true}).selectOption(lead.status_id);const statusResponse=page.waitForResponse(r=>r.url().endsWith('/api/leads/search'));await page.getByRole('button',{name:'Apply filters',exact:true}).click();assert.equal((await(await statusResponse).json()).total,1);
 const query=await page.getByLabel('Search name or mobile',{exact:true}).inputValue();await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();await page.getByRole('button',{name:'Close lead details',exact:true}).click();assert.equal(await page.getByLabel('Search name or mobile',{exact:true}).inputValue(),query);
 assert.deepEqual(errors,[]);await context.close();await browser.close();browser=null;
 stage='data preservation';assert.deepEqual(await snapshot(),before);const after=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;assert.deepEqual(after,passwords);
 writeFileSync(root+'/evidence.json',JSON.stringify({main_crm:base,existing_record_only:true,new_leads:0,new_users:0,all_public_tables_unchanged:true,account_passwords_unchanged:true,compact_table:true,first_row_visible_at_1600x780:true,frozen_columns:true,six_tabs:true,drafts_retained:true,pending_close_guard:true,intercepted_call_retries:callRequests.length,intercepted_callback_retries:callbackRequests.length,intercepted_stale_edits:patches.length,server_filters:true,ui_errors:errors.length,themes:['light','dark','mixed'],theme_persistence:true,sidebar_persistence:true,mobile_drawer:true,mobile_page_overflow:false,readable_table_font_px:14,preview_rollout:'Shared layout across all authenticated pages; public auth screens themed',live_website_integration:'pending'},null,2));
 console.log('PASS main CRM: compact table, frozen Name/Mobile, six detail tabs, real read APIs, draft retention, pending close guard, intercepted same-payload retries/stale edit, actual server filters; zero new leads/users and all existing public records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);if(e.name==='TimeoutError'||e.name==='AssertionError')console.error(String(e.message).split('\n').slice(0,7).join('\n'));reportFailure(e,'All Leads UI');}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

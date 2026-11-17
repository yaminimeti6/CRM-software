import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/performance-details';
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
  if(['POST','PATCH','DELETE','PUT'].includes(request.method())&&url.origin===base&&!['/api/leads/search','/api/performance'].includes(url.pathname)){
   const body=request.postDataJSON();writes.push(url.pathname);
   if(url.pathname.endsWith('/calls')){callRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });





 stage='performance side panel';mkdirSync(root,{recursive:true});await page.goto(base+'/app/performance');await page.locator('[data-metric=current_confirmed]').waitFor();
 async function openMetric(label){
  const card=page.locator('.call-summary>div').filter({has:page.getByText(label,{exact:true})}),button=card.getByRole('button',{name:'View '+label.toLowerCase()+' activity',exact:true});
  const value=Number(await card.locator('dd').innerText());await button.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);
  await button.click();const dialog=page.getByRole('dialog',{name:label,exact:true});await dialog.waitFor();
  await page.waitForFunction(expected=>{const element=document.querySelector('[data-activity-total]');return element&&Number(element.textContent.split(' ')[0])===expected;},value);
  assert.equal(await page.evaluate(()=>scrollY),y,'Opening details must not jump the report');
  assert(await dialog.getByRole('button',{name:'Close performance details',exact:true}).isVisible());
  if(value===0)await dialog.getByRole('heading',{name:'No matching records',exact:true}).waitFor();
  if(value>0){assert(await dialog.locator('.performance-record-list>li').count()>0);assert.match(await dialog.getByRole('link',{name:/Open lead/}).first().getAttribute('href'),/q=[a-f0-9-]{36}/);}
  return {dialog,button};
 }
 for(const label of ['New leads received','Currently confirmed leads','Recorded attempts','Pending callbacks']){
  const {dialog,button}=await openMetric(label);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await button.evaluate(e=>e===document.activeElement));
 }
 for(const theme of ['Light','Dark','Mixed']){
  await chooseTheme(page,theme);const {dialog}=await openMetric('Currently confirmed leads');
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'-panel.png',mask:[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')]});
  await dialog.getByRole('button',{name:'Close performance details',exact:true}).click();await dialog.waitFor({state:'hidden'});
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);const {dialog}=await openMetric('Currently confirmed leads');
 assert(await dialog.evaluate(e=>e.getBoundingClientRect().width<=innerWidth&&e.scrollWidth<=innerWidth));
 await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)),'Native modal keeps keyboard focus inside');
 await page.screenshot({path:root+'/mobile-panel.png'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);
 console.log('PASS: right-side modal, real metric counts/empty state, no page jump, Close/Escape and focus restoration, three themes, mobile focus containment; zero business writes; data/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

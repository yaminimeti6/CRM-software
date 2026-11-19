import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/admin-layout';
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




 mkdirSync(root,{recursive:true});
 async function load(path,selector){await page.goto(base+path);await page.locator(selector).first().waitFor();}
 async function rect(locator){return locator.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};});}
 stage='source toolbar alignment';await load('/app/ingestion','.sources-table-scroll tbody tr');
 const toolbar=page.locator('.sources-toolbar'),controls=[toolbar.locator('input'),toolbar.locator('select'),toolbar.locator('button'),toolbar.locator('a')],boxes=await Promise.all(controls.map(rect));
 assert(Math.max(...boxes.map(r=>r.bottom))-Math.min(...boxes.map(r=>r.bottom))<2,'Toolbar controls must share a bottom edge');for(const box of boxes)assert(Math.abs(box.height-40)<2);
 stage='workspace grid overrides';await load('/app/settings','.status-setting-row');const row=page.locator('.status-setting-row').first(),name=row.locator('label').first();assert(Math.abs((await rect(name)).width-(await rect(name.locator('input'))).width)<2,'Status input fills its grid track');
 const columns=page.locator('.column-setting-row').first(),move=columns.locator('button');assert((await rect(move.nth(1))).x-(await rect(move.nth(0))).right>=12);
 stage='catalog grid and form';await load('/app/catalog','.catalog-record-grid .call-panel');const cards=page.locator('.catalog-record-grid .call-panel');if(await cards.count()>1){const a=await rect(cards.nth(0)),b=await rect(cards.nth(1));assert(Math.abs(a.y-b.y)<2);assert(b.x-a.right>=12);}
 const fields=page.locator('.catalog-item-form>label');assert.equal(await fields.count(),2);assert(Math.abs((await rect(fields.nth(0).locator('select'))).height-40)<2);
 stage='Meta action gaps';await load('/app/meta','.meta-account-card');const actions=page.locator('.meta-account-actions').first().locator('button');assert((await rect(actions.nth(1))).x-(await rect(actions.nth(0))).right>=12);const sync=page.locator('.meta-sync-settings input');assert(Math.abs((await rect(sync.nth(0))).width-(await rect(sync.nth(1))).width)<2);
 stage='import batch gaps';await load('/app/imports','.import-batch-actions');const batchButtons=page.locator('.import-batch-actions button');if(await batchButtons.count()>1){const a=await rect(batchButtons.nth(0)),b=await rect(batchButtons.nth(1));assert(b.x-a.right>=10||b.y>=a.bottom+10);}
 const pages=[['/app/ingestion','.sources-table-scroll tbody tr','sources'],['/app/catalog','.catalog-record-grid .call-panel','catalog'],['/app/settings','.status-setting-row','settings'],['/app/meta','.meta-account-card','meta'],['/app/imports','.import-batch-actions','imports']];
 const mask=[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')];
 for(const theme of ['Light','Dark','Mixed']){await chooseTheme(page,theme);for(const [path,selector,name]of pages){stage=theme+' '+path;await load(path,selector);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:root+'/'+name+'-'+theme.toLowerCase()+'.png',mask});}}
 await page.setViewportSize({width:390,height:844});for(const[path,selector,name]of pages){stage='mobile '+path;await load(path,selector);await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page overflow: '+path);await page.screenshot({path:root+'/'+name+'-mobile.png'});}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);
 console.log('PASS: measured 40px toolbar controls/shared baseline, full-width status fields, reorder/action/batch gaps, catalog grid, Meta settings grid, five pages/three themes/mobile; zero business writes; records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/navigation-refresh';
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
 stage='managed columns';await load('/app','table[aria-label="Shared leads"] tbody tr');
 assert.equal(await page.locator('a[href="/app/settings"]').count(),0);
 assert.deepEqual(await page.locator('table[aria-label="Shared leads"] thead th').allTextContents(),['Name','Mobile','Course / Price','Status','Source','Next Callback']);
 assert.equal(await page.locator('.personal-column-layout').count(),0);
 for(const theme of ['Light','Dark','Mixed']){
 await chooseTheme(page,theme);
 const shell=page.locator('.crm-shell');
 await page.mouse.move(800,80);await page.locator('.crm-page-heading h2').click();
 await page.waitForTimeout(250);assert.equal(await shell.getAttribute('data-collapsed'),'true');
 const mainBefore=await page.locator('.crm-main').boundingBox();
 await page.locator('.crm-brand-mark').hover();await page.waitForTimeout(250);
 assert.equal(await shell.getAttribute('data-collapsed'),'false');
 assert.equal(await page.locator('.crm-sidebar nav a[aria-current="page"]').count(),1);
 assert.equal(await page.locator('.crm-collapse-button').count(),0);
 assert((await page.locator('.crm-sidebar').boundingBox()).width>=240);
 assert.equal((await page.locator('.crm-main').boundingBox()).x,mainBefore.x,'Hover must not shift main content');
 await page.screenshot({path:root+'/'+theme.toLowerCase()+'-expanded.png'});
 await page.mouse.move(800,80);await page.waitForTimeout(250);
 assert.equal(await shell.getAttribute('data-collapsed'),'true');
 assert((await page.locator('.crm-sidebar').boundingBox()).width<=80);
 await page.screenshot({path:root+'/'+theme.toLowerCase()+'-collapsed.png'});


 }
 await page.getByLabel('Appearance',{exact:true}).click();
 await page.getByLabel('User profile menu',{exact:true}).click();
 assert.equal(await page.locator('.crm-top-menu[open]').count(),1);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.crm-top-menu[open]').count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 assert.equal(await page.locator('.crm-shell').getAttribute('data-mobile-open'),'true');
 await page.screenshot({path:root+'/mobile-drawer.png'});
 await page.getByRole('button',{name:'Close navigation',exact:true}).click();
 assert.equal(await page.locator('.crm-shell').getAttribute('data-mobile-open'),'false');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 stage='retired settings route';await page.goto(base+'/app/settings');await page.waitForURL(base+'/app');await page.locator('table[aria-label="Shared leads"] tbody tr').first().waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);
 console.log('PASS: hover open/leave close without content shift in three themes, active destination, exclusive top menus, Escape, mobile drawer, no page overflow, zero business writes, records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/sources-ui';
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
  if(['POST','PATCH','DELETE','PUT'].includes(request.method())&&url.origin===base&&!['/api/leads/search','/api/meta/spend','/api/ad-attribution/report'].includes(url.pathname)){
   const body=request.postDataJSON();writes.push(url.pathname);
   if(url.pathname.endsWith('/calls')){callRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });




 stage='source list';mkdirSync(root,{recursive:true});const data=await(await page.request.get(base+'/api/ingestion-sources')).json();assert(data.sources.length>0);
 let submitted;await page.route('**/api/ingestion-sources',route=>{if(route.request().method()==='POST'){submitted=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'Browser-only intercepted source save; no changes persisted.'}});}return route.continue();});
 await page.goto(base+'/app/ingestion');await page.locator('.sources-table-scroll tbody tr').first().waitFor();assert.equal(await page.locator('.sources-table-scroll tbody tr').count(),data.sources.length);assert(!/step[ _-]*[0-9]/i.test(await page.locator('.crm-content').innerText()));
 const source=data.sources[0];await page.getByLabel('Search sources',{exact:true}).fill(source.form_id);assert(await page.locator('.sources-table-scroll tbody tr').count()>0);await page.getByLabel('Search sources',{exact:true}).fill('');
 await page.getByLabel('Source status',{exact:true}).selectOption('enabled');assert.equal(await page.locator('.sources-table-scroll tbody tr').count(),data.sources.filter(s=>s.enabled).length);await page.getByLabel('Source status',{exact:true}).selectOption('all');
 stage='source editor and unchanged API contract';await page.getByRole('button',{name:'Edit source '+source.name,exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit source',exact:true});await editor.waitFor();assert(await editor.locator('input[name=form_id]').isEditable()===false);assert.equal(await editor.locator('textarea[name=origins]').inputValue(),source.allowed_origins.join('\n'));
 await editor.locator('textarea[name=origins]').fill('https://first.example\nhttps://second.example');await editor.getByRole('button',{name:'Save source',exact:true}).click();await editor.getByRole('alert').filter({hasText:'Browser-only intercepted'}).waitFor();assert.equal(submitted.id,source.id);assert.equal(submitted.revision,source.revision);assert.deepEqual(submitted.input.allowed_origins,['https://first.example','https://second.example']);assert.equal(submitted.input.form_id,source.form_id);
 await editor.getByRole('button',{name:'Close source editor',exact:true}).click();assert(await editor.isVisible(),'Dismissed dirty guard must preserve draft');page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await editor.getByRole('button',{name:'Close source editor',exact:true}).click();await editor.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'+ New source',exact:true}).click();const fresh=page.getByRole('dialog',{name:'New source',exact:true});await fresh.waitFor();assert.equal(await fresh.locator('input[name=enabled]').isChecked(),false);await page.keyboard.press('Escape');await fresh.waitFor({state:'hidden'});
 for(const theme of ['Light','Dark','Mixed']){await chooseTheme(page,theme);await page.screenshot({path:root+'/'+theme.toLowerCase()+'.png',mask:[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')]});}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'+ New source',exact:true}).click();await fresh.waitFor();assert(await fresh.evaluate(e=>e.getBoundingClientRect().width<=innerWidth));await page.screenshot({path:root+'/mobile-editor.png'});await page.keyboard.press('Escape');
 stage='customer-facing roadmap labels';await page.goto(base+'/app/attribution');await page.getByRole('heading',{name:/Attribution/}).first().waitFor();assert(!/step[ _-]*[0-9]/i.test(await page.locator('.crm-content').innerText()));
 await page.goto(base+'/app/meta-spend');const select=page.getByLabel('Spend account',{exact:true});await page.waitForFunction(()=>document.querySelector('select[aria-label="Spend account"]')?.options.length>1);await select.selectOption({index:1});await page.getByRole('button',{name:'Load spend report',exact:true}).click();await page.getByRole('table',{name:'Meta spend groups',exact:true}).waitFor();assert(!/step[ _-]*[0-9]/i.test(await page.locator('.crm-content').innerText()));
 assert.deepEqual(errors,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);
 console.log('PASS: compact source table/search/status, side editor, identical versioned API/multiline origins, dirty guard, disabled new source default, three themes/mobile, no visible roadmap labels; source write intercepted; all data/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

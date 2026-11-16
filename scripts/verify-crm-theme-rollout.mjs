import {chooseTheme} from './lib/ui-appearance.mjs';
// Existing Admin/records only. Real read APIs; all business mutations blocked.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
import {crmNavigation} from '../src/lib/crm-navigation.ts';
const base='http://localhost:3000',root='.cache/crm-theme-rollout';
const expectedApi={
 '/app':'/api/leads/search','/app/follow-ups':'/api/follow-ups','/app/performance':'/api/performance',
 '/app/attribution':'/api/ad-attribution/report','/app/meta-spend':'/api/meta/spend','/app/team':'/api/team',
 '/app/ingestion':'/api/ingestion-sources','/app/catalog':'/api/catalog','/app/imports':'/api/imports','/app/meta':'/api/meta/admin','/app/settings':'/api/workspace-settings',
};
let db,admin,auth,browser,stage='configuration';const errors=[],blockedWrites=[],results=[];
const readPosts=new Set(['/api/leads/search','/api/performance','/api/ad-attribution/report','/api/meta/spend']);
async function snapshot(){const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);return(await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();const before=await snapshot();
 const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select s.user_id,u.email from crm_private.bootstrap_state s join auth.users u on u.id=s.user_id join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner?.email);
 const example=(await db.query('select l.name from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.submission_id=$1',['6875bfac-874e-4784-ab30-41807442951d'])).rows[0];assert(example,'Existing retained example required; do not create a fixture.');
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>cookies.splice(0,cookies.length,...values)}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin===base&&['POST','PATCH','PUT','DELETE'].includes(r.method())&&!readPosts.has(u.pathname)){blockedWrites.push(u.pathname);return route.abort();}return route.continue();});
 const items=crmNavigation('admin').flatMap(group=>group.items),themes=['light','dark','mixed'];mkdirSync(root,{recursive:true});
 const mask=[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')];
 await page.goto(base+'/app?q='+encodeURIComponent(example.name));await page.getByLabel('Appearance',{exact:true}).waitFor();
 for(const theme of themes){
  await chooseTheme(page,theme);
  for(const item of items){
   stage=theme+' '+item.href;
   const apiReady=page.waitForResponse(r=>new URL(r.url()).pathname===expectedApi[item.href]&&r.request().resourceType()==='fetch'&&(item.href!=='/app/follow-ups'||new URL(r.url()).searchParams.has('view')),{timeout:30000});
   // Follow a real sidebar link; All Leads is narrowed afterward for screenshot privacy.
   if(item.href==='/app')await page.goto(base+'/app?q='+encodeURIComponent(example.name));else {const link=page.locator('.crm-sidebar').getByRole('link',{name:item.label,exact:true});if(!await link.isVisible()){const group=crmNavigation('admin').find(g=>g.items.some(i=>i.href===item.href));await page.locator('.crm-sidebar').getByText(group.label,{exact:true}).click();}await link.click();}
   const api=await apiReady;assert.equal(api.status(),200,'Read API failed for '+item.href);
   await page.waitForFunction(expected=>document.querySelector('.crm-shell')?.getAttribute('data-crm-theme')===expected,theme);
   assert.equal(await page.locator('.crm-shell').count(),1);assert.equal(await page.locator('.crm-shell').getAttribute('data-workspace-design'),'reference');assert.equal(await page.locator('.app-header').count(),0);
   assert.equal(await page.locator('.crm-page-heading h2').innerText(),item.label);
   assert.equal(await page.locator('.crm-sidebar a[aria-current="page"]').getAttribute('href'),item.href);
   assert.equal(await page.locator('.crm-content>section').first().evaluate(el=>getComputedStyle(el).backgroundColor),theme==='dark'?'rgb(32, 35, 40)':'rgb(255, 255, 255)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Page-wide overflow: '+item.href);
   results.push({theme,page:item.href,read_status:api.status(),active_title:true,single_shell:true});
   { // Capture each existing page for local visual review.
    await page.waitForTimeout(150);await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:root+'/'+item.href.split('/').at(-1)+'-'+theme+'.png',mask,maskColor:theme==='light'?'#fff':'#111c2d'});
   }
  }
 }
 stage='Team and invitation controls retained';await page.goto(base+'/app/team');await page.getByRole('heading',{name:'Staff',exact:true}).waitFor();await page.getByText('Invite staff',{exact:true}).click();assert(await page.getByRole('button',{name:'Create invitation',exact:true}).isVisible());assert.equal(await page.getByLabel('Invitation role',{exact:true}).inputValue(),'telecaller');
 stage='narrow-screen pages';await page.setViewportSize({width:390,height:844});
 for(const path of items.map(item=>item.href)){
  await page.goto(base+path);await page.waitForFunction(()=>document.querySelector('.crm-sidebar')?.inert===true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page-wide overflow: '+path);
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();assert.equal(await page.locator('.crm-shell').getAttribute('data-mobile-open'),'true');await page.getByRole('button',{name:'Close navigation',exact:true}).click();
 }
 await page.goto(base+'/app/follow-ups');await page.screenshot({path:root+'/follow-ups-mobile.png',mask:[page.locator('.crm-profile-label')]});
 const publicContext=await browser.newContext({viewport:{width:1200,height:850}}),publicPage=await publicContext.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
 await publicPage.route('**/*',route=>{const r=route.request();if(['POST','PATCH','PUT','DELETE'].includes(r.method())){blockedWrites.push(new URL(r.url()).pathname);return route.abort();}return route.continue();});
 for(const theme of themes){
  stage='public screens '+theme;await publicPage.goto(base+'/login');await publicPage.getByRole('button',{name:'Theme '+theme[0].toUpperCase()+theme.slice(1),exact:true}).click();
  for(const path of ['/login','/join']){
   await publicPage.goto(base+path);await publicPage.waitForFunction(expected=>document.querySelector('.crm-auth-frame')?.getAttribute('data-crm-theme')===expected,theme);assert.equal(await publicPage.locator('.crm-sidebar').count(),0);
   assert.equal(await publicPage.locator('.crm-auth-content>section').evaluate(el=>getComputedStyle(el).backgroundColor),theme==='dark'?'rgb(32, 35, 40)':'rgb(255, 255, 255)');
   await publicPage.screenshot({path:root+'/'+path.slice(1)+'-'+theme+'.png'});
  }
 }
 stage='unauthenticated route protection';for(const item of items){await publicPage.goto(base+item.href);await publicPage.waitForURL('**/login');assert.equal(await publicPage.locator('.crm-sidebar').count(),0);}
 await publicContext.close();await context.close();await browser.close();browser=null;
 stage='record/account preservation';assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(blockedWrites,[]);assert.deepEqual(errors,[]);
 writeFileSync(root+'/evidence.json',JSON.stringify({pages:results,themes,protected_pages:items.length,public_screens:['/login','/join'],mobile_checked:items.map(item=>item.href),business_writes:0,new_leads:0,new_users:0,existing_records_passwords_unchanged:true,legacy_navbars:0,live_website_integration:'pending'},null,2));
 console.log('PASS '+results.length+' authenticated page/theme combinations; all existing page read APIs 200, single shared shell/active nav, public auth themes, mobile overflow/drawers, unauthenticated redirects; zero business writes/new leads/users; existing public records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);if(e.name==='AssertionError'||e.name==='TimeoutError')console.error(String(e.message).split('\n').slice(0,7).join('\n'));reportFailure(e,'whole CRM theme rollout');}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

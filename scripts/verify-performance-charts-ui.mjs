import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing Admin identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/performance-charts';
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




 stage='real filtered chart report';mkdirSync(root,{recursive:true});await page.goto(base+'/app/performance');await page.locator('.visual-report-chart').first().waitFor();
 await page.getByLabel('Period (Asia/Kolkata)',{exact:true}).selectOption('30');
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/performance'&&!r.request().postDataJSON()?.kind);
 await page.getByRole('button',{name:'Apply report filters',exact:true}).click();const report=await (await response).json();
 await page.waitForFunction(n=>document.querySelectorAll('.trend-chart .chart-point').length===n,report.daily.reduce((n,d)=>n+2+(d.leads===null?0:1),0));
 const charts=page.locator('.visual-report-chart');assert.equal(await charts.count(),6);
 assert.equal(await page.locator('.trend-chart').count(),1);assert.equal(await page.locator('.hour-chart .hour-column').count(),report.hourly.length);
 for(const [title,values] of [['Lead status',report.status_distribution],['Call outcomes',report.outcomes]]){
  const card=charts.filter({has:page.getByRole('heading',{name:title,exact:true})}),total=values.reduce((n,v)=>n+v.total,0);
  if(total>0)assert.equal(Number(await card.locator('.donut-total').textContent()),total);else assert(await card.locator('.chart-empty').isVisible());
 }
 const daily=charts.filter({has:page.getByRole('heading',{name:'Daily activity',exact:true})});
 await daily.getByText('View chart data',{exact:true}).click();
 const rows=await daily.locator('tbody tr').allTextContents();assert.equal(rows.length,report.daily.length);
 for(let i=0;i<rows.length;i++)assert.equal(rows[i],report.daily[i].day+(report.daily[i].leads??'N/A')+report.daily[i].calls+report.daily[i].confirmations);
 await daily.getByText('View chart data',{exact:true}).click();
 for(const theme of ['Light','Dark','Mixed']){
  await chooseTheme(page,theme);await daily.evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(950);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/'+theme.toLowerCase()+'.png',mask:[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')]});
 }
 await charts.filter({has:page.getByRole('heading',{name:'Lead status',exact:true})}).evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(700);await page.screenshot({path:root+'/distributions.png',mask:[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')]});
 stage='reduced motion and mobile';await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.chart-line').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.setViewportSize({width:390,height:844});await daily.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:root+'/mobile.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);
 console.log('PASS: real daily series and exact data tables, donut totals, hourly columns, six chart cards, three themes, reduced motion, mobile containment; no business writes; records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);console.error(String(e.message).split('\n').slice(0,8).join('\n'));process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

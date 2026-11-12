// Existing Admin/records only. Real read APIs; all business mutations blocked.
import assert from 'node:assert/strict';
import {migrate,lockId} from './lib/bootstrap.mjs';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/daily-workflow';
let db,admin,auth,browser,stage='configuration';const errors=[],writes=[];
async function snapshot(){const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);return(await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();const before=await snapshot();if(process.argv.includes('--apply-migration')){assert((await db.query('select pg_try_advisory_lock($1) locked',[lockId])).rows[0].locked,'Another migration is running');try{await migrate(db);}finally{await db.query('select pg_advisory_unlock($1)',[lockId]);}assert.deepEqual(await snapshot(),before);console.log('PASS: checked migrations applied; business records unchanged.');}
 const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select s.user_id,u.email from crm_private.bootstrap_state s join auth.users u on u.id=s.user_id join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner?.email);
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>cookies.splice(0,cookies.length,...values)}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));


 mkdirSync(root,{recursive:true});
 const example=(await db.query('select l.id,l.name from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.submission_id=$1',['6875bfac-874e-4784-ab30-41807442951d'])).rows[0];assert(example,'Existing retained lead required; no fixture creation.');
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin===base&&['POST','PATCH','PUT','DELETE'].includes(r.method())&&r.url().includes('/api/')&&u.pathname!=='/api/leads/search'){writes.push(u.pathname);return route.abort();}return route.continue();});
 stage='daily queues';await page.goto(base+'/app?q='+encodeURIComponent(example.name));
 const queue=page.getByRole('navigation',{name:'Daily calling workflow'});await queue.getByRole('button',{name:'New leads',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.daily-lead-buttons button')?.disabled);
 async function choose(label){const sent=page.waitForRequest(r=>{if(new URL(r.url()).pathname!=='/api/leads/search'||r.method()!=='POST')return false;const d=r.postDataJSON().definition;return d.q===''&&(label==='New leads'?d.statuses.length>0:label==='Pending callbacks'?d.callbacks==='pending':d.callbacks==='any'&&d.statuses.length===0);});await queue.getByRole('button',{name:label,exact:true}).click();const req=await sent;const response=await req.response();assert.equal(response.status(),200);await page.waitForFunction(()=>!document.querySelector('.daily-lead-buttons button')?.disabled);return req.postDataJSON().definition;}
 const newQueue=await choose('New leads');assert(newQueue.statuses.length);assert.equal(newQueue.q,'');assert.equal(newQueue.callbacks,'any');
 const pending=await choose('Pending callbacks');assert.equal(pending.callbacks,'pending');assert.deepEqual(pending.statuses,[]);assert.equal(pending.sort,'updated_at');assert.equal(pending.direction,'asc');
 const all=await choose('All leads');assert.equal(all.callbacks,'any');assert.deepEqual(all.statuses,[]);
 stage='follow-up navigation';await queue.getByRole('link',{name:"Today's follow-ups",exact:true}).click();await page.waitForURL('**/app/follow-ups?view=due_today');assert.equal(await page.getByLabel('Follow-up filter',{exact:true}).inputValue(),'due_today');
 await page.goto(base+'/app?q='+encodeURIComponent(example.name));await page.getByRole('navigation',{name:'Daily calling workflow'}).getByRole('link',{name:'Overdue follow-ups',exact:true}).click();await page.waitForURL('**/app/follow-ups?view=overdue');assert.equal(await page.getByLabel('Follow-up filter',{exact:true}).inputValue(),'overdue');
 stage='open first retained result';await page.goto(base+'/app?q='+encodeURIComponent(example.name));const row=page.locator('tr[data-lead-id="'+example.id+'"]');await row.waitFor();
 await page.getByRole('button',{name:'Open first result',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('tab',{name:'Calls',exact:true}).getAttribute('aria-selected'),'true');await page.getByRole('button',{name:'Close lead details',exact:true}).click();
 stage='desktop and mobile';await page.waitForFunction(()=>!document.querySelector('.daily-lead-buttons button')?.disabled);await row.waitFor();
 for(const theme of ['Light','Dark','Mixed']){await page.getByRole('button',{name:'Theme '+theme,exact:true}).click();await page.screenshot({path:root+'/daily-'+theme.toLowerCase()+'.png',mask:[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')]});}
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.crm-sidebar')?.inert===true);await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await page.screenshot({path:root+'/daily-mobile.png',mask:[page.locator('.crm-profile-label')]});
 stage='preservation';assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 writeFileSync(root+'/evidence.json',JSON.stringify({base,server_queues:['all','new','pending_callbacks'],follow_up_views:['due_today','overdue'],first_result_tab:'Calls',themes:['light','dark','mixed'],mobile_width:390,business_writes:0,new_leads:0,new_users:0,public_records_passwords_unchanged:true,live_integration:'pending'},null,2));
 console.log('PASS: actual server queue filters; today/overdue navigation; first-result Calls drawer; three themes/mobile; no business writes/new leads/users; public records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);if(e.name==='AssertionError'||e.name==='TimeoutError')console.error(String(e.message).split('\n').slice(0,6).join('\n'));reportFailure(e,'daily workflow');process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

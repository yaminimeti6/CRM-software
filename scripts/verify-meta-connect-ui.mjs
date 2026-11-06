// Existing Admin/records only. Real read APIs; all business mutations blocked.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/meta-connect';
let db,admin,auth,browser,stage='configuration';const errors=[];
async function snapshot(){const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);return(await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();const before=await snapshot();
 const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select s.user_id,u.email from crm_private.bootstrap_state s join auth.users u on u.id=s.user_id join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner?.email);
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>cookies.splice(0,cookies.length,...values)}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));

 stage='Meta setup gate';mkdirSync(root,{recursive:true});
 await page.goto(base+'/app/meta');await page.getByRole('heading',{name:'Meta sign-in setup pending'}).waitFor();
 assert(await page.getByRole('button',{name:'Continue with Facebook',exact:true}).isDisabled());
 assert(!(await page.locator('.crm-content').innerText()).includes('META_APP_SECRET'));
 const response=await page.request.post(base+'/api/meta/start',{headers:{Origin:base}});
 assert.equal(response.status(),503);const body=await response.json();assert.equal(body.code,'META_SETUP_REQUIRED');assert(!JSON.stringify(body).includes('META_APP_'));
 await page.screenshot({path:root+'/meta-setup.png',mask:[page.locator('.crm-sidebar-workspace .crm-sidebar-text'),page.locator('.crm-profile-label')]});
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);
 console.log('PASS: browser setup-pending message; Facebook button disabled; no credential names in UI; authenticated start HTTP 503 META_SETUP_REQUIRED; public records/passwords unchanged; no new leads/users.');
}catch(e){console.error('Stage: '+stage);reportFailure(e,'Meta connect UX');process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

// Existing Admin/records only. Real read APIs; all business mutations blocked.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/meta-reference-linking';
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


 stage='actual empty references';mkdirSync(root,{recursive:true});await page.goto(base+'/app/meta');await page.getByText('Advanced: link Meta references to CRM attribution',{exact:true}).click();await page.getByText('No synced Meta references on this page',{exact:true}).waitFor();
 const form=page.locator('.meta-advanced-links form');assert(await form.locator('select[name=meta]').isDisabled());assert(await form.getByRole('button',{name:'Save prospective Meta link',exact:true}).isDisabled());
 await page.screenshot({path:root+'/empty.png',mask:[page.locator('.crm-profile-label'),page.locator('.crm-sidebar-workspace .crm-sidebar-text')]});
 stage='intercepted compatible reference fixture, never saved';let submitted;
 await page.route('**/api/meta/admin*',async route=>{
  if(route.request().method()==='POST'){submitted=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'Browser-only intercepted link; not saved.'}});}
  const response=await route.fetch(),data=await response.json();data.links={references:[{id:'manual-creative',kind:'creative',provider:'manual',name:'Browser-only manual'},{id:'meta-creative',kind:'creative',provider:'meta',name:'Browser-only creative',provider_account:'act_1'},{id:'meta-campaign',kind:'campaign',provider:'meta',name:'Browser-only campaign',provider_account:'act_1'}],total:3,links:[]};return route.fulfill({json:data});
 });
 await page.reload();await page.getByText('Advanced: link Meta references to CRM attribution',{exact:true}).click();await form.locator('select[name=manual]').selectOption('manual-creative');
 assert.equal(await form.locator('select[name=meta] option').count(),2);assert.equal(await form.locator('select[name=meta] option[value=meta-campaign]').count(),0);
 await form.locator('select[name=meta]').selectOption('meta-creative');const save=form.getByRole('button',{name:'Save prospective Meta link',exact:true});assert(await save.isDisabled());await form.locator('input[name=reviewed]').check();assert(await save.isEnabled());
 await form.locator('select[name=meta]').selectOption('');assert.equal(await form.locator('input[name=reviewed]').isChecked(),false);assert(await save.isDisabled());
 await form.locator('select[name=meta]').selectOption('meta-creative');await form.locator('input[name=reviewed]').check();await save.click();await page.getByRole('alert').filter({hasText:'Browser-only intercepted link'}).waitFor();assert.equal(submitted.operation,'link');assert.equal(submitted.manual,'manual-creative');assert.equal(submitted.meta,'meta-creative');assert.equal(submitted.reviewed,true);
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);
 console.log('PASS: actual empty-state explanation/disabled save; intercepted same-kind selection, explicit review/reset and correct link payload; no link saved; records/passwords unchanged.');
}catch(e){console.error('Stage: '+stage);reportFailure(e,'Meta connect UX');process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

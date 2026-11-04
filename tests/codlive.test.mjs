import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright-core';
import {migrate} from '../scripts/lib/bootstrap.mjs';
import {normalizeInquiry} from '../src/lib/ingestion-input.ts';
import {defaultLeadView} from '../src/lib/lead-view.ts';
test('CodLive browser copy -> existing normalizer/RPC -> All Leads; lost receipt replay does not repeat Sheet',{skip:!existsSync('.cache/codlive/index.html')?'Prepare the supplied ZIP with scripts/prepare-codlive.mjs first':false},async()=>{
 const pg=new PGlite(),db={query:async(s,p)=>p?pg.query(s,p):(await pg.exec(s)).at(-1)};let browser;
 try{
 await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);await migrate(db);
 const org=randomUUID(),admin=randomUUID();await db.query('insert into public.organizations(id,name) values($1,$2)',[org,'Synthetic CodLive']);await db.query('insert into auth.users values($1,$2,now())',[admin,'codlive@example.test']);await db.query('insert into public.staff_profiles(id,full_name)values($1,$2)',[admin,'Synthetic']);await db.query("insert into public.organization_memberships(user_id,organization_id,role)values($1,$2,'admin')",[admin,org]);
 const asAdmin=async()=>{await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.query('set role authenticated');};await asAdmin();await db.query('select public.save_ingestion_source(null,0,$1::jsonb)',[JSON.stringify({name:'COD test landing page',form_id:'codlive_test_v1',form_version:'codlive-v1',allowed_origins:['http://localhost:3106'],enabled:true})]);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});const page=await browser.newPage();let sheets=0,posts=0,firstId;const receipts=[];
 await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.origin!=='http://localhost:3106')return route.abort();
 if(u.pathname==='/mock-ip')return route.fulfill({json:{ip:'192.0.2.1'}});
 if(u.pathname==='/mock-sheet'){sheets++;assert.match(req.postData(),/Synthetic CodLive/);return route.fulfill({json:{result:'success'}});}
 if(u.pathname==='/api/public/lead-challenge')return route.fulfill({json:{challenge:'local-harness',min_wait_ms:1000}});
 if(u.pathname==='/api/public/leads'){
 const input=req.postDataJSON();firstId??=input.submission_id;assert.equal(input.submission_id,firstId);const n=normalizeInquiry(input);await db.query('reset role');await db.query('set role service_role');const receipt=(await db.query('select public.ingest_public_lead($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) r',[n.form_id,n.submission_id,u.origin,JSON.stringify(n.original),JSON.stringify(n.lead),JSON.stringify(n.metadata)])).rows[0].r;receipts.push(receipt);posts++;if(posts===1)return route.abort();return route.fulfill({json:{ok:true,...receipt}});
 }
 if(u.pathname==='/crm-adapter.js')return route.fulfill({contentType:'text/javascript',body:readFileSync('integrations/codlive/crm-adapter.js','utf8')});
 if(u.pathname==='/thankyou.html')return route.fulfill({body:'Synthetic success'});
 if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:readFileSync('.cache/codlive/index.html','utf8')});return route.abort();
 });
 page.on('dialog',d=>d.dismiss());await page.goto('http://localhost:3106/?utm_source=instagram&utm_medium=paid_social&utm_campaign=campaign-text&utm_content=content-text&fbclid=untrusted');
 await page.locator('#formCourse').evaluate(el=>{el.value='1 Month';});for(const[id,v]of Object.entries({fullName:'Synthetic CodLive',phone:'9000000000',address:'Synthetic address',landmark:'Synthetic landmark',pincode:'380001',city:'Ahmedabad'}))await page.locator('#'+id).fill(v);await page.locator('#state').selectOption({label:'Gujarat'});
 await page.locator('#submitBtn').click();await page.waitForFunction(()=>!document.querySelector('#submitBtn').disabled);await page.locator('#submitBtn').click();await page.waitForURL('**/thankyou.html');assert.equal(sheets,1);assert.equal(posts,2);assert.equal(receipts[0].replayed,false);assert.equal(receipts[1].replayed,true);
 await asAdmin();const result=(await db.query('select public.advanced_lead_search($1::jsonb,1) r',[JSON.stringify(defaultLeadView())])).rows[0].r;assert.equal(result.total,1);const lead=result.leads[0];assert.equal(lead.source_snapshot.name,'COD test landing page');assert.equal(lead.source_snapshot.reported_traffic_source,'instagram');assert.equal(lead.answers.course_name,'1 Month');assert.equal(lead.answers.course_price,'499');assert.equal(lead.answers.city,'Ahmedabad');assert.equal(lead.answers.pincode,'380001');assert.equal(lead.answers.state,'Gujarat');assert.equal(lead.mobile_no,'9000000000');assert.equal(lead.address,'Synthetic address');assert.equal(lead.answers.landmark,'Synthetic landmark');
 const meta=(await db.query('select * from public.lead_ingestion')).rows[0];assert.equal(meta.raw_advertising.AdCrevId,'campaign-text');assert.equal(meta.normalized_attribution.utm_campaign,'campaign-text');assert.equal(meta.normalized_attribution.source_creative_reference,undefined);
 await db.query('reset role');await db.query("update public.ingestion_sources set form_version='codlive-v1' where form_id='codlive_test_v1'");const n=normalizeInquiry({form_id:'codlive_test_v1',form_version:'codlive-v1',submission_id:randomUUID(),name:'Synthetic Unknown',mobile_no:'000123456789',answers:{FbClickId:'not-platform-proof'}});await db.query('set role service_role');await db.query('select public.ingest_public_lead($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)',[n.form_id,n.submission_id,'http://localhost:3106',JSON.stringify(n.original),JSON.stringify(n.lead),JSON.stringify(n.metadata)]);await db.query('reset role');assert.equal((await db.query("select source_snapshot->>'reported_traffic_source' s from public.lead_ingestion where submission_id=$1",[n.submission_id])).rows[0].s,'Unknown');
 }finally{await browser?.close();await pg.close();}
});

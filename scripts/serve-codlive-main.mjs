// Interactive ZIP form -> existing main Next API. Never submits an inquiry at startup.
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {configuration,clients,reportFailure} from './lib/operator.mjs';
import {sendPublicLead} from './send-public-lead.mjs';
import {defaultLeadView} from '../src/lib/lead-view.ts';

const local='http://localhost:3108',crm='http://localhost:3000',formId='codlive_local_browser_v1';
const sourceName='CodLive /Wife/ local browser',version='codlive-v1';
const root='.cache/codlive-interactive',statePath=root+'/private-state.json';
mkdirSync(root,{recursive:true});
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{sheet:[],receipts:{},verified:{}};
const persist=()=>writeFileSync(statePath,JSON.stringify(state,null,2));
const zip=process.argv[2]??'../CodLive.zip';
const files=['index.html','logoNww.avif','SlimoMaine.webp','UseSlimo.webp','thankyou.css','HealthSafety.html','ClaimMarketing.html'];
const assets=new Map(files.map(file=>[file,execFileSync('tar',['-xOf',zip,'CodLive/'+file],{maxBuffer:3000000})]));
const original=assets.get('index.html').toString('utf8');
const zipHash=createHash('sha256').update(original).digest('hex');
assert.equal(zipHash,'fb7cafae284472cf3def3c0c8ca3d4c76ba5fb24b96fe2e4fbe4293c23d14c4d','Unexpected ZIP page; review before connecting.');
assert.equal(original.split('      submitOrderToSheet(payload)').length,2);
let html=original.replace('      submitOrderToSheet(payload)','      submitCodLiveOrder(payload, submitOrderToSheet)');
html=html.replace(/const scriptURL = "[^"]+";/,'const scriptURL = "/mock-sheet";').replace('https://api.ipify.org?format=json','/mock-ip');
const setup=`<script src="/local-observer.js" data-crm-base="${crm}" data-form-id="${formId}"></script><script src="/crm-adapter.js"></script><script>const submitCodLiveOrder=createCodLiveCRM({base:'${crm}',formId:'${formId}',version:'${version}'});</script>`;
html=html.replace(/(<script>\s*const orderForm)/,setup+'$1');
assert(html.includes(setup));assert(!html.includes('https://script.google.com/macros/'));assert(!html.includes('https://api.ipify.org'));
html=html.replace('<body>','<body><aside style="padding:14px;background:#fff3cd;color:#222">Local form → main CRM localhost:3000. Sheet is a local mock. Only your own submitted orders are saved. <a href="http://localhost:3000/app" target="_blank" rel="noreferrer">Open main All Leads</a></aside>');

const observer=readFileSync('integrations/codlive/local-observer.js','utf8');
const diagnostics=[];
const thanks=`<!doctype html><meta charset="utf-8"><title>Local order verification</title><h1>Your order: main CRM and mock Sheet</h1><p id="message">Checking your submission…</p><a id="crm" href="${crm}/app" target="_blank" rel="noreferrer">Open this order in main All Leads</a><p><a href="/Wife/">Return to original order form</a></p><pre id="result" style="white-space:pre-wrap"></pre><script>const id=sessionStorage.getItem('codlive-local-last-id');if(!id){document.getElementById('message').textContent='No order submitted in this tab.';}else{fetch('/verification?submission_id='+encodeURIComponent(id)).then(async r=>{const d=await r.json();document.getElementById('message').textContent=d.verified?'Verified: main CRM saved once, matching mock Sheet row, same-ID retry created no duplicate.':'Verification pending or incomplete; keep this tab and reconcile before a new inquiry.';document.getElementById('result').textContent=JSON.stringify(d,null,2);if(d.crm_row_url)document.getElementById('crm').href=d.crm_row_url;}).catch(()=>document.getElementById('message').textContent='Verification unavailable. Keep this tab and retry checking later.');}</script>`;
let db,owner,sourceId,server;
const jobs=new Map();
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function verify(id){
 if(jobs.has(id))return jobs.get(id);
 const work=(async()=>{
  const entry=state.receipts[id];if(!entry)return {verified:false,reason:'CRM acknowledgment not observed yet.'};
  const rows=(await db.query('select lead_id,original_submission,original_answers from public.lead_ingestion where source_id=$1 and submission_id=$2',[sourceId,id])).rows;
  assert.equal(rows.length,1);assert.deepEqual(rows[0].original_submission,entry.inquiry);
  const sheet=state.sheet.filter(r=>r.submission_id===id);if(sheet.length!==1)return {verified:false,reason:'Expected exactly one mock Sheet row; inspect before retrying.',mock_sheet_rows:sheet.length};
  const answers=rows[0].original_answers;
  for(const[key,value]of Object.entries({name:entry.inquiry.name,mobile_no:entry.inquiry.mobile_no,address:entry.inquiry.address,...answers})){
   if(Object.hasOwn(sheet[0].fields,key))assert.equal(String(sheet[0].fields[key]),String(value),'Mock Sheet mismatch: '+key);
  }
  const retry=await sendPublicLead({base:crm,origin:local,inquiry:entry.inquiry});
  assert.equal(retry.status,200);assert.equal(retry.body.replayed,true);
  assert.equal((await db.query('select count(*)::int n from public.lead_ingestion where source_id=$1 and submission_id=$2',[sourceId,id])).rows[0].n,1);
  await db.query('begin');let result;
  try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.user_id]);await db.query('set local role authenticated');result=(await db.query('select public.advanced_lead_search($1::jsonb,1) r',[JSON.stringify({...defaultLeadView(),sources:[sourceId],q:entry.inquiry.name})])).rows[0].r;await db.query('commit');}catch(e){await db.query('rollback');throw e;}
  const lead=result.leads.find(l=>l.id===rows[0].lead_id);assert(lead,'Saved lead missing from authorized main All Leads query');
  assert.equal(lead.order_details.submission_id,id);assert.equal(lead.order_details.landing_page,sourceName);assert.equal(lead.order_details.website,'localhost');assert.equal(lead.order_details.course,answers.course_name);assert.equal(lead.order_details.price,String(answers.course_price));
  const expectedTraffic=answers.campId?.trim()||'Unknown';assert.equal(lead.order_details.traffic_source,expectedTraffic);
  assert.deepEqual(lead.order_details.answers,answers);
  const verified={verified:true,submission_id:id,lead_id:lead.id,website:lead.order_details.website,landing_page:lead.order_details.landing_page,traffic_source:lead.order_details.traffic_source,course:lead.order_details.course,price:lead.order_details.price,dynamic_answers:answers,crm_lead_count:1,mock_sheet_rows:sheet.length,mock_sheet_matches:true,initial_status:entry.status,retry_status:retry.status,replayed:true,all_leads_query_verified:true,crm_row_url:crm+'/app?q='+encodeURIComponent(entry.inquiry.name),verified_at:new Date().toISOString()};
  state.verified[id]=verified;persist();return verified;
 })();jobs.set(id,work);try{return await work;}finally{jobs.delete(id);}
}
try{
 const config=configuration();({db}=clients(config));await db.connect();
 assert.equal((await fetch(crm+'/login',{signal:AbortSignal.timeout(10000)})).status,200,'Main CRM is not running');
 owner=(await db.query("select s.user_id,m.organization_id from crm_private.bootstrap_state s join public.organization_memberships m on m.user_id=s.user_id where s.completed_at is not null and m.active and m.role='admin'")).rows[0];assert(owner);
 const existing=(await db.query('select * from public.ingestion_sources where form_id=$1',[formId])).rows[0];
 if(existing){assert.equal(existing.name,sourceName);assert.equal(existing.form_version,version);assert.equal(existing.organization_id,owner.organization_id);assert.equal(existing.created_by,owner.user_id);assert.deepEqual(existing.allowed_origins,[local]);sourceId=existing.id;}
 await db.query('begin');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.user_id]);await db.query('set local role authenticated');
 sourceId=(await db.query('select public.save_ingestion_source($1,$2,$3::jsonb) id',[sourceId??null,existing?.revision??0,JSON.stringify({name:sourceName,form_id:formId,form_version:version,allowed_origins:[local],enabled:true})])).rows[0].id;await db.query('commit');
 const send=(res,data,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${crm}; font-src 'self' data:; form-action 'self'; base-uri 'self'; frame-ancestors 'none'`});res.end(type==='application/json'?JSON.stringify(data):data);};
 server=createServer(async(req,res)=>{try{
  if(req.headers.host!=='localhost:3108')return send(res,{error:'Local hostname required'},403);
  const url=new URL(req.url,local);
  if(req.method==='POST'){
   if(req.headers.origin!==local)return send(res,{error:'Local origin required'},403);
   const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>64000)return send(res,{error:'Body too large'},413);chunks.push(chunk);}const raw=Buffer.concat(chunks);
   if(url.pathname==='/local-diagnostics'){
    const d=JSON.parse(raw.toString('utf8'));if(!['validation_blocked','submit_started','javascript_error','network_error','http_error','observer_error'].includes(d.stage))return send(res,{error:'Invalid stage'},400);
    diagnostics.push({stage:d.stage,at:new Date().toISOString(),...(Number.isInteger(d.status)?{status:d.status}:{}),...(Array.isArray(d.invalid_fields)?{invalid_fields:d.invalid_fields.filter(k=>['fullName','phone','address','landmark','state','pincode','city','course'].includes(k))}:{})});if(diagnostics.length>20)diagnostics.shift();return send(res,{recorded:true});
   }
   if(url.pathname==='/mock-sheet'){
    const id=req.headers['x-local-submission-id'];if(!uuid(id))return send(res,{error:'Submission ID required'},400);
    const form=await new Request(local,{method:'POST',headers:{'Content-Type':req.headers['content-type']??''},body:raw}).formData();
    state.sheet.push({submission_id:id,received_at:new Date().toISOString(),fields:Object.fromEntries(form.entries())});persist();return send(res,{result:'success'});
   }
   if(url.pathname==='/local-receipt'){
    const data=JSON.parse(raw.toString('utf8'));if(data.inquiry?.form_id!==formId||!uuid(data.inquiry.submission_id)||data.receipt?.submission_id!==data.inquiry.submission_id||data.receipt?.accepted!==true)return send(res,{error:'Invalid receipt'},400);
    const id=data.inquiry.submission_id;state.receipts[id]={inquiry:data.inquiry,receipt:data.receipt,status:data.receipt.replayed?200:201};persist();return send(res,{observed:true});
   }
   return send(res,{error:'Not available'},404);
  }
  if(req.method!=='GET')return send(res,{error:'Method unavailable'},405);
  if(url.pathname==='/verification'){
   const id=url.searchParams.get('submission_id');if(!uuid(id))return send(res,{error:'Submission UUID required'},400);
   return send(res,state.verified[id]??await verify(id));
  }
  if(url.pathname==='/local-status')return send(res,{ready:true,main_crm:crm,form_url:local+'/Wife/',form_id:formId,source_name:sourceName,zip_sha256:zipHash,sheet_mode:'local mock only',observed_crm_receipts:Object.keys(state.receipts).length,mock_sheet_rows:state.sheet.length,verified_submissions:Object.keys(state.verified).length,diagnostics});
  if(url.pathname==='/mock-ip')return send(res,{ip:''});
  if(url.pathname==='/local-observer.js')return send(res,observer,200,'text/javascript');
  if(url.pathname==='/crm-adapter.js')return send(res,readFileSync('integrations/codlive/crm-adapter.js','utf8'),200,'text/javascript');
  if(url.pathname==='/Wife/'||url.pathname==='/')return send(res,html,200,'text/html');
  if(url.pathname==='/Wife/thankyou.html')return send(res,thanks,200,'text/html');
  const file=url.pathname.replace(/^\/Wife\//,'');
  if(assets.has(file)&&file!=='index.html'){const ext=file.split('.').pop();const type={webp:'image/webp',avif:'image/avif',css:'text/css',html:'text/html'}[ext];return send(res,assets.get(file),200,type);}
  return send(res,{error:'Not found'},404);
 }catch{console.error('Local verification request failed; private values withheld.');if(!res.headersSent)send(res,{verified:false,error:'Verification incomplete. Preserve this tab and inspect local logs.'},500);else res.end();}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3108,'localhost',ok);});
 console.log('READY '+local+'/Wife/ -> '+crm+' ; mock Sheet only; no startup inquiry submitted.');
 const stop=async()=>{server.close();await db.end();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}catch(e){await db?.query('rollback').catch(()=>{});reportFailure(e,'interactive CodLive main connection');await db?.end();process.exitCode=1;}

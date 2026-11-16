import {chooseTheme} from './lib/ui-appearance.mjs';
// Main CRM browser verification using an existing record and existing operational identity.
// No lead/user fixtures. All business writes are intercepted; only read APIs reach CRM.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
const base='http://localhost:3000',root='.cache/visible-crm-demo';
let db,admin,auth,browser,stage='configuration';const writes=[],errors=[];
async function snapshot(){
 const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
 return (await db.query(tables.map(table=>`select '${table}' table_name,count(*)::int n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) h from public."${table}" t`).join(' union all '))).rows;
}
try{
 const config=configuration();({db,admin}=clients(config));await db.connect();
 const before=await snapshot();const passwords=(await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows;
 const owner=(await db.query("select m.user_id,u.email,m.role from public.organization_memberships m join auth.users u on u.id=m.user_id join crm_private.bootstrap_state b on exists(select 1 from public.organization_memberships bm where bm.user_id=b.user_id and bm.organization_id=m.organization_id) where m.active and m.role in ('telecaller','admin') and b.completed_at is not null order by case when m.role='telecaller' then 0 else 1 end,m.user_id limit 1")).rows[0];assert(owner?.email);
 const lead=(await db.query('select l.id,l.name,l.status_id,i.source_id from public.leads l join public.lead_ingestion i on i.lead_id=l.id where i.submission_id=$1',['6875bfac-874e-4784-ab30-41807442951d'])).rows[0];assert(lead,'Existing retained API example is required; do not create a replacement.');
 stage='temporary local session for existing operational staff';
 const generated=await admin.auth.admin.generateLink({type:'magiclink',email:owner.email});assert.ifError(generated.error);assert.equal(generated.data.user.id,owner.user_id);
 const cookies=[];auth=createServerClient(projectUrl,config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>{cookies.splice(0,cookies.length,...values);}}});
 const signed=await auth.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});assert.ifError(signed.error);assert.equal(signed.data.user.id,owner.user_id);
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:process.argv.includes('--verify'),args:process.argv.includes('--verify')?[]:['--start-maximized']});
 const context=await browser.newContext({viewport:process.argv.includes('--verify')?{width:1440,height:820}:null});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.dismiss());
 let simulateSuccess=true;let callRequests=[],callbackRequests=[],patches=[],releaseCall;
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['POST','PATCH','DELETE','PUT'].includes(request.method())&&url.origin===base&&url.pathname!=='/api/leads/search'){
   let body;try{body=request.postDataJSON();}catch{return route.abort();}writes.push(url.pathname);
   if(url.pathname.endsWith('/calls')){callRequests.push(body);if(simulateSuccess)return route.fulfill({status:201,json:{replayed:false}});return route.fulfill({status:503,json:{error:'Browser-only intercepted uncertain call; no write reached the server.'}});}
   if(url.pathname==='/api/follow-ups'){callbackRequests.push(body);return route.fulfill({status:503,json:{error:'Browser-only intercepted callback; no write reached the server.'}});}
   if(request.method()==='PATCH'&&url.pathname==='/api/leads/'+lead.id){patches.push(body);return route.fulfill({status:409,json:{error:'Browser-only intercepted stale edit. Reload latest before saving.'}});}
   return route.abort();
  }
  return route.continue();
 });


 const verify=process.argv.includes('--verify');let next;
 await page.exposeFunction('crmDemoNext',()=>{next?.();next=null;});
 async function checkpoint(number,title,description,label='Next step'){
  console.log('Demo step '+number+': '+title);
  await page.evaluate(({number,title,description,label})=>{
   document.getElementById('crm-guided-demo')?.remove();
   const box=document.createElement('aside');box.id='crm-guided-demo';box.setAttribute('aria-label','Guided CRM demo');
   Object.assign(box.style,{position:'fixed',left:'12px',bottom:'12px',width:'320px',maxWidth:'calc(100vw - 24px)',zIndex:'2147483647',background:'#fff',color:'#202328',border:'2px solid #3568cf',borderRadius:'8px',padding:'16px',boxShadow:'0 6px 30px #0003',font:'14px Segoe UI,Arial,sans-serif'});
   const badge=document.createElement('strong');badge.textContent='DEMO ONLY - no real saves';badge.style.color='#9a3412';
   const heading=document.createElement('h3');heading.textContent=number+'/5 - '+title;heading.style.margin='10px 0';
   const text=document.createElement('p');text.textContent=description;text.style.lineHeight='1.5';
   const button=document.createElement('button');button.textContent=label;Object.assign(button.style,{background:'#3568cf',color:'#fff',border:'0',borderRadius:'5px',padding:'10px 14px',cursor:'pointer'});
   button.onclick=()=>{button.disabled=true;window.crmDemoNext();};box.append(badge,heading,text,button);document.body.append(box);
  },{number,title,description,label});
  if(!verify)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{next=null;reject(Error('Demo timed out waiting for Next.'));},15*60*1000);next=()=>{clearTimeout(timer);resolve();};});
 }
 stage='visible list';await page.goto(base+'/app?q='+encodeURIComponent(lead.name));const row=page.locator('tr[data-lead-id="'+lead.id+'"]');await row.waitFor();
 await checkpoint(1,'All Leads','Each row is one inquiry. Search finds an existing lead. This demonstration uses the retained example; it creates no new order.');
 stage='order overview';await row.getByRole('button',{name:'Open lead '+lead.name,exact:true}).click();const drawer=page.getByRole('dialog',{name:lead.name,exact:true});await drawer.waitFor();
 await checkpoint(2,'Read the order','Check the customer, address, course and price. Recent activity and the next follow-up are beside them. Answers contains the form responses.');
 stage='prepare practice result';await drawer.getByRole('button',{name:'Open call form',exact:true}).click();const result=drawer.getByLabel('Call outcome',{exact:true});await result.waitFor();
 const options=await result.locator('option').evaluateAll(items=>items.map(o=>({value:o.value,label:o.textContent})));const retry=options.find(o=>o.label?.trim().toLowerCase()==='retry')??options.find(o=>o.value===lead.status_id);assert(retry);await result.selectOption(retry.value);
 await drawer.getByLabel('Call notes (optional)',{exact:true}).fill('DEMO ONLY - no actual call. Practice follow-up.');await drawer.getByLabel('Call again later',{exact:true}).check();
 const tomorrow=new Date(Date.now()+86400000),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(tomorrow);const part=t=>parts.find(p=>p.type===t).value;
 await drawer.locator('input[type="datetime-local"]').fill(part('year')+'-'+part('month')+'-'+part('day')+'T10:00');await drawer.getByRole('button',{name:'Save call result',exact:true}).scrollIntoViewIfNeeded();
 await checkpoint(3,'Result and next call','After a real phone call, choose its result and add notes. Call again later sets the next-call date in IST. Here the save will be intercepted, so no real call is counted.','Simulate save');
 stage='simulated save';await drawer.getByRole('button',{name:'Save call result',exact:true}).click();await drawer.getByRole('button',{name:'Call recorded',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="Close lead details"]')?.disabled);assert.equal(callRequests.length,1);assert(callRequests[0].follow_up);
 await checkpoint(4,'Save feedback','The success message is simulated. No call or follow-up reached the server. In normal use, Save call result records one real attempt; retrying that request does not add another.','Back to leads');
 stage='existing follow-ups';await page.getByRole('button',{name:'Close lead details',exact:true}).click();await drawer.waitFor({state:'hidden'});await page.getByRole('navigation',{name:'Choose your calling work'}).getByRole('link',{name:"Today's follow-ups",exact:true}).click();await page.getByLabel('Follow-up filter',{exact:true}).waitFor();
 await checkpoint(5,'Follow-ups','This is the real existing follow-up list. The practice follow-up is absent because nothing was saved. Daily work: open order, phone customer, save result and next date, then use this list.','Finish demo');
 stage='preservation';assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(errors,[]);
 console.log('PASS: five-step '+(verify?'headless rehearsal':'visible demo')+'; only one intercepted simulated call; no real call/follow-up/lead; public records and passwords unchanged.');
}catch(e){console.error('Stage: '+stage);reportFailure(e,'guided local demo');process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

import {chooseTheme} from './lib/ui-appearance.mjs';
// Existing Admin/records only. Real read APIs; all business mutations blocked.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServerClient} from '@supabase/ssr';
import {configuration,clients,projectUrl,reportFailure} from './lib/operator.mjs';
import {crmNavigation} from '../src/lib/crm-navigation.ts';
const base='http://localhost:3000',root='.cache/full-crm-tour';
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
 browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:process.argv.includes('--verify'),args:process.argv.includes('--verify')?[]:['--start-maximized']});
 const context=await browser.newContext({viewport:process.argv.includes('--verify')?{width:1440,height:900}:null});await context.addCookies(cookies.map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax',httpOnly:false,secure:false})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(r.isNavigationRequest()&&u.origin!==base)return route.abort();if(u.origin===base&&u.pathname.startsWith('/api/meta/')&&!['/api/meta/admin','/api/meta/spend'].includes(u.pathname))return route.abort();if(u.origin===base&&['POST','PATCH','PUT','DELETE'].includes(r.method())&&!readPosts.has(u.pathname)){blockedWrites.push(u.pathname);return route.abort();}return route.continue();});
 const verify=process.argv.includes('--verify');let next;
 await page.exposeFunction('crmDemoNext',()=>{next?.();next=null;});
 async function checkpoint(number,title,description,label='Next step'){
  console.log('Demo step '+number+': '+title);
  await page.evaluate(({number,title,description,label})=>{
   document.getElementById('crm-guided-demo')?.remove();
   const box=document.createElement('aside');box.id='crm-guided-demo';box.setAttribute('aria-label','Guided CRM demo');
   Object.assign(box.style,{position:'fixed',left:'12px',bottom:'12px',width:'320px',maxWidth:'calc(100vw - 24px)',zIndex:'2147483647',background:'#fff',color:'#202328',border:'2px solid #3568cf',borderRadius:'8px',padding:'16px',boxShadow:'0 6px 30px #0003',font:'14px Segoe UI,Arial,sans-serif'});
   const badge=document.createElement('strong');badge.textContent='READ-ONLY ADMIN TOUR - no changes';badge.style.color='#9a3412';
   const heading=document.createElement('h3');heading.textContent=number+'/13 - '+title;heading.style.margin='10px 0';
   const text=document.createElement('p');text.textContent=description;text.style.lineHeight='1.5';
   const button=document.createElement('button');button.textContent=label;Object.assign(button.style,{background:'#3568cf',color:'#fff',border:'0',borderRadius:'5px',padding:'10px 14px',cursor:'pointer'});
   button.onclick=()=>{button.disabled=true;window.crmDemoNext();};box.append(badge,heading,text,button);document.body.append(box);
  },{number,title,description,label});
  if(!verify)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{next=null;reject(Error('Demo timed out waiting for Next.'));},15*60*1000);next=()=>{clearTimeout(timer);resolve();};});
 }

 async function visit(path,api){stage=path;const ready=page.waitForResponse(r=>new URL(r.url()).pathname===api&&r.status()===200&&(api!=='/api/follow-ups'||new URL(r.url()).searchParams.has('view')));await page.goto(base+path);await ready;}
 await visit('/app?q='+encodeURIComponent(example.name),'/api/leads/search');await page.getByRole('button',{name:'More tools',exact:true}).click();
 await checkpoint(1,'Leads, filters and columns','One row is one inquiry. Search/status/date/source filters narrow the list. Table columns and widths changes your view. CSV/Excel export is available to Admin; this read-only tour will not run exports.');
 const row=page.locator('tbody tr').filter({hasText:example.name});await row.getByRole('button',{name:'Open lead '+example.name,exact:true}).click();let drawer=page.getByRole('dialog',{name:example.name,exact:true});
 await drawer.getByRole('tab',{name:'Source',exact:true}).click();
 await checkpoint(2,'Website and advertising source','Website, landing page and reported traffic are separate. Campaign/ad IDs appear only when supplied. Missing tracking is Unknown; this does not independently verify an advertising claim. Answers shows the submitted customer responses.');
 await drawer.getByRole('tab',{name:'History',exact:true}).click();
 await checkpoint(3,'History and changes','History shows the recorded changes to this lead. Calls contains actual call attempts and confirmations. Opening these tabs does not count a call.');
 await page.getByRole('button',{name:'Close lead details',exact:true}).click();
 await visit('/app/follow-ups?view=due_today','/api/follow-ups');
 await checkpoint(4,'Follow-ups','Choose Due Today, Overdue or Upcoming. My Follow-ups narrows the existing shared list. Manage follow-up changes its date/state; completing a follow-up is different from recording a call. We will not save anything.');
 await visit('/app/performance','/api/performance');
 await checkpoint(5,'Performance and charts','See leads, call attempts, confirmations, follow-ups and activity charts. Date filters change the period; More report filters narrows the report. Telecallers receive their permitted self-only performance, while Admin/Manager have broader reports.');
 await visit('/app/attribution','/api/ad-attribution/report');
 await checkpoint(6,'Attribution','Compare the available source, landing-page, campaign and creative information. Unknown is kept when tracking is absent. Reliable live advertising comparisons still depend on actual website capture and provider data.');
 await visit('/app/meta-spend','/api/meta/spend');
 await checkpoint(7,'Meta spend report','This page compares available imported Meta spend data. An empty report does not mean spending was zero. Actual Meta login/account selection and verified sync are separate pending setup, not completed by this tour.');
 await visit('/app/team','/api/team');await page.getByText('Invite staff',{exact:true}).click();
 await checkpoint(8,'Team and staff invitations','Admin manages staff roles and active access here. Invite staff prepares a one-use invitation. This tour will not create/send an invitation, change a role or reset a password. Staff do not see all Admin pages.');
 await visit('/app/ingestion','/api/ingestion-sources');
 await checkpoint(9,'Lead sources','Admin configures which website forms may send inquiries and their allowed origins. The existing lead API receives submissions. Live Wife-to-CRM and the real Sheet acceptance remain pending; the local demo does not prove live capture.');
 await visit('/app/catalog','/api/catalog');
 await checkpoint(10,'Products, brands and landing pages','Organize your brands/products, landing-page references and form versions. These settings help identify an order source. Existing leads preserve their saved source snapshot when configuration later changes. No setting is saved here.');
 await visit('/app/imports','/api/imports');
 await checkpoint(11,'Imports','Admin can preview/map a historical file before importing. Historical claims are separate from observed CRM call attempts. This tour uploads no customer file and creates no imported record.');
 await visit('/app/meta','/api/meta/admin');
 await checkpoint(12,'Meta connection settings','This is the one-time provider connection/account setup page. We will not start Facebook authorization or sync. Missing credentials, permissions or App Review must be resolved separately before claiming live Meta works.');
 await visit('/app/settings','/api/workspace-settings');
 await checkpoint(13,'Workspace settings and recap','Admin controls status labels/categories and default table columns here. Changes affect the organization; personal views can differ. Daily staff mainly use Leads, Calls and Follow-ups. This tour has only read existing data.','Finish tour');
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await db.query("select id,md5(coalesce(encrypted_password,'')||coalesce(email,'')) h from auth.users order by id")).rows,passwords);assert.deepEqual(blockedWrites,[]);assert.deepEqual(errors,[]);
 console.log('PASS: 13-step '+(verify?'headless rehearsal':'visible full CRM tour')+'; real read APIs; no business write attempts; all public records and passwords unchanged.');
}catch(e){console.error('Stage: '+stage);reportFailure(e,'full read-only CRM tour');process.exitCode=1;}
finally{await browser?.close();if(auth)await auth.auth.signOut({scope:'local'});await db?.end();}

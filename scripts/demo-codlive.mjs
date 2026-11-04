// Loopback-only Step 6B demonstration. No operator env, Supabase or external Sheet access.
import {createServer} from 'node:http';
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from './lib/bootstrap.mjs';
import {normalizeInquiry} from '../src/lib/ingestion-input.ts';
import {validateLeadView} from '../src/lib/lead-view.ts';
const require=createRequire(import.meta.url),base='http://localhost:3106',root=resolve('.cache/codlive-demo');
mkdirSync(root,{recursive:true});
readFileSync('.cache/codlive/index.html'); // Run prepare-codlive first; never fall back to the live ZIP.
writeFileSync(root+'/loader.cjs',`module.exports=function(source){const done=this.async(),swc=require('next/dist/build/swc');swc.loadBindings().then(()=>swc.transform(source,{filename:this.resourcePath,jsc:{parser:{syntax:'typescript',tsx:this.resourcePath.endsWith('.tsx')},transform:{react:{runtime:'automatic'}},target:'es2020'},module:{type:'es6'}})).then(r=>done(null,r.code),done);};`);
writeFileSync(root+'/entry.tsx',`import React from 'react';import {createRoot} from 'react-dom/client';import {Leads} from '../../src/app/app/leads';createRoot(document.getElementById('root')).render(<Leads/>);`);
await new Promise((ok,fail)=>require('next/dist/compiled/webpack/webpack').webpack({mode:'development',devtool:false,entry:root+'/entry.tsx',output:{path:root,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':resolve('src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:root+'/loader.cjs'}]}},(e,s)=>e||s.hasErrors()?fail(e||Error(s.toString({all:false,errors:true}))):ok()));
const pg=new PGlite(),db={query:async(s,p)=>p?pg.query(s,p):(await pg.exec(s)).at(-1)};
await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
await migrate(db);
const org=randomUUID(),admin=randomUUID();
await db.query('insert into public.organizations(id,name)values($1,$2)',[org,'Local CodLive demo only']);
await db.query('insert into auth.users values($1,$2,now())',[admin,'synthetic@example.test']);
await db.query('insert into public.staff_profiles(id,full_name)values($1,$2)',[admin,'Local synthetic Admin']);
await db.query("insert into public.organization_memberships(user_id,organization_id,role)values($1,$2,'admin')",[admin,org]);
async function role(name){await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[name==='authenticated'?admin:'']);await db.query('set role '+name);}
await role('authenticated');await db.query('select public.save_ingestion_source(null,0,$1::jsonb)',[JSON.stringify({name:'COD test landing page',form_id:'codlive_test_v1',form_version:'codlive-v1',allowed_origins:[base],enabled:true})]);
const secret=randomUUID(),signed=data=>createHmac('sha256',secret).update(data).digest('hex');let sheetPosts=0,crmPosts=0,retries=0,queue=Promise.resolve();
const banner=`<nav style="padding:18px;background:#fff3cd;border:2px solid #b8860b"><b>LOCAL TEST ONLY � isolated database, mocked Sheet, synthetic data</b><br/><a href="/?utm_source=instagram&utm_medium=paid_social&utm_campaign=synthetic-campaign&utm_content=synthetic-content">Open COD test page</a> � <a href="/app">All Leads</a> � <a href="/demo-evidence">Test receipts</a></nav>`;
const server=createServer((req,res)=>{
 queue=queue.then(async()=>{
 const url=new URL(req.url,base);if(!['localhost:3106','127.0.0.1:3106'].includes(req.headers.host)){res.writeHead(403).end();return;}
 const send=(data,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type.startsWith('text/')?type+'; charset=utf-8':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; form-action 'self'; base-uri 'self'"});res.end(type==='application/json'?JSON.stringify(data):data);};
 let text='';for await(const chunk of req){text+=chunk;if(text.length>32000)return send({error:'Too large'},413);}
 const scalar=async(sql,params)=>(await db.query(sql,params)).rows[0].r;
 if(url.pathname==='/api/public/lead-challenge'){const data=Date.now()+':'+randomUUID();return send({challenge:data+'.'+signed(data),min_wait_ms:1000});}
 if(url.pathname==='/api/public/leads'&&req.method==='POST'){
 if(req.headers.origin!==base)return send({error:'Local origin required'},403);
 const input=JSON.parse(text),parts=String(input.challenge).split('.'),age=Date.now()-Number(parts[0].split(':')[0]);
 if(parts.length!==2||parts[1].length!==64||!timingSafeEqual(Buffer.from(parts[1]),Buffer.from(signed(parts[0])))||age<1000||age>600000)return send({error:'Local test challenge invalid'},400);
 const n=normalizeInquiry(input);await role('service_role');const r=await scalar('select public.ingest_public_lead($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) r',[n.form_id,n.submission_id,base,JSON.stringify(n.original),JSON.stringify(n.lead),JSON.stringify(n.metadata)]);crmPosts++;if(r.replayed)retries++;return send({ok:true,...r},r.replayed?200:201);
 }
 if(url.pathname==='/mock-sheet'&&req.method==='POST'){sheetPosts++;return send({result:'success'});}
 if(url.pathname==='/mock-ip')return send({ip:'192.0.2.1'});
 if(url.pathname==='/demo-evidence')return send({localOnly:true,isolatedDatabase:true,sheetEndpoint:'mock-sheet',sheetPosts,crmPosts,retries});
 if(url.pathname==='/api/leads/search'&&req.method==='POST'){await role('authenticated');const input=JSON.parse(text),d=validateLeadView(input.definition);const r=await scalar('select public.advanced_lead_search($1, $2) r',[JSON.stringify(d),input.page]);return send({...r,page:input.page,size:d.size});}
 if(url.pathname==='/api/leads/options'){await role('authenticated');return send(await scalar('select public.lead_filter_options() r'));}
 if(url.pathname==='/api/lead-views')return send({views:[]});
 if(url.pathname==='/api/calling')return send([]);
 if(url.pathname==='/api/leads/events')return send('event: unavailable\ndata: {}\n\n',200,'text/event-stream');
 // All staff mutation routes are deliberately absent in this local viewing harness.
 if(url.pathname.startsWith('/api/'))return send({error:'Not available in local read-only CRM demo'},405);
 if(url.pathname==='/app')return send('<!doctype html><title>Local test � All Leads</title><link rel="stylesheet" href="/style.css">'+banner+'<main><div id="root"></div></main><script src="/bundle.js"></script>',200,'text/html');
 if(url.pathname==='/bundle.js')return send(readFileSync(root+'/bundle.js'),200,'text/javascript');
 if(url.pathname==='/style.css')return send(readFileSync('src/app/style.css'),200,'text/css');
 if(url.pathname==='/crm-adapter.js')return send(readFileSync('integrations/codlive/crm-adapter.js'),200,'text/javascript');
 if(url.pathname==='/thankyou.html')return send('<!doctype html><title>Local test order received</title>'+banner+'<h1>Synthetic order received by CRM and mock Sheet</h1><p>Open All Leads above to view the test order.</p>',200,'text/html');
 if(url.pathname==='/')return send(readFileSync('.cache/codlive/index.html','utf8').replace('<body>','<body>'+banner),200,'text/html');
 return send('',404,'text/plain');
 }).catch(e=>{console.error('Local demo request failed:',e.message);if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Local test request failed'}));});
});
server.listen(3106,'127.0.0.1',()=>console.log('LOCAL_ONLY_DEMO_READY '+base+' ; All Leads '+base+'/app'));

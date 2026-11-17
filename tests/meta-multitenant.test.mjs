import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../scripts/lib/bootstrap.mjs';
import {digest,seal,GraphReadClient,dateWindow} from '../src/server/meta/core.ts';
import {workerStep} from '../src/server/meta/worker.ts';

test('two companies authorize, select the same account ID and sync independently; disconnect cannot affect the other company',async()=>{
 const pg=new PGlite(),db={query:async(s,p)=>p?pg.query(s,p):(await pg.exec(s)).at(-1)};
 try{
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
  await migrate(db);
  const config={appId:'123',appSecret:'synthetic-only',key:'ab'.repeat(32),version:'v26.0',origin:'http://localhost:3000'};
  const companies=[{org:randomUUID(),admin:randomUUID(),token:'SYNTHETIC_COMPANY_A',spend:'1.00'},{org:randomUUID(),admin:randomUUID(),token:'SYNTHETIC_COMPANY_B',spend:'9.00'}];
  const root=()=>db.query('reset role');
  async function as(id){await root();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.query('set role authenticated');}
  async function rpc(name,args=[]){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0].r;}
  for(const [i,c] of companies.entries()){
   await root();await db.query('insert into public.organizations(id,name) values($1,$2)',[c.org,'Isolated company '+i]);await db.query('insert into auth.users values($1,$2,now())',[c.admin,c.admin+'@example.test']);await db.query('insert into public.staff_profiles(id,full_name)values($1,$2)',[c.admin,'Isolated Admin '+i]);await db.query("insert into public.organization_memberships(user_id,organization_id,role)values($1,$2,'admin')",[c.admin,c.org]);
  }
  for(const [i,c] of companies.entries()){
   const hash=digest(randomUUID()),session=digest(randomUUID());await as(c.admin);await rpc('crm_meta_admin',['oauth_begin',{hash,session_hash:session}]);
   await as(companies[1-i].admin);await assert.rejects(rpc('crm_meta_admin',['oauth_consume',{hash,session_hash:session}]));
   await as(c.admin);await rpc('crm_meta_admin',['oauth_consume',{hash,session_hash:session}]);await assert.rejects(rpc('crm_meta_admin',['oauth_consume',{hash,session_hash:session}]));
   await root();const account={id:'act_1',name:'Private account '+i,currency:'INR',timezone:'UTC'};
   await rpc('crm_meta_service',[c.org,c.admin,'store',{state_hash:hash,ciphertext:seal(c.token,config.key,c.org),expires_at:new Date(Date.now()+3600000).toISOString(),accounts:[account]}]);
   const vault=await rpc('crm_meta_service',[c.org,c.admin,'read']);await rpc('crm_meta_service',[c.org,c.admin,'select',{generation:vault.generation,account,interval:60,days:1}]);
  }
  const day=dateWindow('UTC',1).since;
  const provider=new GraphReadClient(config,async(url,init)=>{
   const token=init.headers.Authorization.replace('Bearer ',''),c=companies.find(c=>c.token===token);assert(c,'Worker must use the token belonging to the claimed company');
   const path=new URL(url).pathname;
   const data=path.endsWith('/campaigns')?[{id:'100',name:'Private campaign '+c.spend,status:'ACTIVE'}]:path.endsWith('/adsets')?[{id:'200',name:'Adset',campaign_id:'100'}]:path.endsWith('/adcreatives')?[{id:'300',name:'Creative'}]:path.endsWith('/ads')?[{id:'400',name:'Ad',campaign_id:'100',adset_id:'200',creative:{id:'300'}}]:[{ad_id:'400',campaign_id:'100',adset_id:'200',date_start:day,date_stop:day,account_currency:'INR',spend:c.spend}];
   return Response.json({data});
  });
  await root();await db.query("select set_config('request.jwt.claim.sub','',false)");await db.query('set role crm_meta_worker');
  for(let i=0;i<16;i++)if(!await workerStep(db,config,provider))break;
  for(const c of companies){await as(c.admin);const status=await rpc('crm_meta_status');assert.equal(status.accounts.length,1);assert.equal(status.accounts[0].selected,true);assert(!JSON.stringify(status).includes(c.token));const report=await rpc('crm_meta_spend',['act_1',{from:day,to:day},'campaign',1]);assert.equal(report.rows[0].spend,Number(c.spend).toFixed(6));}
  await as(companies[0].admin);await rpc('crm_meta_admin',['disconnect',{}]);
  await as(companies[1].admin);const retained=await rpc('crm_meta_status');assert.equal(retained.connection.state,'verified');assert.equal(retained.accounts[0].selected,true);assert.equal((await rpc('crm_meta_spend',['act_1',{from:day,to:day},'campaign',1])).rows[0].spend,'9.000000');
 }finally{await pg.close();}
});

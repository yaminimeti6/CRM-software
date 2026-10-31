import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { migrate } from '../scripts/lib/bootstrap.mjs';
test('lead RPCs enforce real SQL tenant/role policy, audit, field registration and stale-write protection',async()=>{
 const engine=new PGlite();const db={query:async(s,p)=>p?engine.query(s,p):(await engine.exec(s)).at(-1)};
 try{
 await engine.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;`);
 await migrate(db);
 const org=randomUUID(),other=randomUUID(),users=Array.from({length:4},()=>randomUUID());
 await db.query('insert into public.organizations(id,name) values($1,$2),($3,$4)',[org,'A',other,'B']);
 for(let i=0;i<4;i++){
 await db.query('insert into auth.users values($1,$2,now())',[users[i],`test${i}@example.test`]);
 await db.query('insert into public.staff_profiles(id,full_name) values($1,$2)',[users[i],'Test']);
 await db.query('insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,$3)',[users[i],org,['admin','manager','telecaller','creative_analyst'][i]]);
 }
 const asUser=async i=>{await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[i]]);await db.query('set role authenticated');};
 const payload={name:'Test Lead',mobile_no:'001234567890',address:'Test address',notes:'',answers:{'New Quiz':'Original answer'}};
 await asUser(2);
 let row=(await db.query('select to_jsonb(public.create_lead($1::jsonb)) as lead',[JSON.stringify(payload)])).rows[0].lead;
 assert.equal(row.organization_id,org);assert.equal(row.mobile_no,'001234567890');assert.equal(row.created_by,users[2]);assert.ok(row.created_at);assert.equal(row.version,1);
 assert.equal((await db.query('select * from public.lead_field_definitions')).rows[0].field_key,'New Quiz');
 const search=(await db.query('select public.search_leads($1,null,0,5) as result',['Test Lead'])).rows[0].result;
 assert.equal(search.total,1);assert.equal(search.leads[0].id,row.id);
 assert.equal((await db.query('select public.search_leads($1,null,0,5) as result',["Test,or(name.*)"])).rows[0].result.total,0);
 const retry=(await db.query("select id from public.lead_statuses where label='Retry'")).rows[0].id;
 for(let i=0;i<3;i++){await asUser(i);assert.equal((await db.query('select * from public.leads')).rows.length,1);}
 await asUser(1);
 const changed={...payload,notes:'Updated',status_id:retry};
 row=(await db.query('select to_jsonb(public.update_lead($1,$2,$3::jsonb)) as lead',[row.id,1,JSON.stringify(changed)])).rows[0].lead;
 assert.equal(row.version,2);
 await assert.rejects(db.query('select public.update_lead($1,$2,$3::jsonb)',[row.id,1,JSON.stringify(payload)]),/Lead changed/);
 const history=(await db.query('select * from public.lead_edit_history order by version')).rows;
 assert.equal(history.length,2);assert.equal(history[1].editor_id,users[1]);assert.equal(history[1].changes.notes.after,'Updated');
 await asUser(2);
 const editors=(await db.query('select * from public.lead_history_editors($1,$2::uuid[])',[row.id,[users[1],users[2],users[3]]])).rows;
 assert.equal(editors.length,2);assert.ok(editors.some(e=>e.editor_id===users[1]&&e.display_name==='Test'));
 assert.equal((await db.query('select * from public.staff_profiles')).rows.length,1);
 await asUser(1);
 await db.query('select public.update_lead($1,$2,$3::jsonb)',[row.id,2,JSON.stringify(changed)]);
 assert.equal((await db.query('select * from public.lead_edit_history')).rows.length,2);
 await assert.rejects(db.query("update public.leads set name='Bypass'"),/permission denied/);
 await assert.rejects(db.query('delete from public.lead_edit_history'),/permission denied/);
 await assert.rejects(db.query('select public.create_lead($1::jsonb)',[JSON.stringify({...payload,organization_id:other})]),/Protected/);
 await assert.rejects(db.query('select public.create_lead($1::jsonb)',[JSON.stringify({...payload,mobile_no:'bad'})]),/check constraint/);
 await asUser(3);
 assert.equal((await db.query('select * from public.lead_history_editors($1,$2::uuid[])',[row.id,[users[1]]])).rows.length,0);
 assert.equal((await db.query("select public.search_leads('',null,0,20) as result")).rows[0].result.total,0);
 for(const t of ['leads','lead_statuses','lead_field_definitions','lead_edit_history'])assert.equal((await db.query(`select * from public.${t}`)).rows.length,0);
 await assert.rejects(db.query('select public.create_lead($1::jsonb)',[JSON.stringify(payload)]),/Operational staff/);
 await db.query('reset role');
 await assert.rejects(db.query('update public.organization_memberships set organization_id=$1 where user_id=$2',[other,users[2]]),/cannot be transferred/);
 await db.query('delete from public.organization_memberships where user_id=$1',[users[2]]);
 await db.query("insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,'telecaller')",[users[2],other]);await asUser(2);
 assert.equal((await db.query('select * from public.leads')).rows.length,0);
 assert.equal((await db.query('select * from public.lead_history_editors($1,$2::uuid[])',[row.id,[users[1]]])).rows.length,0);
 await assert.rejects(db.query('select public.update_lead($1,$2,$3::jsonb)',[row.id,2,JSON.stringify(changed)]),/Lead unavailable/);
 await asUser(0);await assert.rejects(db.query("update public.lead_statuses set label='Confirm' where is_new"),/check constraint/);
 await db.query('reset role');await db.query('set role anon');await assert.rejects(db.query('select * from public.leads'),/permission denied/);
 }finally{await engine.close();}
});

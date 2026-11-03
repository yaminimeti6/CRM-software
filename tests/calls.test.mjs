import { test } from 'node:test'; import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import { PGlite } from '@electric-sql/pglite'; import { migrate } from '../scripts/lib/bootstrap.mjs';
test('explicit calls and inline confirmation transitions are atomic, attributed, versioned and retry-safe', async () => {
    const pg = new PGlite(), db = { query: async (s, p) => p ? pg.query(s, p) : (await pg.exec(s)).at(-1) };
    try {
        await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`); await migrate(db);
        const org = randomUUID(), other = randomUUID(), ids = Array.from({ length: 5 }, () => randomUUID()); await db.query('insert into public.organizations(id,name) values($1,$2),($3,$4)', [org, 'A', other, 'B']);
        for (let i = 0; i < 5; i++) { await db.query('insert into auth.users values($1,$2,now())', [ids[i], `${i}@example.test`]); await db.query('insert into public.staff_profiles(id,full_name) values($1,$2)', [ids[i], `Caller ${i}`]); await db.query('insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,$3)', [ids[i], i === 4 ? other : org, i === 3 ? 'creative_analyst' : 'telecaller']); }
        const as = async i => { await db.query('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[i]]); await db.query('set role authenticated'); };
        await as(0); const status = Object.fromEntries((await db.query('select id,label from public.lead_statuses')).rows.map(s => [s.label, s.id]));
        const input = { name: 'Synthetic lead', mobile_no: '001234567890', address: 'Initial', notes: 'Lead notes', answers: { OTP: 'Verified' } };
        const create = async () => (await db.query('select to_jsonb(public.create_lead($1::jsonb)) as l', [JSON.stringify(input)])).rows[0].l;
        const edit = async (l, payload) => (await db.query('select to_jsonb(public.update_lead($1,$2,$3::jsonb)) as l', [l.id, l.version, JSON.stringify(payload)])).rows[0].l;
        const call = async (l, outcome, key = randomUUID(), extra = {}) => (await db.query('select public.log_lead_call($1,$2,$3,$4::jsonb) as r', [l.id, l.version, key, JSON.stringify({ status_id: status[outcome], reason: 'Synthetic reason', notes: 'Call notes', ...extra })])).rows[0].r;
        const read = async id => (await db.query('select * from public.leads where id=$1', [id])).rows[0];
        let lead = await create(); assert.equal((await db.query('select * from public.confirmation_events')).rows.length, 0);
        lead = await edit(lead, { ...input, address: 'Edited', notes: 'Edited ordinary Notes' }); assert.equal((await db.query('select * from public.call_attempts')).rows.length, 0);
        const currentInput = { ...input, address: 'Edited', notes: 'Edited ordinary Notes' };
        for (const [actor, outcome] of [[0, 'CNP'], [1, 'Retry']]) { await as(actor); await call(lead, outcome); lead = await read(lead.id); }
        await as(2); const originalVersion = lead.version, key = randomUUID(); await call(lead, 'Confirm', key); lead = await read(lead.id);
        assert.equal(lead.first_confirmed_by, ids[2]); assert.equal(lead.latest_confirmed_by, ids[2]); const firstTime = lead.first_confirmed_at;
        const detail = (await db.query('select public.lead_call_details($1,1) as d', [lead.id])).rows[0].d; assert.equal(detail.attempt_count, 3); assert.equal(detail.confirmation_event_count, 1); assert.equal(detail.distinct_confirmed_leads, 1); assert.equal(detail.currently_confirmed, true); assert.equal(detail.latest_confirmed_by, 'Caller 2');
        assert.equal((await call({ ...lead, version: originalVersion }, 'Confirm', key)).replayed, true);
        await assert.rejects(call({ ...lead, version: originalVersion }, 'Confirm', key, { notes: 'Changed retry' }), /Request key/);
        await call(lead, 'Confirm'); lead = await read(lead.id); assert.equal((await db.query('select * from public.confirmation_events')).rows.length, 1); assert.equal((await db.query('select * from public.call_attempts')).rows.length, 4);
        lead = await edit(lead, { ...currentInput, status_id: status.Confirm }); assert.equal(lead.latest_confirmed_by, ids[2]);
        lead = await edit(lead, { ...currentInput, status_id: status.Cancel }); assert.equal((await db.query('select public.lead_call_details($1,1) as d', [lead.id])).rows[0].d.currently_confirmed, false);
        await as(1); lead = await edit(lead, { ...currentInput, status_id: status.Confirm }); assert.equal(new Date(lead.first_confirmed_at).getTime(), new Date(firstTime).getTime()); assert.equal(lead.latest_confirmed_by, ids[1]); assert.equal((await db.query('select * from public.confirmation_events')).rows.length, 2); assert.equal((await db.query('select * from public.call_attempts')).rows.length, 4);
        const inline = await create(); await edit(inline, { ...input, status_id: status.Confirm }); assert.equal((await db.query('select * from public.call_attempts where lead_id=$1', [inline.id])).rows.length, 0);
        await as(0); const fault = await create(); await db.query('reset role'); await db.query(`alter table public.lead_edit_history add constraint calls_test_failure check(lead_id<>'${fault.id}'::uuid or activity_type is distinct from 'call') not valid`); await as(0);
        const faultKey = randomUUID(); await assert.rejects(call(fault, 'Confirm', faultKey), /check constraint/); assert.equal((await read(fault.id)).version, 1); assert.equal((await read(fault.id)).first_confirmed_at, null); assert.equal((await db.query('select * from public.call_attempts where lead_id=$1', [fault.id])).rows.length, 0); assert.equal((await db.query('select * from public.confirmation_events where lead_id=$1', [fault.id])).rows.length, 0);
        await db.query('reset role'); await db.query('alter table public.lead_edit_history drop constraint calls_test_failure'); await as(0); await call(fault, 'Confirm', faultKey);
        await assert.rejects(call(fault, 'Retry'), /Lead changed/); await assert.rejects(call(await read(fault.id), 'Retry', randomUUID(), { caller_id: ids[2] }), /Protected/);
        await assert.rejects(db.query('delete from public.call_attempts'), /permission denied/); await assert.rejects(db.query('update public.confirmation_events set confirmed_by=$1', [ids[0]]), /permission denied/);
        await as(3); await assert.rejects(call(lead, 'Confirm'), /Operational/); assert.equal((await db.query('select * from public.call_attempts')).rows.length, 0);
        await as(4); await assert.rejects(call(lead, 'Confirm'), /Lead unavailable/); assert.equal((await db.query('select * from public.confirmation_events')).rows.length, 0);
        await db.query('reset role'); await db.query('set role anon'); await assert.rejects(db.query('select * from public.call_attempts'), /permission denied/);
    } finally { await pg.close(); }
});

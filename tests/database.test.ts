import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('actual PostgreSQL migration enforces tenant isolation and denies client privilege escalation', async () => {
  const db = new PGlite();
  try {
    // Supabase supplies these roles/auth schema in production. This fixture only
    // supplies their SQL contract; the real migration, grants and RLS run below.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    await db.exec(readFileSync('supabase/migrations/202610310001_staff_auth.sql', 'utf8'));
    const ids = [1, 2, 3, 4, 5, 6].map(n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`);
    await db.exec(`insert into public.organizations(id,name) values ('${ids[4]}','A'),('${ids[5]}','B');`);
    for (let i = 0; i < 4; i++) {
      await db.exec(`insert into auth.users values ('${ids[i]}',now());
        insert into public.staff_profiles(id,full_name) values ('${ids[i]}','Staff ${i}');
        insert into public.organization_memberships(user_id,organization_id,role)
        values ('${ids[i]}','${ids[i === 3 ? 5 : 4]}','${['admin', 'manager', 'telecaller', 'creative_analyst'][i]}');`);
    }
    for (const id of ids.slice(0, 4)) {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
      assert.equal((await db.query('select * from public.organization_memberships')).rows.length, 1);
      assert.equal((await db.query('select * from public.organizations')).rows.length, 1);
      assert.deepEqual((await db.query('select id from public.staff_profiles')).rows, [{ id }]);
      for (const sql of [
        `update public.organization_memberships set role='admin' where user_id='${id}'`,
        `update public.organization_memberships set organization_id='${ids[5]}' where user_id='${id}'`,
        `update public.organization_memberships set active=true`,
        `insert into public.organization_memberships values ('${ids[4]}','${ids[4]}','admin',true,now())`,
        `delete from public.organization_memberships`,
        `update public.staff_profiles set full_name='Impersonation'`,
        `update public.organizations set name='Compromised'`,
      ]) await assert.rejects(db.exec(sql), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec(`update public.organization_memberships set active=false where user_id='${ids[2]}';
      set role authenticated; select set_config('request.jwt.claim.sub','${ids[2]}',false);`);
    for (const table of ['organizations', 'staff_profiles', 'organization_memberships']) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    await db.exec(`reset role; set role anon;`);
    await assert.rejects(db.query('select * from public.staff_profiles'), /permission denied/);
  } finally { await db.close(); }
});

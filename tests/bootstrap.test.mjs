import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, reserve, finalize } from '../scripts/lib/bootstrap.mjs';

test('one-time bootstrap survives partial failure, commits atomically and cannot be reused', async () => {
  const engine = new PGlite();
  const db = { query: async (sql, params) => params ? engine.query(sql, params) : (await engine.exec(sql)).at(-1) };
  try {
    await engine.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;`);
    await migrate(db);
    await migrate(db); // Checksums + repeat application must be safe.
    const input = { email: 'admin@example.test', name: 'Test Admin', organization: 'Test Org' };
    const pending = await reserve(db, input);
    assert.equal((await reserve(db, input)).user_id, pending.user_id);
    await assert.rejects(db.query("update crm_private.bootstrap_state set email='changed@example.test'"), /identity cannot be changed/);
    await assert.rejects(reserve(db, { ...input, email: 'other@example.test' }), /Partial setup/);
    await assert.rejects(finalize(db, pending), /Confirmed Auth/);
    assert.equal((await db.query('select count(*)::int as n from public.organizations')).rows[0].n, 0);
    await db.query('insert into auth.users values ($1,$2,now())', [pending.user_id, input.email]);
    // Inject a mid-transaction unique violation: organization insert must roll back.
    await db.query('insert into public.staff_profiles(id,full_name) values ($1,$2)', [pending.user_id, 'Conflict']);
    await assert.rejects(finalize(db, pending), /duplicate key/);
    assert.equal((await db.query('select count(*)::int as n from public.organizations')).rows[0].n, 0);
    assert.equal((await reserve(db, input)).user_id, pending.user_id);
    await db.query('delete from public.staff_profiles where id=$1', [pending.user_id]);
    await finalize(db, pending);
    assert.equal((await db.query('select role from public.organization_memberships')).rows[0].role, 'admin');
    await assert.rejects(reserve(db, input), /already initialized/);
    await assert.rejects(finalize(db, pending), /not pending/);
    // Removing all staff still cannot reopen a previously completed setup.
    await assert.rejects(db.query('delete from public.organization_memberships'), /last active Admin/);
    await db.query('delete from public.organizations');
    await assert.rejects(reserve(db, input), /already initialized/);
    await assert.rejects(db.query('delete from crm_private.bootstrap_state'), /cannot be reset/);
    await assert.rejects(db.query('update crm_private.bootstrap_state set completed_at=null'), /cannot be reset/);
    await db.query('set role authenticated');
    await assert.rejects(db.query('select * from crm_private.bootstrap_state'), /permission denied/);
    await db.query('reset role');
    await db.query('set role service_role');
    await assert.rejects(db.query('select * from crm_private.bootstrap_state'), /permission denied/);
  } finally { await engine.close(); }
});

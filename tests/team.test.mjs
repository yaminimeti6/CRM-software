import { test } from 'node:test'; import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite'; import { migrate } from '../scripts/lib/bootstrap.mjs';
test('Team SQL scopes Admin access, verifies ownership, retries safely, audits changes and guards the last Admin', async () => {
    const engine = new PGlite(); const db = { query: async (s, p) => p ? engine.query(s, p) : (await engine.exec(s)).at(-1) };
    try {
        await engine.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;`); await migrate(db);
        const org = randomUUID(), other = randomUUID(), a = randomUUID(), b = randomUUID(), tele = randomUUID(), outside = randomUUID();
        await db.query('insert into public.organizations(id,name) values($1,$2),($3,$4)', [org, 'A', other, 'B']);
        for (const [id, organization, role] of [[a, org, 'admin'], [b, org, 'admin'], [tele, org, 'telecaller'], [outside, other, 'admin']]) {
            await db.query('insert into auth.users values($1,$2,now())', [id, `${id}@example.test`]); await db.query('insert into public.staff_profiles(id,full_name) values($1,$2)', [id, 'Test staff']); await db.query('insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,$3)', [id, organization, role]);
        }
        const asUser = async id => { await db.query('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.query('set role authenticated'); };
        await asUser(a); assert.equal((await db.query('select public.team_list() as result')).rows[0].result.members.length, 3);
        await assert.rejects(db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, tele, 'admin', true, 1]), /permission denied/);
        await asUser(tele); await assert.rejects(db.query('select public.team_list()'), /Admin access/); await db.query('reset role');
        const request = randomUUID(); const args = [a, request, 'new@example.test', 'New staff', 'telecaller'];
        let inv = (await db.query('select to_jsonb(public.team_reserve_invitation($1,$2,$3,$4,$5)) as invitation', args)).rows[0].invitation;
        assert.equal((await db.query('select to_jsonb(public.team_reserve_invitation($1,$2,$3,$4,$5)) as invitation', args)).rows[0].invitation.id, inv.id);
        await assert.rejects(db.query('select public.team_reserve_invitation($1,$2,$3,$4,$5)', [a, request, 'changed@example.test', 'New staff', 'telecaller']), /Retry details/);
        await db.query('insert into auth.users values($1,$2,now())', [inv.reserved_user_id, inv.email]);
        await assert.rejects(db.query('select public.team_accept_invitation($1,$2)', [inv.id, inv.reserved_user_id]), /unavailable/);
        await db.query('select public.team_mark_sent($1,$2)', [a, inv.id]);
        await assert.rejects(db.query('select public.team_accept_invitation($1,$2)', [inv.id, outside]), /ownership/);
        await db.query('select public.team_accept_invitation($1,$2)', [inv.id, inv.reserved_user_id]);
        await db.query('select public.team_accept_invitation($1,$2)', [inv.id, inv.reserved_user_id]);
        assert.equal((await db.query("select count(*)::int as n from public.team_audit_logs where action='invitation_accepted'")).rows[0].n, 1);
        assert.equal((await db.query('select role from public.organization_memberships where user_id=$1', [inv.reserved_user_id])).rows[0].role, 'telecaller');
        const blocked = (await db.query('select to_jsonb(public.team_reserve_invitation($1,$2,$3,$4,$5)) as invitation', [a, randomUUID(), `${outside}@example.test`, 'Unrelated identity', 'admin'])).rows[0].invitation;
        await db.query('select public.team_mark_sent($1,$2)', [a, blocked.id]);
        await assert.rejects(db.query('select public.team_accept_invitation($1,$2)', [blocked.id, outside]), /cannot join/);
        await assert.rejects(db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, outside, 'telecaller', false, 1]), /unavailable/);
        await db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, tele, 'manager', false, 1]);
        await asUser(tele); assert.equal((await db.query('select * from public.staff_profiles')).rows.length, 0); await db.query('reset role');
        const audit = (await db.query("select * from public.team_audit_logs where action='membership_updated'")).rows[0]; assert.equal(audit.actor_id, a); assert.equal(audit.target_id, tele); assert.equal(audit.changes.before.role, 'telecaller'); assert.equal(audit.changes.after.active, false); assert.ok(audit.changed_at);
        await db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, b, 'manager', true, 1]);
        await assert.rejects(db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, a, 'manager', true, 1]), /last active Admin/);
        await assert.rejects(db.query('select public.team_update_member($1,$2,$3,$4,$5)', [a, a, 'admin', false, 1]), /last active Admin/);
        await assert.rejects(db.query('delete from public.organization_memberships where user_id=$1', [a]), /last active Admin/);
        await asUser(a); await assert.rejects(db.query('select * from public.team_audit_logs'), /permission denied/); await db.query('reset role');
        await db.query('delete from public.organizations where id=$1', [org]);
        assert.equal((await db.query('select count(*)::int as n from public.organization_memberships where organization_id=$1', [org])).rows[0].n, 0);
    } finally { await engine.close(); }
});



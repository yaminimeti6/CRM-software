import { test } from 'node:test'; import assert from 'node:assert/strict'; import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite'; import { migrate } from '../scripts/lib/bootstrap.mjs';
test('manual invite SQL enforces hashes, leases, single use, usernames, revocation, expiry and private rate limits', async () => {
    const pg = new PGlite(); const db = { query: async (s, p) => p ? pg.query(s, p) : (await pg.exec(s)).at(-1) };
    try {
        await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`); await migrate(db);
        const org = randomUUID(), actor = randomUUID(), other = randomUUID(), actorB = randomUUID();
        for (const [o, a] of [[org, actor], [other, actorB]]) { await db.query('insert into public.organizations(id,name) values($1,$2)', [o, 'Synthetic']); await db.query('insert into auth.users values($1,$2,now())', [a, `${a}@example.test`]); await db.query('insert into public.staff_profiles(id,full_name) values($1,$2)', [a, 'Admin']); await db.query("insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,'admin')", [a, o]); }
        async function make() { const token = randomBytes(32).toString('base64url'), hash = createHash('sha256').update(token).digest('hex'), request = randomUUID(); const args = [actor, request, 'Display Name', 'telecaller', hash]; const inv = (await db.query('select to_jsonb(public.manual_create_invitation($1,$2,$3,$4,$5)) as i', args)).rows[0].i; assert.equal(inv.token_hash, hash); assert.ok(!JSON.stringify(inv).includes(token)); assert.equal((await db.query('select to_jsonb(public.manual_create_invitation($1,$2,$3,$4,$5)) as i', args)).rows[0].i.id, inv.id); return inv; }
        const inv = await make(), lease = randomUUID();
        assert.equal((await db.query('select public.manual_validate_invitation($1,$2) as i', [inv.id, '0'.repeat(64)])).rows[0].i, null);
        const identity = (await db.query('select public.manual_claim_invitation($1,$2,$3,$4) as i', [inv.id, inv.token_hash, 'alice_35', lease])).rows[0].i;
        await assert.rejects(db.query('select public.manual_claim_invitation($1,$2,$3,$4)', [inv.id, inv.token_hash, 'alice_35', randomUUID()]), /in progress/);
        await assert.rejects(db.query('select public.manual_finish_invitation($1,$2)', [inv.id, lease]), /incomplete/);
        assert.equal((await db.query('select public.manual_login_identity($1) as i', ['alice_35'])).rows[0].i, null);
        await db.query('select public.manual_release_invitation($1,$2)', [inv.id, lease]);
        await db.query('insert into auth.users values($1,$2,now())', [identity.user_id, identity.email]);
        await assert.rejects(db.query('select public.manual_finish_invitation($1,$2)', [inv.id, null]), /unavailable/);
        await assert.rejects(db.query('select public.manual_claim_invitation($1,$2,$3,$4)', [inv.id, inv.token_hash, 'alice_35', null]), /Invalid setup lease/);
        const retry = randomUUID(); assert.equal((await db.query('select public.manual_claim_invitation($1,$2,$3,$4) as i', [inv.id, inv.token_hash, 'alice_35', retry])).rows[0].i.user_id, identity.user_id);
        await db.query('select public.manual_finish_invitation($1,$2)', [inv.id, retry]);
        await assert.rejects(db.query('select public.manual_finish_invitation($1,$2)', [inv.id, retry]), /unavailable/);
        assert.equal((await db.query('select public.manual_validate_invitation($1,$2) as i', [inv.id, inv.token_hash])).rows[0].i.state, 'accepted');
        assert.equal((await db.query('select full_name from public.staff_profiles where id=$1', [identity.user_id])).rows[0].full_name, 'Display Name');
        const collision = await make(); await assert.rejects(db.query('select public.manual_claim_invitation($1,$2,$3,$4)', [collision.id, collision.token_hash, 'alice_35', randomUUID()]), /Username unavailable/);
        await assert.rejects(db.query('select public.manual_revoke_invitation($1,$2)', [actorB, collision.id]), /unavailable/);
        await db.query('select public.manual_revoke_invitation($1,$2)', [actor, collision.id]); assert.equal((await db.query('select public.manual_validate_invitation($1,$2) as i', [collision.id, collision.token_hash])).rows[0].i.state, 'revoked');
        const expired = await make(); await db.query("update public.manual_team_invitations set expires_at=now()-interval '1 second' where id=$1", [expired.id]); await assert.rejects(db.query('select public.manual_claim_invitation($1,$2,$3,$4)', [expired.id, expired.token_hash, 'new_user', randomUUID()]), /unavailable/);
        assert.equal((await db.query('select public.manual_rate_limit($1,2,60) as allowed', ['test'])).rows[0].allowed, true); assert.equal((await db.query('select public.manual_rate_limit($1,2,60) as allowed', ['test'])).rows[0].allowed, true); assert.equal((await db.query('select public.manual_rate_limit($1,2,60) as allowed', ['test'])).rows[0].allowed, false);
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [identity.user_id]); await db.query('set role authenticated'); assert.equal((await db.query('select public.own_username() as username')).rows[0].username, 'alice_35'); await assert.rejects(db.query('select * from crm_private.staff_usernames'), /permission denied/); await assert.rejects(db.query('select public.manual_login_identity($1)', ['alice_35']), /permission denied/); await assert.rejects(db.query('select * from public.manual_team_invitations'), /permission denied/);
    } finally { await pg.close(); }
});

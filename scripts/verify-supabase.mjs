// Run only against a dedicated development project with disposable staff users.
// Credentials are read from an ignored local env file, never CLI arguments/logs.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TEST_STAFF_EMAIL', 'TEST_STAFF_PASSWORD', 'TEST_OTHER_ORGANIZATION_ID'];
if (required.some(key => !process.env[key])) {
  console.error('BLOCKED: configure .env.local and .env.integration.local as described in docs/verification.md.');
  process.exit(2);
}
const makeClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const client = makeClient();
try {
  const invalid = await makeClient().auth.signInWithPassword({
    email: process.env.TEST_STAFF_EMAIL, password: `Invalid-${crypto.randomUUID()}`,
  });
  assert.ok(invalid.error, 'Invalid credentials must be rejected');
  const signed = await client.auth.signInWithPassword({ email: process.env.TEST_STAFF_EMAIL, password: process.env.TEST_STAFF_PASSWORD });
  assert.ifError(signed.error);
  assert.ok(signed.data.session, 'Valid staff credentials must authenticate');
  const userId = signed.data.user.id;
  const membership = await client.from('organization_memberships').select('*').single();
  assert.ifError(membership.error);
  assert.equal(membership.data.user_id, userId);
  assert.equal(membership.data.active, true);
  assert.notEqual(membership.data.organization_id, process.env.TEST_OTHER_ORGANIZATION_ID, 'Supply a genuinely different organization ID');
  const profile = await client.from('staff_profiles').select('*').single();
  assert.ifError(profile.error);
  assert.equal(profile.data.id, userId);
  assert.ok(profile.data.full_name);
  const crossTenant = await client.from('organizations').select('*').eq('id', process.env.TEST_OTHER_ORGANIZATION_ID);
  assert.ifError(crossTenant.error);
  assert.deepEqual(crossTenant.data, []);
  const crossMembership = await client.from('organization_memberships').select('*').eq('organization_id', process.env.TEST_OTHER_ORGANIZATION_ID);
  assert.ifError(crossMembership.error);
  assert.deepEqual(crossMembership.data, []);
  for (const change of [{ role: 'admin' }, { organization_id: process.env.TEST_OTHER_ORGANIZATION_ID }, { active: false }]) {
    const result = await client.from('organization_memberships').update(change).eq('user_id', userId);
    assert.ok(result.error, 'Protected membership updates must fail');
  }
  const refreshed = await client.auth.refreshSession();
  assert.ifError(refreshed.error);
  assert.ok(refreshed.data.session);
  const revalidated = await client.auth.getUser();
  assert.ifError(revalidated.error);
  assert.equal(revalidated.data.user.id, userId);
  const signedOut = await client.auth.signOut({ scope: 'local' });
  assert.ifError(signedOut.error);
  assert.equal((await client.auth.getSession()).data.session, null);
  const anonymousRead = await makeClient().from('staff_profiles').select('*');
  assert.ok(anonymousRead.error, 'Anonymous database reads must fail');
  console.log('PASS: real Auth valid/invalid credentials, refresh, SDK logout, own staff records, cross-organization denial, protected-field denial, anonymous denial. Browser/server-cookie tests still require the manual checklist.');
} catch {
  // Deliberately omit error payloads: they may contain project/user details.
  console.error('FAIL: Supabase integration assertion failed. Check project setup and disposable test account privately.');
  process.exitCode = 1;
} finally { await client.auth.signOut({ scope: 'local' }); }

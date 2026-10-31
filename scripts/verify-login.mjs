// Live-only acceptance test. No traces, screenshots, credentials or response
// payloads are written to disk. Uses disposable fixtures and removes them.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { configuration, clients, projectUrl, reportFailure } from './lib/operator.mjs';
import { reserve, lockId, SetupError } from './lib/bootstrap.mjs';
import { question } from './lib/prompt.mjs';

let db, browser, admin, fixtureId, fixtureOrg, fixtureClient;
let stage = 'configuration';
const authorizationOnly = process.argv.includes('--authorization-only');
let email, password;
try {
  const config = configuration();
  ({ db, admin } = clients(config));
  await db.connect();
  const status = (await db.query(`select s.user_id, s.completed_at, m.role, m.organization_id, p.full_name
    from crm_private.bootstrap_state s join public.organization_memberships m on m.user_id=s.user_id
    join public.staff_profiles p on p.id=s.user_id where s.singleton=true and m.active`)).rows[0];
  if (!status?.completed_at || status.role !== 'admin') throw new SetupError('Complete first-Admin setup before live verification.');
  if (!authorizationOnly) {
  email = (await question('Admin email for live test: ')).trim();
  password = await question('Admin password (hidden): ', true);
  const auth = createClient(projectUrl, config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  stage = 'real Admin credentials';
  const login = await auth.auth.signInWithPassword({ email, password });
  if (login.error) throw new SetupError(`Admin Auth login rejected (${['invalid_credentials','email_not_confirmed','over_request_rate_limit'].includes(login.error.code) ? login.error.code : 'AUTH_UNAVAILABLE'}).`);
  assert.equal(login.data.user.id, status.user_id);
  const refresh = await auth.auth.refreshSession();
  assert.ifError(refresh.error);
  await auth.auth.signOut({ scope: 'local' });
  console.log('PASS: real first Admin identity, database role/organization, password and token refresh.');
  }

  stage = 'browser startup (start npm run dev in another terminal)';
  const base = 'http://localhost:3000';
  const executablePath = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find(existsSync);
  if (!executablePath) throw new SetupError('Supported local Edge/Chrome executable not found. Browser checks remain unverified.');
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiStatus = async path => (await context.request.get(`${base}${path}`)).status();
  await page.goto(`${base}/app`);
  await page.waitForURL('**/login');
  assert.equal(await apiStatus('/api/me'), 401);
  assert.equal(await apiStatus('/api/admin/access'), 401);
  if (!authorizationOnly) {
  stage = 'browser invalid password';
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(`Wrong-${randomUUID()}`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'AUTH_INVALID_CREDENTIALS' }).waitFor();
  assert.equal(await apiStatus('/api/me'), 401);
  stage = 'browser valid password';
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app');
  const me = await (await context.request.get(`${base}/api/me`)).json();
  assert.equal(me.id, status.user_id);
  assert.equal(me.role, 'admin');
  assert.equal(me.name, status.full_name);
  assert.equal(me.organizationId, status.organization_id);
  assert.equal(await apiStatus('/api/admin/access'), 200);
  const sessionCookies = (await context.cookies()).filter(c => c.name.startsWith('sb-'));
  assert.ok(sessionCookies.length > 0);
  assert.ok(sessionCookies.every(c => c.httpOnly && c.sameSite === 'Lax'));
  stage = 'browser page refresh and logout';
  await page.reload();
  await page.getByRole('heading', { name: 'All Leads', exact: true }).waitFor();
  assert.equal(await apiStatus('/api/me'), 200);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  assert.equal(await apiStatus('/api/me'), 401);
  assert.equal(await apiStatus('/api/admin/access'), 401);
  await page.goto(`${base}/app`);
  await page.waitForURL('**/login');
  await context.close();
  console.log('PASS: real browser invalid/valid login, actual identity, Admin API, HTTP-only cookies, page refresh, logout and logged-out protection.');
  } else { await context.close(); }

  stage = 'disposable unprivileged test account';
  fixtureId = randomUUID();
  const fixtureEmail = `crm-auth-test-${randomUUID()}@example.com`;
  const fixturePassword = `Test-${randomUUID()}!aA1`;
  const created = await admin.auth.admin.createUser({ id: fixtureId, email: fixtureEmail, password: fixturePassword, email_confirm: true });
  stage = 'fixture Auth creation result';
  assert.ifError(created.error);
  fixtureClient = createClient(projectUrl, config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const fixtureLogin = await fixtureClient.auth.signInWithPassword({ email: fixtureEmail, password: fixturePassword });
  stage = 'fixture Auth login result';
  assert.ifError(fixtureLogin.error);
  // Auth-only user gets no records, no app and no role endpoint.
  assert.deepEqual((await fixtureClient.from('staff_profiles').select('*')).data, []);
  const staffContext = await browser.newContext();
  stage = 'Auth-only browser staff denial';
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${base}/login`);
  await staffPage.getByLabel('Username or email', { exact: true }).fill(fixtureEmail);
  await staffPage.getByLabel('Password', { exact: true }).fill(fixturePassword);
  await staffPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await staffPage.getByRole('alert').filter({ hasText: 'STAFF_MEMBERSHIP' }).waitFor();
  assert.equal((await staffContext.request.get(`${base}/api/me`)).status(), 401);
  fixtureOrg = (await db.query("insert into public.organizations(name) values ('Disposable authorization test') returning id")).rows[0].id;
  stage = 'fixture membership creation';
  await db.query('insert into public.staff_profiles(id,full_name) values ($1,$2)', [fixtureId, 'Disposable test staff']);
  await db.query("insert into public.organization_memberships(user_id,organization_id,role) values ($1,$2,'telecaller')", [fixtureId, fixtureOrg]);
  await staffPage.getByLabel('Username or email', { exact: true }).fill(fixtureEmail);
  await staffPage.getByLabel('Password', { exact: true }).fill(fixturePassword);
  stage = 'Telecaller browser login';
  await staffPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await staffPage.waitForURL('**/app');
  assert.equal((await staffContext.request.get(`${base}/api/admin/access`)).status(), 403);
  stage = 'database cross-tenant and protected-field checks';
  const other = await fixtureClient.from('organizations').select('*').eq('id', status.organization_id);
  assert.ifError(other.error);
  assert.deepEqual(other.data, []);
  for (const change of [{ role: 'admin' }, { organization_id: status.organization_id }, { active: false }]) {
    stage = 'direct membership protected-field write denial';
    assert.ok((await fixtureClient.from('organization_memberships').update(change).eq('user_id', fixtureId)).error);
  }
  stage = 'direct membership deletion/profile write denial';
  assert.ok((await fixtureClient.from('organization_memberships').delete().eq('user_id', fixtureId)).error);
  assert.ok((await fixtureClient.from('staff_profiles').update({ full_name: 'Impersonation' }).eq('id', fixtureId)).error);
  stage = 'metadata spoof does not change database role';
  const spoof = await fixtureClient.auth.updateUser({ data: { role: 'admin', organization_id: status.organization_id } });
  assert.ifError(spoof.error);
  assert.equal((await fixtureClient.from('organization_memberships').select('role').single()).data.role, 'telecaller');
  assert.equal((await staffContext.request.get(`${base}/api/admin/access`)).status(), 403);
  stage = 'inactive membership access revocation';
  await db.query('update public.organization_memberships set active=false where user_id=$1', [fixtureId]);
  assert.equal((await staffContext.request.get(`${base}/api/me`)).status(), 403);
  assert.deepEqual((await fixtureClient.from('staff_profiles').select('*')).data, []);
  await staffContext.close();
  stage = 'one-time setup reuse';
  assert.ok((await db.query('select pg_try_advisory_lock($1) as locked', [lockId])).rows[0].locked);
  await assert.rejects(reserve(db, { email: 'never-created@example.com', name: 'Never Created', organization: 'Never Created' }), /already initialized/);
  console.log('PASS: Auth-only account denied, Telecaller Admin API denied, cross-tenant read denied, protected-field mutations denied, metadata spoof rejected, membership revocation immediate, first-Admin reuse refused.');
} catch (error) {
  console.error(`Live verification stopped at: ${stage}.`);
  if (error?.name === 'AssertionError' && typeof error.actual === 'number' && typeof error.expected === 'number') console.error(`Expected numeric status ${error.expected}; received ${error.actual}.`);
  reportFailure(error);
} finally {
  if (fixtureClient) await fixtureClient.auth.signOut({ scope: 'local' }).catch(() => {});
  if (fixtureId && admin) {
    const cleanup = await admin.auth.admin.deleteUser(fixtureId).catch(() => ({ error: true }));
    if (cleanup.error) { console.error('CLEANUP REQUIRED: remove the disposable crm-auth-test account in Dashboard.'); process.exitCode = 1; }
  }
  if (fixtureOrg && db) await db.query('delete from public.organizations where id=$1', [fixtureOrg]).catch(() => { console.error('CLEANUP REQUIRED: remove the disposable authorization-test organization.'); process.exitCode = 1; });
  if (browser) await browser.close();
  if (db) await db.end().catch(() => {});
}

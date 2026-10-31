import { question } from './lib/prompt.mjs';
import { createClient } from '@supabase/supabase-js';
import { configuration, clients, projectUrl, reportFailure } from './lib/operator.mjs';
import { migrate, reserve, finalize, lockId, SetupError } from './lib/bootstrap.mjs';

let db;
let stage = 'local configuration';
try {
  const config = configuration();
  const clientsForSetup = clients(config);
  db = clientsForSetup.db;
  const admin = clientsForSetup.admin;
  stage = 'PostgreSQL TLS/connect';
  await db.connect();
  stage = 'PostgreSQL setup lock';
  if (!(await db.query('select pg_try_advisory_lock($1) as locked', [lockId])).rows[0].locked) throw new SetupError('Another setup is running. Try later.');
  stage = 'HTTPS Auth settings';
  const settingsResponse = await fetch(`${projectUrl}/auth/v1/settings`, { headers: { apikey: config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000) });
  if (!settingsResponse.ok) throw new SetupError('Project Auth settings could not be verified.');
  const settings = await settingsResponse.json();
  if (!settings.disable_signup) throw new SetupError('Disable Allow new users to sign up in Supabase Dashboard first.');
  if (!settings.external?.email) throw new SetupError('Enable the email/password provider first.');
  stage = 'HTTPS Admin API';
  const privilege = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (privilege.error) throw new SetupError('Supabase privileged key was rejected. Check the local secret key.');
  stage = 'database migrations';
  await migrate(db);
  console.log('PASS: migrations applied/verified; public signup disabled.');
  const state = (await db.query('select completed_at from crm_private.bootstrap_state where singleton=true')).rows[0];
  if (state?.completed_at || (await db.query('select exists(select 1 from public.organization_memberships) as present')).rows[0].present) throw new SetupError('First Admin/staff already initialized. This command cannot create another Admin.');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new SetupError('Run npm.cmd run setup:admin in your own terminal to enter credentials securely.');
  const email = (await question('First Admin email: ')).trim().toLowerCase();
  const name = (await question('First Admin full name: ')).trim();
  const organization = (await question('Organization name: ')).trim();
  const password = await question('Password (hidden, minimum 12 characters): ', true);
  const confirmation = await question('Confirm password (hidden): ', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 200 || !organization || organization.length > 200 || password.length < 12 || password.length > 1024 || password !== confirmation) throw new SetupError('Invalid input or password confirmation. No Auth user was created.');
  stage = 'database bootstrap reservation';
  const pending = await reserve(db, { email, name, organization });
  // Durable UUID reservation precedes the network operation. A timeout/restart
  // can only resume the same identity; unrelated existing accounts are not adopted.
  stage = 'HTTPS Auth user provisioning';
  const existing = await admin.auth.admin.getUserById(pending.user_id);
  if (!existing.data.user) {
    const created = await admin.auth.admin.createUser({ id: pending.user_id, email, password, email_confirm: true });
    if (created.error) throw new SetupError('Auth creation failed. Pending setup is preserved. Check Dashboard for an existing email/password policy, then rerun with the SAME identity. No existing user is overwritten.');
  }
  const loginClient = createClient(projectUrl, config.local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await loginClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || signedIn.data.user?.id !== pending.user_id) throw new SetupError('Pending Auth account password could not be verified. Rerun with its original password; no role was assigned.');
  stage = 'database bootstrap completion';
  try { await finalize(db, pending); }
  finally { await loginClient.auth.signOut({ scope: 'local' }); }
  console.log('PASS: confirmed Auth user, organization, profile and Admin membership created. One-time setup permanently completed. Password was not stored locally. Test browser login next.');
} catch (error) { reportFailure(error, stage); }
finally { if (db) await db.end().catch(() => {}); }

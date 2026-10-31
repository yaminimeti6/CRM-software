import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

export class SetupError extends Error {}
export const lockId = 731021001;

export async function migrate(db) {
  await db.query(`create schema if not exists crm_migrations;
    revoke all on schema crm_migrations from public, anon, authenticated, service_role;
    create table if not exists crm_migrations.applied(version text primary key, checksum text not null);
    revoke all on crm_migrations.applied from public, anon, authenticated, service_role;`);
  const files = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = (await db.query('select checksum from crm_migrations.applied where version=$1', [file])).rows[0];
    if (previous) {
      if (previous.checksum !== checksum) throw new SetupError('Migration checksum mismatch. Refusing changed migration.');
      continue;
    }
    // A Dashboard-applied first migration has no local ledger. Never silently
    // adopt unknown/partial schema: operator must inspect and explicitly reconcile.
    if (file.startsWith('202610310001') && (await db.query("select to_regclass('public.staff_profiles') as existing")).rows[0].existing) {
      throw new SetupError('Existing schema has no setup migration ledger. Inspect it before adopting; no existing records were changed.');
    }
    await db.query('begin');
    try {
      await db.query(sql.replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, ''));
      await db.query('insert into crm_migrations.applied(version,checksum) values ($1,$2)', [file, checksum]);
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; }
  }
  await db.query("notify pgrst, 'reload schema'");
}

export async function reserve(db, input) {
  const state = (await db.query('select * from crm_private.bootstrap_state where singleton=true')).rows[0];
  if (state?.completed_at) throw new SetupError('First Admin is already initialized. Setup cannot be reused.');
  if ((await db.query('select exists(select 1 from public.organization_memberships) as present')).rows[0].present) {
    throw new SetupError('Staff memberships already exist. Refusing first-Admin setup.');
  }
  if (state) {
    if (state.email !== input.email || state.full_name !== input.name || state.organization_name !== input.organization) {
      throw new SetupError('Partial setup exists. Resume using the same email, name and organization; identity cannot be replaced.');
    }
    return state;
  }
  return (await db.query(`insert into crm_private.bootstrap_state(user_id,email,full_name,organization_name)
    values ($1,$2,$3,$4) returning *`, [randomUUID(), input.email, input.name, input.organization])).rows[0];
}

export async function finalize(db, state) {
  await db.query('begin');
  try {
    const current = (await db.query('select * from crm_private.bootstrap_state where singleton=true for update')).rows[0];
    if (!current || current.completed_at || current.user_id !== state.user_id) throw new SetupError('Setup is not pending for this identity.');
    if ((await db.query('select exists(select 1 from public.organization_memberships) as present')).rows[0].present) throw new SetupError('Staff already exist. Setup refused.');
    const auth = (await db.query('select email,email_confirmed_at from auth.users where id=$1', [state.user_id])).rows[0];
    if (!auth?.email_confirmed_at || auth.email.toLowerCase() !== current.email) throw new SetupError('Confirmed Auth identity does not match pending setup.');
    const org = (await db.query('insert into public.organizations(name) values ($1) returning id', [current.organization_name])).rows[0];
    await db.query('insert into public.staff_profiles(id,full_name) values ($1,$2)', [state.user_id, current.full_name]);
    await db.query(`insert into public.organization_memberships(user_id,organization_id,role) values ($1,$2,'admin')`, [state.user_id, org.id]);
    await db.query('update crm_private.bootstrap_state set completed_at=now() where singleton=true');
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
}

import { configuration, clients, reportFailure } from './lib/operator.mjs';
let db;
try {
  const config = configuration();
  const operator = clients(config);
  db = operator.db;
  await db.connect();
  const auth = await db.query(`select count(*)::int as total,
    count(*) filter (where email_confirmed_at is not null)::int as confirmed from auth.users`);
  console.log('Auth users (counts only):', auth.rows[0]);
  for (const table of ['organizations','staff_profiles','organization_memberships']) {
    const exists = (await db.query('select to_regclass($1) as name', [`public.${table}`])).rows[0].name;
    if (!exists) { console.log(`${table}: MISSING`); continue; }
    const count = (await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count;
    const rls = (await db.query(`select relrowsecurity from pg_class where oid=$1::regclass`, [`public.${table}`])).rows[0].relrowsecurity;
    const policies = (await db.query(`select count(*)::int as count from pg_policies where schemaname='public' and tablename=$1`, [table])).rows[0].count;
    const grants = (await db.query(`select
      has_table_privilege('authenticated',$1,'SELECT') as staff_select,
      has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') as staff_write,
      has_table_privilege('anon',$1,'SELECT,INSERT,UPDATE,DELETE') as anon_access`, [`public.${table}`])).rows[0];
    console.log(`${table}: count=${count}, RLS=${rls}, policies=${policies}; grants:`, grants);
  }
  if ((await db.query("select to_regclass('public.organization_memberships') as name")).rows[0].name) {
    console.log('Active memberships by role (counts only):', (await db.query('select role,count(*)::int as count from public.organization_memberships where active group by role')).rows);
    console.log('Confirmed active staff count:', (await db.query(`select count(*)::int as count
      from public.organization_memberships m join auth.users u on u.id=m.user_id
      join public.staff_profiles p on p.id=m.user_id where m.active and u.email_confirmed_at is not null`)).rows[0].count);
  }
  console.log('No emails, passwords, tokens or connection strings were printed.');
} catch (error) { reportFailure(error); }
finally { if (db) await db.end().catch(() => {}); }

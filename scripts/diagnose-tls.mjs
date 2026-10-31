import { configuration, clients, projectUrl, reportFailure } from './lib/operator.mjs';
let config;
try { config = configuration(); } catch (error) { reportFailure(error, 'local configuration'); }
if (config) {
  console.log('Project identity: intended project confirmed.');
  console.log('PostgreSQL CA configured:', Boolean(config.setup.SUPABASE_DB_CA_FILE));
  console.log('NODE_EXTRA_CA_CERTS configured at startup:', Boolean(process.env.NODE_EXTRA_CA_CERTS));
  let db;
  try {
    ({ db } = clients(config));
    await db.connect();
    console.log('PASS: PostgreSQL TLS connection and authentication.');
  } catch (error) { reportFailure(error, 'PostgreSQL TLS/connect'); }
  finally { if (db) await db.end().catch(() => {}); }
  try {
    const response = await fetch(`${projectUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: config.setup.SUPABASE_SECRET_KEY, Authorization: `Bearer ${config.setup.SUPABASE_SECRET_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    console.log(`HTTPS Admin API: TLS verified; HTTP ${response.status}. No response data printed.`);
    if (!response.ok) process.exitCode = 1;
  } catch (error) { reportFailure(error, 'HTTPS Admin API TLS/request'); }
}

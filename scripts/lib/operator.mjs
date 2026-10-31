import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { SetupError } from './bootstrap.mjs';
import { databaseCa } from './database-ca.mjs';

export const projectUrl = 'https://mwpryrxmrdxgibgsetir.supabase.co';
export function configuration() {
  const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  const setup = existsSync('.env.setup.local') ? parseEnv(readFileSync('.env.setup.local', 'utf8')) : {};
  if (local.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== projectUrl) throw new SetupError('Intended project does not match .env.local.');
  if (!setup.SUPABASE_DB_URL || !setup.SUPABASE_SECRET_KEY) throw new SetupError('Configure SUPABASE_DB_URL and SUPABASE_SECRET_KEY in ignored .env.setup.local. Never send them in chat.');
  const uri = new URL(setup.SUPABASE_DB_URL);
  if (!['postgres:', 'postgresql:'].includes(uri.protocol) || !(
    uri.hostname === 'db.mwpryrxmrdxgibgsetir.supabase.co' ||
    (uri.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(uri.username) === 'postgres.mwpryrxmrdxgibgsetir' && uri.port === '5432')
  )) throw new SetupError('Database URL must target this project using a direct or session-pooler connection.');
  for (const key of ['sslmode','sslrootcert','sslcert','sslkey']) uri.searchParams.delete(key);
  return { local, setup, connectionString: uri.toString() };
}
export function clients(config) {
  const ca = databaseCa(config.setup.SUPABASE_DB_CA_FILE);
  const db = new pg.Client({ connectionString: config.connectionString, connectionTimeoutMillis: 15000,
    // Node verifies the certificate and hostname by default. Never opt out.
    ssl: ca ? { ca } : {} });
  const admin = createClient(projectUrl, config.setup.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return { db, admin };
}
export function reportFailure(error, stage = 'privileged operation') {
  if (error instanceof SetupError) console.error(`BLOCKED [${stage}]: ${error.message}`);
  else {
    const allowed = ['28P01','42P01','42501','23505','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'];
    let current = error;
    let code;
    for (let i = 0; current && i < 5; i++, current = current.cause) {
      if (allowed.includes(current.code)) { code = current.code; break; }
    }
    console.error(`FAILED [${stage}]: ${code ?? 'details withheld'}. No credentials or raw responses logged. See setup instructions for recovery.`);
  }
  process.exitCode = 1;
}

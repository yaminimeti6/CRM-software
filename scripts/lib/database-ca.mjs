import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { SetupError } from './bootstrap.mjs';

// The operator must obtain this file from the authenticated Supabase Dashboard.
// Parsing a certificate cannot establish its provenance; never auto-download trust.
export function validateDatabaseCa(contents) {
  try {
    const text = contents.toString('utf8');
    if (text.includes('PRIVATE KEY')) throw new Error();
    const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    const certificates = (blocks?.length ? blocks : [contents]).map(value => new X509Certificate(value));
    const now = Date.now();
    if (certificates.some(cert => !cert.ca || Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) <= now)) throw new Error();
    return certificates.map(cert => cert.toString()).join('\n');
  } catch {
    throw new SetupError('Database CA file must contain valid, unexpired CA certificates obtained from this project\'s Supabase Database settings.');
  }
}
export function databaseCa(path) {
  if (!path) return undefined;
  let contents;
  try { contents = readFileSync(path); }
  catch { throw new SetupError('SUPABASE_DB_CA_FILE cannot be read. Check the local certificate file path; environment values were preserved.'); }
  return validateDatabaseCa(contents);
}

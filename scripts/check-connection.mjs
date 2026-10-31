import fs from 'node:fs';
import { parseEnv } from 'node:util';
const env = fs.existsSync('.env.local') ? parseEnv(fs.readFileSync('.env.local', 'utf8')) : {};
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const intended = 'https://mwpryrxmrdxgibgsetir.supabase.co';
if (url?.replace(/\/$/, '') !== intended || !key) {
  console.log('BLOCKED: local configuration missing or intended project mismatch. Values withheld.');
  process.exit(2);
}
let secret = key.startsWith('sb_secret_');
try { secret ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch {}
if (secret) {
  console.log('BLOCKED: a private key is configured in a public variable. Replace it privately with a publishable key and rotate the exposed private key.');
  process.exit(2);
}
console.log('PASS: local configuration targets the intended project; no private key type detected.');
try {
  const response = await fetch(`${intended}/auth/v1/settings`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.log(`BLOCKED: Auth settings request returned HTTP ${response.status}. Values withheld.`);
    process.exitCode = 1;
  } else {
    const settings = await response.json();
    console.log('PASS: intended Supabase Auth endpoint accepts the configured API key.');
    console.log('Email provider enabled:', settings.external?.email === true);
    console.log('Public signup disabled:', settings.disable_signup === true);
    console.log('Real staff password login: NOT TESTED.');
    for (const table of ['organizations', 'staff_profiles', 'organization_memberships']) {
      const result = await fetch(`${intended}/rest/v1/${table}?select=*&limit=0`, {
        headers: { apikey: key }, signal: AbortSignal.timeout(15000),
      });
      let code; try { code = (await result.json()).code; } catch {}
      console.log(`Schema probe ${table}: HTTP ${result.status}; code ${code ?? 'none'} (no records requested).`);
    }
  }
} catch {
  console.log('BLOCKED: connection unavailable or timed out. Values withheld.');
  process.exitCode = 1;
}

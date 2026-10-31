import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export async function createSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error('Supabase configuration is missing. See README.md.');
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Server Components are read-only; proxy persists refreshed cookies. */ }
      },
    },
  });
}

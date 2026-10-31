'use server';
import { redirect } from 'next/navigation';
import { createSupabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import { staffSession } from '@/lib/auth';
import { loginFailure } from '@/lib/auth-errors';
import {privilegedTeamClient} from '@/lib/team';
import {normalizeUsername,validUsername,rateAllowed,hashSecret} from '@/lib/manual-invitations';

export async function login(_state: { error: string }, form: FormData) {
  if (!supabaseConfig()) return { error: 'Supabase is not configured. Ask your administrator to complete setup.' };
  const identifier = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if ((!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)&&!validUsername(normalizeUsername(identifier))) || identifier.length > 254 || !password || password.length > 1024) return { error: 'Enter a valid username or existing email address and password.' };
  let email=identifier;
  try{
    if(!await rateAllowed('staff-login',identifier.toLowerCase(),8,300))return {error:'Too many sign-in attempts. Please wait and try again. [AUTH_RATE_LIMIT]'};
    if(!identifier.includes('@')){
      const resolved=await privilegedTeamClient().rpc('manual_login_identity',{p_username:normalizeUsername(identifier)});
      if(resolved.error)return {error:'Sign-in is temporarily unavailable. Please try again.'};
      email=resolved.data??`unknown-${hashSecret(normalizeUsername(identifier)).slice(0,40)}@crm.invalid`;
    }
  }catch{return {error:'Sign-in is temporarily unavailable. Please try again.'};}
  const client = await createSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: loginFailure(error.code, error.status) };
  const session = await staffSession();
  if (session.status !== 'authorized') {
    await client.auth.signOut({ scope: 'local' });
    return { error: session.status === 'unavailable'
      ? 'Signed in, but staff database access could not be verified. Ask the administrator to check migrations and database permissions. [STAFF_DATABASE]'
      : 'Signed in, but no active staff membership was found. Contact the administrator for access. [STAFF_MEMBERSHIP]' };
  }
  redirect('/app');
}
export async function logout() {
  const client = await createSupabase();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) redirect('/app?logout=failed');
  redirect('/login');
}

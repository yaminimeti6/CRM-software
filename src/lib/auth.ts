import 'server-only';
import { createSupabase } from './supabase';
import { supabaseConfig } from './config';
import { isRole, type Role } from './roles';

export async function staffSession() {
  if (!supabaseConfig()) return { status: 'unconfigured' as const };
  const client = await createSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { status: 'unauthenticated' as const };
  const [profile, membership, username] = await Promise.all([
    client.from('staff_profiles').select('full_name').eq('id', user.id).maybeSingle(),
    client.from('organization_memberships').select('organization_id,role').eq('user_id', user.id).eq('active', true).maybeSingle(),
    client.rpc('own_username'),
  ]);
  if (profile.error || membership.error || username.error) return { status: 'unavailable' as const };
  if (!profile.data || !membership.data || !isRole(membership.data.role)) return { status: 'forbidden' as const };
  return { status: 'authorized' as const, user: { id: user.id, email: username.data?null:user.email, username:username.data as string|null, name: profile.data.full_name, role: membership.data.role as Role, organizationId: membership.data.organization_id } };
}

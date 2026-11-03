import {requireLeadStaff,reply} from '@/lib/lead-api';import {createSupabase} from '@/lib/supabase';import {viewFailure} from '@/lib/lead-view-api';
export const dynamic='force-dynamic';export async function GET(){const a=await requireLeadStaff();if(a.error)return a.error;const db=await createSupabase(),r=await db.rpc('lead_filter_options');return r.error?viewFailure(r.error.code):reply(r.data);}

import {createSupabase} from '@/lib/supabase';import {requireLeadStaff,reply,databaseFailure} from '@/lib/lead-api';
export async function GET(){const a=await requireLeadStaff();if(a.error)return a.error;const db=await createSupabase(),r=await db.rpc('follow_up_staff');return r.error?databaseFailure(r.error):reply(r.data);}

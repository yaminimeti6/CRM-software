import {createSupabase} from '@/lib/supabase';
import {requireAdmin,teamFailure} from '@/lib/team';
import {reply} from '@/lib/lead-api';
export const dynamic='force-dynamic';
export async function GET(){
 const access=await requireAdmin();if(access.error)return access.error;
 const db=await createSupabase(),result=await db.rpc('team_list');
 return result.error?teamFailure(result.error):reply(result.data);
}

import { createSupabase } from '@/lib/supabase';
import { requireLeadStaff,reply,readBody,sameOrigin,databaseFailure } from '@/lib/lead-api';
import { validateLeadInput,isUuid } from '@/lib/lead-input';
export const dynamic='force-dynamic';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
  const {id}=await params;if(!isUuid(id))return reply({error:'Invalid lead ID.'},400);
  let body;try{body=await readBody(request) as Record<string,unknown>;}catch{return reply({error:'Invalid JSON payload.'},400);}
  if(!body||typeof body!=='object'||!Number.isSafeInteger(body.version)||Number(body.version)<1)return reply({error:'Current lead version is required.'},400);
  const {version,...input}=body;
  const valid=validateLeadInput(input,true);if(!valid.data)return reply({error:valid.error},400);
  const db=await createSupabase();const result=await db.rpc('update_lead',{p_id:id,p_version:version,p_input:valid.data});
  return result.error?databaseFailure(result.error):reply({lead:result.data});
}

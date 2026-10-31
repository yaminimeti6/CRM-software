import {requireAdmin,privilegedTeamClient,teamFailure} from '@/lib/team';
import {reply,readBody,sameOrigin} from '@/lib/lead-api';
import {isRole} from '@/lib/roles';
import {isUuid} from '@/lib/lead-input';
export const dynamic='force-dynamic';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await requireAdmin();if(access.error)return access.error;
 if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 const {id}=await params;let body;try{body=await readBody(request) as Record<string,unknown>;}catch{return reply({error:'Invalid JSON.'},400);}
 if(!isUuid(id)||!body||Object.keys(body).some(k=>!['role','active','revision'].includes(k))||!isRole(body.role)||typeof body.active!=='boolean'||!Number.isSafeInteger(body.revision)||Number(body.revision)<1)return reply({error:'Valid role, active flag and current revision are required.'},400);
 try{const result=await privilegedTeamClient().rpc('team_update_member',{p_actor:access.user.id,p_target:id,p_role:body.role,p_active:body.active,p_revision:body.revision});return result.error?teamFailure(result.error):reply({message:'Team membership saved.'});}
 catch{return reply({error:'Team server configuration or connection is unavailable.'},503);}
}

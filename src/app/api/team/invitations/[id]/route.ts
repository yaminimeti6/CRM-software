import {requireAdmin,privilegedTeamClient,teamFailure} from '@/lib/team';import {reply,sameOrigin} from '@/lib/lead-api';import {isUuid} from '@/lib/lead-input';
export const dynamic='force-dynamic';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await requireAdmin();if(access.error)return access.error;if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);const {id}=await params;if(!isUuid(id))return reply({error:'Invalid invitation.'},400);
 try{const result=await privilegedTeamClient().rpc('manual_revoke_invitation',{p_actor:access.user.id,p_id:id});return result.error?teamFailure(result.error):reply({message:'Invitation revoked.'});}catch{return reply({error:'Revocation could not be confirmed. Reload Team.'},503);}
}

import {requireAdmin,privilegedTeamClient,teamFailure} from '@/lib/team';
import {reply,readBody,sameOrigin} from '@/lib/lead-api';
import {isRole} from '@/lib/roles';import {isUuid} from '@/lib/lead-input';
import {newInvitationSecret,hashSecret,invitationOrigin} from '@/lib/manual-invitations';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const access=await requireAdmin();if(access.error)return access.error;
 if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 let body;try{body=await readBody(request) as Record<string,unknown>;}catch{return reply({error:'Invalid JSON.'},400);}
 if(!body||Object.keys(body).some(k=>!['name','role','request_id'].includes(k))||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>200||!isRole(body.role)||typeof body.request_id!=='string'||!isUuid(body.request_id))return reply({error:'A display name, valid role and request identifier are required.'},400);
 try{
  const origin=invitationOrigin(),secret=newInvitationSecret(),hash=hashSecret(secret);
  const result=await privilegedTeamClient().rpc('manual_create_invitation',{p_actor:access.user.id,p_request:body.request_id,p_name:body.name.trim(),p_role:body.role,p_hash:hash});
  if(result.error)return teamFailure(result.error);
  const inv=Array.isArray(result.data)?result.data[0]:result.data;
  if(!inv||inv.token_hash!==hash)return reply({error:'This request already created an invitation. Its secret cannot be retrieved. Revoke it and start a new invitation if you lost the link.'},409);
  return reply({invitation_id:inv.id,link:`${origin}/join#invitation=${inv.id}.${secret}`,code:`${inv.id}.${secret}`,expires_at:inv.expires_at,message:'Invitation created. Copy it now and share it privately. No message or email was sent.'},201);
 }catch{return reply({error:'Invitation creation could not be confirmed. Reload Team before retrying.'},503);}
}

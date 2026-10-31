import {privilegedTeamClient} from '@/lib/team';import {reply,readBody,sameOrigin} from '@/lib/lead-api';import {parseInvitation,rateAllowed} from '@/lib/manual-invitations';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 try{const body=await readBody(request) as {invitation?:unknown};const parsed=parseInvitation(body?.invitation);
  if(!await rateAllowed('invite-validation',parsed?.hash??'invalid',30,300))return reply({error:'Too many attempts. Please wait before trying again.'},429);
  if(!parsed)return reply({error:'Invitation is invalid or unavailable.'},403);
  const result=await privilegedTeamClient().rpc('manual_validate_invitation',{p_id:parsed.id,p_hash:parsed.hash});if(result.error||!result.data)return reply({error:'Invitation is invalid or unavailable.'},403);
  return reply(result.data);
 }catch{return reply({error:'Invitation validation is unavailable. Please retry later.'},503);}
}

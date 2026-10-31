import {randomUUID} from 'node:crypto';
import {privilegedTeamClient,teamFailure} from '@/lib/team';import {reply,readBody,sameOrigin} from '@/lib/lead-api';import {createSupabase} from '@/lib/supabase';
import {normalizeUsername,validUsername,parseInvitation,rateAllowed} from '@/lib/manual-invitations';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 let id:string|undefined,lease:string|undefined;
 try{
  const body=await readBody(request) as Record<string,unknown>;const parsed=parseInvitation(body?.invitation);
  if(!await rateAllowed('invite-acceptance',parsed?.hash??'invalid',20,600))return reply({error:'Too many attempts. Please wait before trying again.'},429);
  if(!parsed)return reply({error:'Invitation is invalid or unavailable.'},403);
  if(!body||Object.keys(body).some(k=>!['invitation','username','password'].includes(k))||typeof body.username!=='string'||!validUsername(normalizeUsername(body.username))||typeof body.password!=='string'||body.password.length<12||body.password.length>1024)return reply({error:'Use a username of 3–32 letters, digits or underscores, starting with a letter, and a password of at least 12 characters. Role and organization cannot be supplied.'},400);
  const username=normalizeUsername(body.username),admin=privilegedTeamClient();id=parsed.id;lease=randomUUID();
  const claim=await admin.rpc('manual_claim_invitation',{p_id:id,p_hash:parsed.hash,p_username:username,p_lease:lease});
  if(claim.error)return claim.error.code==='PT409'?reply({error:'Username unavailable, setup already in progress, or this retry uses a different username. Resume with your original username/password or retry shortly.'},409):teamFailure(claim.error);
  const identity=claim.data as {user_id:string;email:string};
  const existing=await admin.auth.admin.getUserById(identity.user_id);
  if(!existing.data.user){const created=await admin.auth.admin.createUser({id:identity.user_id,email:identity.email,password:body.password,email_confirm:true});if(created.error)return reply({error:'Account setup could not finish. Retry the same invitation, username and password. No existing account was adopted or reset.'},503);}
  const client=await createSupabase();const signed=await client.auth.signInWithPassword({email:identity.email,password:body.password});
  if(signed.error||signed.data.user?.id!==identity.user_id)return reply({error:'Resume this setup with the originally chosen username and password. No password was changed.'},409);
  const finish=await admin.rpc('manual_finish_invitation',{p_id:id,p_lease:lease});
  if(finish.error){await client.auth.signOut({scope:'local'});return teamFailure(finish.error);}
  return reply({accepted:true,username});
 }catch{return reply({error:'Setup could not be confirmed. Retry the same invitation and original username/password; no existing password was reset.'},503);}
 finally{if(id&&lease)await privilegedTeamClient().rpc('manual_release_invitation',{p_id:id,p_lease:lease}).then(()=>{},()=>{});}
}

import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createHmac,timingSafeEqual} from 'node:crypto';
import nodemailer from 'nodemailer';
import {staffSession} from './auth';
import {reply} from './lead-api';
import {supabaseConfig} from './config';
import {isUuid} from './lead-input';

export async function requireAdmin(){
 const session=await staffSession();
 if(session.status!=='authorized')return {error:reply({error:'Active Admin access required.'},session.status==='unauthenticated'?401:session.status==='forbidden'?403:503)};
 if(session.user.role!=='admin')return {error:reply({error:'Admin role required.'},403)};
 return {user:session.user};
}
export function privilegedTeamClient(){
 const config=supabaseConfig(),key=process.env.SUPABASE_SECRET_KEY;
 if(!config||!key)throw new Error('Team server configuration is missing.');
 return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
}
export function inviteToken(id:string){
 const key=process.env.TEAM_INVITE_SECRET;if(!key||key.length<43)throw new Error('Invitation signing key is not configured.');
 return createHmac('sha256',key).update(`crm-team-invitation:${id}`).digest('base64url');
}
export function verifyInvitationToken(value:unknown):string|null{
 if(typeof value!=='string')return null;const [id,token,...extra]=value.split('.');
 if(!isUuid(id??'')||extra.length||!token||token.length!==43)return null;
 const expected=Buffer.from(inviteToken(id));const actual=Buffer.from(token);
 return actual.length===expected.length&&timingSafeEqual(actual,expected)?id:null;
}
export type Invitation={id:string;organization_id:string;email:string;full_name:string;role:string;reserved_user_id:string;accepted_at:string|null;accepted_by:string|null};
export function singleInvitation(value:unknown):Invitation|null{
 const row=Array.isArray(value)?value[0]:value;return row&&typeof row==='object'&&'id'in row?row as Invitation:null;
}
export function teamFailure(error:{code?:string}){
 if(error.code==='42501')return reply({error:'This action is not permitted or the team member/invitation is unavailable.'},403);
 if(error.code==='PT409')return reply({error:'The change conflicts with current team state. Keep at least one active Admin. Reload Team and retry; invitation retries must keep the same details.'},409);
 if(['22023','22P02','23514','23505'].includes(error.code??''))return reply({error:'Invalid team details or duplicate invitation.'},400);
 return reply({error:'Team request could not be completed. Retry safely; no password was reset.'},503);
}
function mailConfiguration(){
 const host=process.env.TEAM_MAIL_HOST,from=process.env.TEAM_MAIL_FROM,port=Number(process.env.TEAM_MAIL_PORT??587),origin=process.env.CRM_APP_ORIGIN;
 if(!host||!from||!origin||!Number.isInteger(port)||port<1||port>65535||/[\r\n]/.test(from))throw new Error('Mail configuration required.');
 const url=new URL(origin);
 if(url.origin!==origin||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Trusted application origin required.');
 const localTest=process.env.TEAM_MAIL_LOCAL_TEST==='true'&&['localhost','127.0.0.1'].includes(host)&&url.hostname==='localhost';
 if(!localTest&&(!process.env.TEAM_MAIL_USER||!process.env.TEAM_MAIL_PASSWORD))throw new Error('Authenticated SMTP required.');
 return {host,from,port,origin,localTest};
}
export function mailReady(){try{mailConfiguration();inviteToken('configuration-check');return true;}catch{return false;}}
export async function sendTeamInvitation(inv:Invitation){
 const config=mailConfiguration();
 if(config.localTest&&!/@(?:example\.com|[^@]+\.test)$/i.test(inv.email))throw new Error('Only reserved synthetic recipients are allowed by the local test receiver.');
 const publicConfig=supabaseConfig();if(!publicConfig)throw new Error('Configuration required.');
 const settings=await fetch(`${publicConfig.url}/auth/v1/settings`,{headers:{apikey:publicConfig.key},signal:AbortSignal.timeout(10000)});
 if(!settings.ok||(await settings.json()).disable_signup!==true)throw new Error('Public signup must remain disabled.');
 const link=`${config.origin}/join#invitation=${inv.id}.${inviteToken(inv.id)}`;
 const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:!config.localTest&&config.port===465,requireTLS:!config.localTest,
  ...(config.localTest?{}:{auth:{user:process.env.TEAM_MAIL_USER,pass:process.env.TEAM_MAIL_PASSWORD}}),connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 try{
  const sent=await transport.sendMail({from:config.from,to:inv.email,subject:'Your CRM team invitation',text:`You have been invited to join a CRM team as ${inv.role}.\n\nOpen this private link to choose your password or sign in with your existing account. It expires in 72 hours.\n\n${link}\n\nDo not forward this link. If you did not expect this invitation, ignore it.`});
  if(!sent.accepted?.length||sent.rejected?.length)throw new Error('SMTP did not accept the invitation.');
 }finally{transport.close();}
}

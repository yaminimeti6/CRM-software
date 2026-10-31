import 'server-only';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {headers} from 'next/headers';
import {privilegedTeamClient} from './team';
import {isUuid} from './lead-input';
export const normalizeUsername=(value:string)=>value.trim().toLowerCase();
export const validUsername=(value:string)=>/^[a-z][a-z0-9_]{2,31}$/.test(value);
export function newInvitationSecret(){return randomBytes(32).toString('base64url');}
export function hashSecret(secret:string){return createHash('sha256').update(secret).digest('hex');}
export function parseInvitation(value:unknown){if(typeof value!=='string')return null;const [id,secret,...rest]=value.split('.');return !rest.length&&isUuid(id??'')&&/^[A-Za-z0-9_-]{43}$/.test(secret??'')?{id,hash:hashSecret(secret)}:null;}
export function invitationOrigin(){const raw=process.env.CRM_APP_ORIGIN;if(!raw)throw new Error('Trusted application URL missing');const url=new URL(raw);if(url.origin!==raw||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Trusted application URL invalid');return raw;}
export async function rateAllowed(category:string,identity:string,limit:number,seconds:number){
 const key=process.env.TEAM_INVITE_SECRET;if(!key)throw new Error('Rate limit secret missing');
 const h=await headers();const peer=process.env.TEAM_TRUST_PROXY==='true'?(h.get('x-forwarded-for')?.split(',')[0].trim()??'shared'):'shared';
 const hash=(v:string)=>createHmac('sha256',key).update(v).digest('hex');const db=privilegedTeamClient();
 const global=await db.rpc('manual_rate_limit',{p_bucket:hash(`${category}:global:${peer}`),p_limit:120,p_seconds:60});
 if(global.error||!global.data)return false;
 const specific=await db.rpc('manual_rate_limit',{p_bucket:hash(`${category}:${identity}`),p_limit:limit,p_seconds:seconds});
 return !specific.error&&specific.data===true;
}

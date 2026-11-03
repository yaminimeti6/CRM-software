import 'server-only';
import { staffSession } from './auth';
export const noCache={'Cache-Control':'private, no-store'};
export function reply(value:unknown,status=200) { return Response.json(value,{status,headers:noCache}); }
export async function requireLeadStaff() {
  const session=await staffSession();
  if(session.status!=='authorized') return {error:reply({error:'Active staff access required.'},session.status==='unauthenticated'?401:session.status==='forbidden'?403:503)};
  if(session.user.role==='creative_analyst') return {error:reply({error:'Your role does not permit access to customer records.'},403)};
  return {user:session.user};
}
export async function readBody(request:Request):Promise<unknown> {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON required');
  const reader=request.body?.getReader(); if(!reader) throw new Error('Body required');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>50000){await reader.cancel();throw new Error('Body too large');}chunks.push(value);}
  const combined=new Uint8Array(length);let offset=0;for(const c of chunks){combined.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(combined));
}
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;
}
export function databaseFailure(error:{code?:string}) {
  if(error.code==='40001'||error.code==='PT409') return reply({error:'Someone changed this lead. Reload the table and review their changes before saving again.',conflict:true},409);
  if(error.code==='42501') return reply({error:'You do not have access to this lead.'},403);
  if(['22023','22P02','23514','23503'].includes(error.code??'')) return reply({error:'Invalid lead details or status. Review your input.'},400);
  return reply({error:'Database request failed. Please retry; contact the administrator if it continues.'},503);
}





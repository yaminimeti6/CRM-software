import {createSupabase} from '@/lib/supabase';import {requireLeadStaff,reply,databaseFailure,readBody,sameOrigin} from '@/lib/lead-api';import {isUuid} from '@/lib/lead-input';import {validateCall} from '@/lib/call-input';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await requireLeadStaff();if(access.error)return access.error;
 const {id}=await params,page=Number(new URL(request.url).searchParams.get('page')??1);
 if(!isUuid(id)||!Number.isInteger(page)||page<1||page>100000)return reply({error:'Invalid lead or page.'},400);
 const db=await createSupabase(),result=await db.rpc('lead_call_details',{p_id:id,p_page:page});
 return result.error?databaseFailure(result.error):reply(result.data);
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await requireLeadStaff();if(access.error)return access.error;if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 const {id}=await params;if(!isUuid(id))return reply({error:'Invalid lead ID.'},400);
 let body;try{body=await readBody(request);}catch{return reply({error:'Send a JSON call payload smaller than 50 KB.'},400);}
 const valid=validateCall(body);if(!valid.data)return reply({error:valid.error},400);
 const {version,request_id,follow_up,...input}=valid.data;const db=await createSupabase(),result=follow_up?await db.rpc('log_call_with_follow_up',{p_id:id,p_version:version,p_request:request_id,p_call:input,p_follow_up:follow_up}):await db.rpc('log_lead_call',{p_id:id,p_version:version,p_request:request_id,p_input:input});
 return result.error?databaseFailure(result.error):reply(result.data,result.data.replayed?200:201);
}

import {createSupabase} from '@/lib/supabase';import {requireLeadStaff,reply,databaseFailure,readBody,sameOrigin} from '@/lib/lead-api';import {isUuid} from '@/lib/lead-input';import {validateCallback} from '@/lib/follow-up-input';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await requireLeadStaff();if(access.error)return access.error;const q=new URL(request.url).searchParams,lead=q.get('lead'),page=Number(q.get('page')??1),view=q.get('view')??'pending';
 if(lead&&!isUuid(lead)||!Number.isInteger(page)||page<1||page>100000||!['pending','due_today','overdue','upcoming','all','completed','cancelled'].includes(view)||q.has('my')&&!['true','false'].includes(q.get('my')!))return reply({error:'Invalid callback filters.'},400);
 const db=await createSupabase(),r=await db.rpc('list_follow_ups',{p_view:view,p_my:q.get('my')==='true',p_lead:lead||null,p_page:page,p_counts_only:q.get('counts')==='true'});return r.error?databaseFailure(r.error):reply(r.data);
}
export async function POST(request:Request){
 const access=await requireLeadStaff();if(access.error)return access.error;if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
 let v;try{v=await readBody(request);}catch{return reply({error:'Invalid callback payload.'},400);}
 if(!v||typeof v!=='object'||Array.isArray(v))return reply({error:'Invalid callback payload.'},400);const b=v as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['lead_id','id','revision','request_id','input'].includes(k))||typeof b.lead_id!=='string'||!isUuid(b.lead_id)||typeof b.request_id!=='string'||!isUuid(b.request_id)||b.id!==null&&(typeof b.id!=='string'||!isUuid(b.id))||!Number.isInteger(b.revision)||Number(b.revision)<0||Number(b.revision)>2147483647)return reply({error:'Invalid callback identity/version. Reload before saving.'},400);
 const valid=validateCallback(b.input);if(!valid.data)return reply({error:valid.error},400);const db=await createSupabase(),r=await db.rpc('save_follow_up',{p_lead:b.lead_id,p_id:b.id,p_revision:b.revision,p_request:b.request_id,p_input:valid.data});return r.error?databaseFailure(r.error):reply(r.data,r.data.replayed?200:201);
}

import { createSupabase } from '@/lib/supabase';
import { requireLeadStaff,reply,readBody,sameOrigin,databaseFailure } from '@/lib/lead-api';
import { validateLeadInput,isUuid } from '@/lib/lead-input';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  const params=new URL(request.url).searchParams;
  const page=Number(params.get('page')??1),size=Number(params.get('size')??20),q=params.get('q')??'',status=params.get('status')??'';
  if(!Number.isInteger(page)||page<1||page>100000||![5,10,20,50].includes(size)||q.length>80||(status&&!isUuid(status)))return reply({error:'Invalid pagination or filters.'},400);
  const db=await createSupabase();
  const [leads,statuses,fields]=await Promise.all([
    db.rpc('search_leads',{p_search:q.trim(),p_status:status||null,p_offset:(page-1)*size,p_limit:size}),
    db.from('lead_statuses').select('id,label,active,is_new,category').order('sort_order').order('label'),
    db.rpc('quiz_columns'),
  ]);
  if(leads.error||statuses.error||fields.error)return databaseFailure(leads.error??statuses.error??fields.error!);
  const provenance=await db.from('lead_import_provenance').select('lead_id,historical_confirmed,source_at').in('lead_id',leads.data.leads.map((l:{id:string})=>l.id));if(provenance.error)return databaseFailure(provenance.error);
  const metadata=await db.from('lead_ingestion').select('lead_id,is_repeat,source_id,source_snapshot').in('lead_id',leads.data.leads.map((l:{id:string})=>l.id));if(metadata.error)return databaseFailure(metadata.error);
  return reply({leads:leads.data.leads.map((l:{id:string})=>({...l,is_repeat:metadata.data.find(m=>m.lead_id===l.id)?.is_repeat??false,public_inquiry:metadata.data.some(m=>m.lead_id===l.id),historical_import:provenance.data.find(p=>p.lead_id===l.id)??null,quiz_scope:(()=>{const m=metadata.data.find(v=>v.lead_id===l.id);return m?{source_id:m.source_id,form_version:m.source_snapshot.form_version??''}:null;})()})),total:leads.data.total,page,size,statuses:statuses.data,fields:fields.data});
}
export async function POST(request:Request) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
  let input;try{input=await readBody(request);}catch{return reply({error:'Send a JSON lead payload smaller than 50 KB.'},400);}
  const valid=validateLeadInput(input);if(!valid.data)return reply({error:valid.error},400);
  const db=await createSupabase();const result=await db.rpc('create_lead',{p_input:valid.data});
  return result.error?databaseFailure(result.error):reply({lead:result.data},201);
}

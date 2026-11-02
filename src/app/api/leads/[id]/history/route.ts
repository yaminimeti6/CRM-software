import { createSupabase } from '@/lib/supabase';
import { requireLeadStaff,reply,databaseFailure } from '@/lib/lead-api';
import { isUuid } from '@/lib/lead-input';
import { displayChanges } from '@/lib/history-display';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  const {id}=await params;if(!isUuid(id))return reply({error:'Invalid lead ID.'},400);
  const page=Number(new URL(request.url).searchParams.get('page')??1);
  if(!Number.isInteger(page)||page<1||page>100000)return reply({error:'Invalid page.'},400);
  const db=await createSupabase();const result=await db.from('lead_edit_history').select('*',{count:'exact'}).eq('organization_id',access.user.organizationId).eq('lead_id',id).order('version',{ascending:false}).range((page-1)*20,page*20-1);
  if(result.error)return databaseFailure(result.error);
  const [editors,statuses]=await Promise.all([
    db.rpc('lead_history_editors',{p_lead_id:id,p_editor_ids:[...new Set(result.data.map(h=>h.editor_id))]}),
    db.from('lead_statuses').select('id,label').eq('organization_id',access.user.organizationId),
  ]);
  if(editors.error||statuses.error)return databaseFailure(editors.error??statuses.error!);
  const names=new Map<string,string>(editors.data.map((e:{editor_id:string;display_name:string})=>[e.editor_id,e.display_name]));
  const statusNames=new Map<string,string>(statuses.data.map(s=>[s.id,s.label]));
  return reply({history:result.data.map(h=>({...h,editor_name:h.activity_type==='imported'?'Historical import (legacy caller not inferred)':h.editor_id===null?'Public source ingestion':names.get(h.editor_id)?.trim()||'Unavailable staff member',display_changes:displayChanges(h.changes,statusNames)})),total:result.count,page});
}

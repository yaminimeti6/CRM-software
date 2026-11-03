import { createSupabase } from '@/lib/supabase';
import { requireLeadStaff,reply,readBody,sameOrigin,databaseFailure } from '@/lib/lead-api';
import { validateLeadInput,isUuid } from '@/lib/lead-input';
import {defaultLeadView} from '@/lib/lead-view';import {leadPage} from '@/lib/lead-view-api';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  const params=new URL(request.url).searchParams;
  const page=Number(params.get('page')??1),size=Number(params.get('size')??20),q=params.get('q')??'',status=params.get('status')??'';
  if(!Number.isInteger(page)||page<1||page>100000||![5,10,20,50].includes(size)||q.length>80||(status&&!isUuid(status)))return reply({error:'Invalid pagination or filters.'},400);
  return leadPage({...defaultLeadView(q.trim()),size,statuses:status?[status]:[]},page);
}
export async function POST(request:Request) {
  const access=await requireLeadStaff();if(access.error)return access.error;
  if(!sameOrigin(request))return reply({error:'Same-origin request required.'},403);
  let input;try{input=await readBody(request);}catch{return reply({error:'Send a JSON lead payload smaller than 50 KB.'},400);}
  const valid=validateLeadInput(input);if(!valid.data)return reply({error:valid.error},400);
  const db=await createSupabase();const result=await db.rpc('create_lead',{p_input:valid.data});
  return result.error?databaseFailure(result.error):reply({lead:result.data},201);
}

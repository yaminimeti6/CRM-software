import {requireLeadStaff,readBody,reply,sameOrigin} from '@/lib/lead-api';
import {createSupabase} from '@/lib/supabase';
import {validatePerformance} from '@/lib/performance-input';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const access=await requireLeadStaff();if(access.error)return access.error;
 if(!sameOrigin(request))return reply({error:'Same-origin required.'},403);
 let input:{definition:unknown;kind?:string;page?:number;actor?:string;staff_page?:number};
 try{input=await readBody(request) as typeof input;input.definition=validatePerformance(input.definition);if(!['summary','calls','distinct_calls','confirmations','first_confirmations','reconfirmations','callbacks','completed','pending','overdue','leads','current'].includes(input.kind??'summary')||![input.page??1,input.staff_page??1].every(n=>Number.isInteger(n)&&n>=1&&n<=100000)||typeof(input.actor??'')!=='string'||(input.actor&&!/^[a-f0-9]{32}$/.test(input.actor)))throw Error('Invalid activity page.');}catch(e){return reply({error:e instanceof Error?e.message:'Invalid report request.'},400);}
 const db=await createSupabase();const r=await db.rpc('performance_report',{d:input.definition,p_kind:input.kind??'summary',p_page:input.page??1,p_actor:input.actor??'',p_staff_page:input.staff_page??1});
 if(r.error)return reply({error:r.error.code==='42501'?'Active performance access required; telecallers may view only their own activity.':['22023','22P02','22007','22008'].includes(r.error.code)?'Invalid report dates or attribution.':'Performance service unavailable. Retry; no records were changed.'},r.error.code==='42501'?403:['22023','22P02','22007','22008'].includes(r.error.code)?400:503);
 return reply(r.data);
}

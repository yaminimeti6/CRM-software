import 'server-only';import {createSupabase} from './supabase';import {reply} from './lead-api';import {validateLeadView} from './lead-view';
export function viewFailure(code?:string){return reply({error:code==='42501'?'Active operational access required; this personal view may belong to another user.':code==='PT409'||code==='23505'?'View changed or name already exists. Reload your views before retrying.':['22023','22P02','22007','22008'].includes(code??'')?'Invalid or unavailable filter/quiz reference. No filter was dropped; review the definition explicitly.':'Lead query/view service unavailable. Retry without changing your saved definition.'},code==='42501'?403:['PT409','23505'].includes(code??'')?409:['22023','22P02','22007','22008'].includes(code??'')?400:503);}
export async function leadPage(raw:unknown,page:number){
 let definition;try{definition=validateLeadView(raw);}catch(e){return reply({error:(e as Error).message},400);}
 if(!Number.isInteger(page)||page<1||page>100000)return reply({error:'Invalid page.'},400);
 const db=await createSupabase(),r=await db.rpc('advanced_lead_search',{d:definition,p_page:page});
 if(r.error)return viewFailure(r.error.code);
 // Enrich only this authorized page, using the existing session and table RLS.
 // Embedded limits apply per lead: one latest call and one earliest pending follow-up.
 const leads=r.data.leads as {id:string}[];
 if(!leads.length)return reply({...r.data,page,size:definition.size});
 const work=await db.from('leads').select('id,call_attempts(attempted_at,outcome_label,notes),follow_ups(due_at,notes)')
  .in('id',leads.map(l=>l.id)).eq('follow_ups.state','pending')
  .order('attempted_at',{referencedTable:'call_attempts',ascending:false}).order('id',{referencedTable:'call_attempts',ascending:false}).limit(1,{referencedTable:'call_attempts'})
  .order('due_at',{referencedTable:'follow_ups',ascending:true}).order('id',{referencedTable:'follow_ups',ascending:true}).limit(1,{referencedTable:'follow_ups'});
 const summaries=new Map((work.data??[]).map(row=>[row.id,{last_call:row.call_attempts[0]??null,next_follow_up:row.follow_ups[0]??null}]));
 return reply({...r.data,leads:leads.map(lead=>({...lead,work_summary:work.error?null:summaries.get(lead.id)??null})),page,size:definition.size});
}

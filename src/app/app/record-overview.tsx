import type {Lead} from './leads';
import {indiaTime} from '@/lib/crm-time';

function Details({values}:{values:Record<string,string>}){
 return <dl className="record-fields">{Object.entries(values).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function RecordOverview({lead}:{lead:Lead}){
 const o=lead.order_details,w=lead.work_summary;
 return <div className="record-overview">
  <section className="record-block"><h3>Customer</h3><Details values={{Name:lead.name,Mobile:lead.mobile_no,Address:lead.address||'Not supplied'}}/><h3>Order</h3><Details values={{Course:o?.course||'Unknown',Price:o?.price||'Unknown','Received (IST)':indiaTime(lead.created_at)}}/></section>
  <section className="record-block record-activity"><h3>Recent activity & next step</h3>{w?<>
   <div className="record-activity-item"><span className="record-activity-dot"/><div><h4>Last call</h4><p>{w.last_call?indiaTime(w.last_call.attempted_at)+' IST':'None recorded'}</p>{w.last_call&&<><strong>{w.last_call.outcome_label}</strong><p className="detail-note">{w.last_call.notes||'No call notes'}</p></>}</div></div>
   <div className="record-activity-item"><span className="record-activity-dot"/><div><h4>Next follow-up</h4><p>{w.next_follow_up?indiaTime(w.next_follow_up.due_at)+' IST':'Not scheduled'}</p>{w.next_follow_up&&<p className="detail-note">{w.next_follow_up.notes||'No follow-up notes'}</p>}</div></div>
  </>:<p>Summary unavailable. Check Calls or Follow-ups for the latest records.</p>}
  <h3>Lead notes</h3><p className="detail-note">{lead.notes||'No notes yet.'}</p></section>
  <section className="record-block record-references"><details><summary>Order references & original fields</summary><Details values={{'Order ID':o?.order_id||'Not supplied','Submission ID':o?.submission_id||'Not supplied','CRM lead ID':lead.id}}/>{lead.public_inquiry&&<details><summary>Original submitted customer fields</summary><dl className="record-fields">{Object.entries(o?.submitted_fields??{}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{typeof value==='string'?value:JSON.stringify(value)}</dd></div>)}</dl></details>}</details>
  {lead.is_repeat&&<p className="muted">Repeat inquiry: a separate submission, not a retry.</p>}
  {lead.historical_import&&<p className="muted">Historical import. Original source time: {lead.historical_import.source_at?indiaTime(lead.historical_import.source_at):'Unknown'}. Original caller/confirmation claims are not recorded call attempts.</p>}
  </section>
 </div>;
}

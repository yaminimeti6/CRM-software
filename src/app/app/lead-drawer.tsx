'use client';
import {useEffect,useRef,useState} from 'react';
import type {Lead,Status} from './leads';
import {CallPanel} from './call-panel';
import {FollowUps} from './follow-ups';
import {HistoryPanel} from './history-panel';
import {CallingControl,type Presence} from './calling-control';
import {orderTracking} from '../../lib/order-tracking';

export type LeadTab='Order'|'Source'|'Answers'|'Calls'|'Follow-ups'|'History';
export type EditorState={busy:boolean;dirty:boolean};
const tabs:LeadTab[]=['Order','Source','Answers','Calls','Follow-ups','History'];
const time=(value:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function Fields({values,humanize=false}:{values:Record<string,unknown>;humanize?:boolean}){
 const labels:Record<string,string>={form_id:'Form ID',crm_lead_id:'CRM lead ID',submission_id:'Submission ID',order_id:'Order ID',submitted_page_url:'Submitted page URL',received_at:'Received (IST)',url:'URL'};
 return Object.keys(values).length?<dl className="lead-detail-fields">{Object.entries(values).map(([key,value])=><div key={key}><dt>{humanize?(labels[key]??key.replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase())):key}</dt><dd>{typeof value==='string'?value:JSON.stringify(value)}</dd></div>)}</dl>:<p className="muted">No values supplied.</p>;
}
export function LeadDrawer({lead,statuses,initialTab,presence,onPresence,onClose,onSaved,onEditorState}:{lead:Lead;statuses:Status[];initialTab:LeadTab;presence:Presence[];onPresence:()=>void;onClose:()=>void;onSaved:()=>void;onEditorState:(state:EditorState)=>void}){
 const [tab,setTab]=useState(initialTab),[visited,setVisited]=useState<LeadTab[]>([initialTab]);
 const [callState,setCallState]=useState<EditorState>({busy:false,dirty:false}),[followState,setFollowState]=useState<EditorState>({busy:false,dirty:false});
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),closeAction=useRef(onClose);closeAction.current=onClose;
 const busy=callState.busy||followState.busy;
 useEffect(()=>{onEditorState({busy,dirty:callState.dirty||followState.dirty});},[busy,callState.dirty,followState.dirty,onEditorState]);
 function select(next:LeadTab){setTab(next);setVisited(old=>old.includes(next)?old:[...old,next]);}
 useEffect(()=>{setTab(initialTab);setVisited(old=>old.includes(initialTab)?old:[...old,initialTab]);},[initialTab]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';close.current?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closeAction.current();}
   if(event.key==='Tab'){
    const elements=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
    const first=elements[0],last=elements.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);if(previous?.isConnected)previous.focus();};
 },[]);
 const order=lead.order_details,tracking=orderTracking({...order?.answers,...order?.raw_tracking});
 return <div className="lead-drawer-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <aside ref={panel} className="lead-drawer" role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title">
   <header className="lead-drawer-heading"><div><span className="eyebrow">LEAD DETAILS</span><h2 id="lead-drawer-title">{lead.name}</h2><p>{lead.mobile_no} <span className="status-badge" data-status-category={statuses.find(s=>s.id===lead.status_id)?.category}>{statuses.find(s=>s.id===lead.status_id)?.label??'Unknown'}</span></p></div><button ref={close} className="secondary" aria-label="Close lead details" disabled={busy} onClick={onClose}>Close <span aria-hidden="true">×</span></button></header>
   <div className="lead-drawer-tabs" role="tablist" aria-label="Lead detail sections">{tabs.map((name,index)=><button key={name} id={'lead-tab-'+name} type="button" role="tab" tabIndex={tab===name?0:-1} aria-selected={tab===name} aria-controls={'lead-section-'+name} onClick={()=>select(name)} onKeyDown={event=>{const next=event.key==='ArrowRight'?tabs[(index+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):null;if(next){event.preventDefault();select(next);document.getElementById('lead-tab-'+next)?.focus();}}}>{name}</button>)}</div>
   <div className="lead-drawer-content">{visited.map(name=><div key={name} role="tabpanel" id={'lead-section-'+name} aria-labelledby={'lead-tab-'+name} hidden={tab!==name}>
    {name==='Order'&&<><h3>Customer & order</h3><Fields humanize values={{name:lead.name,mobile:lead.mobile_no,address:lead.address||'Not supplied',course:order?.course||'Unknown',price:order?.price||'Unknown',received_at:time(lead.created_at)}}/><h3>Notes</h3><p className="detail-note">{lead.notes||'No notes yet.'}</p><h3>Order references</h3><Fields humanize values={{order_id:order?.order_id||'Not supplied',submission_id:order?.submission_id||'Not supplied',crm_lead_id:lead.id}}/>{lead.public_inquiry&&<details><summary>Original submitted customer fields</summary><Fields values={order?.submitted_fields??{}}/></details>}{lead.is_repeat&&<p className="muted">Repeat inquiry: a separate submission, not a request retry.</p>}{lead.historical_import&&<p className="muted">Historical import · original source time {lead.historical_import.source_at?time(lead.historical_import.source_at):'unknown'}. Original confirmation/caller claims are not recorded CRM call attempts.</p>}<p className="muted">Use Edit row in the table to change customer details. Original website order values are preserved separately.</p></>}
    {name==='Source'&&<><h3>Website & attribution</h3><Fields humanize values={{website:order?.website||'Unknown',configured_landing_page:order?.landing_page||'Unknown',reported_traffic_source:order?.traffic_source||'Unknown',form_id:order?.form_id||'Unknown',form_version:lead.quiz_scope?.form_version||'Unknown',submitted_page_url:order?.page_url||'Not supplied'}}/><p className="muted">Website and traffic are reported, unverified values. Missing tracking remains Unknown.</p>{lead.configured_attribution&&<><h3>Configured catalog snapshot</h3><Fields humanize values={{brand:lead.configured_attribution.brand.name,product:lead.configured_attribution.product.name,landing_page:lead.configured_attribution.landing_page.name,url:lead.configured_attribution.landing_page.url||'Not supplied',language:lead.configured_attribution.landing_page.language||'Not supplied'}}/></>}<h3>Campaign & ad details</h3><Fields values={Object.fromEntries(tracking.map(item=>[item.label,item.value]))}/><details><summary>Raw tracking values</summary><Fields values={order?.raw_tracking??{}}/></details></>}
    {name==='Answers'&&<><h3>Original form answers</h3><p className="muted">Exact field names and original value types are retained.</p><Fields values={order?.answers??{}}/><h3>Current CRM answers</h3><Fields values={lead.answers}/></>}
    {name==='Calls'&&<><details className="drawer-presence"><summary>Calling Now</summary><CallingControl leadId={lead.id} presence={presence} onChanged={onPresence}/></details><CallPanel lead={lead} statuses={statuses} onSaved={onSaved} onClose={()=>select('Order')} onEditorState={setCallState}/></>}
    {name==='Follow-ups'&&<FollowUps lead={lead} onEditorState={setFollowState}/>}
    {name==='History'&&<HistoryPanel leadId={lead.id} onClose={()=>select('Order')}/>}
   </div>)}</div>
   <footer className="lead-drawer-footer">{busy?'Saving — keep this panel open.':callState.dirty||followState.dirty?'Unsaved or uncertain submission — keep your draft until resolved.':'Shared lead · no compulsory assignment'}<span>IST · Asia/Kolkata</span></footer>
  </aside>
 </div>;
}

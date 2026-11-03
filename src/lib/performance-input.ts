export type PerformanceFilter = { from:string; to:string; brand:string; product:string; landing_page:string; source:string };
export const attributionKeys=['brand','product','landing_page','source'] as const;
const dayMs=86400000;
export function periodDates(preset:string,now=new Date()):{from:string;to:string}{
 const today=new Date(now.getTime()+330*60000).toISOString().slice(0,10);const end=Date.parse(today+'T00:00:00Z');
 const offset=preset==='yesterday'?1:0;const days=preset==='7'?7:preset==='30'?30:1;
 return {from:new Date(end-(offset+days-1)*dayMs).toISOString().slice(0,10),to:new Date(end-offset*dayMs).toISOString().slice(0,10)};
}
export function validatePerformance(value:unknown):PerformanceFilter{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid report filters.');
 const v=value as Record<string,unknown>;if(Object.keys(v).some(k=>!['from','to',...attributionKeys].includes(k)))throw Error('Unsupported filter.');
 for(const k of ['from','to']){if(typeof v[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v[k] as string)||!Number.isFinite(Date.parse(v[k] as string))||new Date(Date.parse(v[k] as string)).toISOString().slice(0,10)!==v[k])throw Error('Use valid calendar dates.');}
 const from=v.from as string,to=v.to as string;if(from<'2000-01-01'||to>'2100-12-31'||to<from||(Date.parse(to)-Date.parse(from))/dayMs>365)throw Error('Choose 1 to 366 inclusive days.');
 const result:PerformanceFilter={from,to,brand:'',product:'',landing_page:'',source:''};
 for(const k of attributionKeys){const x=v[k]??'';if(typeof x!=='string'||x!==''&&x!=='unknown'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x))throw Error('Choose a valid stable attribution identity.');result[k]=x;}
 return result;
}
export const performanceDefinitions=[
 ['New leads received','Lead cohort: leads.created_at, CRM received/import time within the selected inclusive IST dates. Historical source time is separate; retries are not new leads.'],
 ['Calls and outcomes','Period activity: server attempted_at on explicit recorded attempts only. Distinct leads called counts each lead once across callers. Edits, Start Calling and callbacks add no calls.'],
 ['First confirmations / events','Period activity: server confirmed_at. First means the first observed CRM event per lead across all time; reconfirmations are later events. Inline Confirm can add an event without a call. Original first actor keeps credit. Imported historical Confirm alone adds no event, timestamp or credit.'],
 ['Currently confirmed','Current state at refresh, all matching leads regardless of received/confirmation dates. Includes historical imported Confirm; this is not period confirmation activity. Management only.'],
 ['Cohort conversion','Leads received in the selected CRM period with an observed first CRM confirmation by refresh / all leads received in that cohort. Includes confirmations after the period through refresh and ignores subsequent cancellation. N/A for an empty cohort; historical Confirm without events is not counted as observed conversion.'],
 ['Callbacks','Pending and overdue are current state (due_at before refresh), all matching leads regardless of dates. Self scope: assigned to you, or unassigned and created by you. Completed is period completion history; schedule/reschedule/complete/cancel credit belongs to the history actor, never the assignee. Closed/rescheduled history is preserved.'],
 ['Attribution and ranges','Configured snapshot IDs only, never raw advertising fields or inferred catalog. Unknown includes manual/unclassified records. Archived snapshot references remain filterable. Period dates include both endpoints in Asia/Kolkata: start midnight inclusive to midnight after the last day exclusive; maximum 366 days.'],
 ['Caller attribution','Activity is credited to server-recorded actors, including inactive/former staff. These are shared leads, not assigned ownership. No duration, revenue, attendance or quality score is inferred. Telecallers see only their own activity; organization cohort/current-confirmed metrics are unavailable in self scope.']
] as const;

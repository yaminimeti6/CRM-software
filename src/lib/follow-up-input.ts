import {isUuid} from './lead-input.ts';
export type CallbackInput={due_at:string;notes:string;assigned_to:string|null;state:'pending'|'completed'|'cancelled'};
export function indiaInput(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const date=new Date(value+'+05:30');if(!Number.isFinite(date.getTime()))return null;
 const local=new Date(date.getTime()+330*60000).toISOString().slice(0,16);return local===value&&value.slice(0,4)>='2000'&&value.slice(0,4)<='2100'?date.toISOString():null;
}
export function indiaLocal(value:string){return new Date(new Date(value).getTime()+330*60000).toISOString().slice(0,16);}
export function validateCallback(value:unknown):{data?:CallbackInput;error?:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))return{error:'Enter callback details.'};const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['due_at','notes','assigned_to','state'].includes(k)))return{error:'Protected callback fields cannot be supplied.'};
 if(typeof v.due_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.due_at)||!Number.isFinite(Date.parse(v.due_at))||new Date(v.due_at).toISOString()!==v.due_at||v.due_at.slice(0,4)<'2000'||v.due_at.slice(0,4)>'2100')return{error:'Enter a valid callback date/time in Asia/Kolkata.'};
 if(v.notes!==undefined&&(typeof v.notes!=='string'||v.notes.length>4000))return{error:'Callback notes must be text up to 4000 characters.'};
 if(v.assigned_to!==undefined&&v.assigned_to!==null&&(typeof v.assigned_to!=='string'||!isUuid(v.assigned_to)))return{error:'Choose an active caller or Unassigned.'};
 const state=v.state??'pending';if(typeof state!=='string'||!['pending','completed','cancelled'].includes(state))return{error:'Invalid callback state.'};
 return{data:{due_at:v.due_at,notes:v.notes as string??'',assigned_to:v.assigned_to as string??null,state:state as CallbackInput['state']}};
}

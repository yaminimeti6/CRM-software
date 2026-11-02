import {validateCallback,type CallbackInput} from './follow-up-input.ts';
import {isUuid} from './lead-input.ts';
export type CallSubmission={version:number;request_id:string;status_id:string;reason:string;notes:string;follow_up?:CallbackInput};
export function validateCall(value:unknown):{data?:CallSubmission;error?:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))return {error:'Enter valid call details.'};
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['version','request_id','status_id','reason','notes','follow_up'].includes(k)))return {error:'Caller, organization, time and protected fields cannot be supplied.'};
 if(!Number.isInteger(v.version)||Number(v.version)<1||Number(v.version)>2147483647||typeof v.request_id!=='string'||!isUuid(v.request_id)||typeof v.status_id!=='string'||!isUuid(v.status_id))return {error:'Select an outcome and reload the current lead before logging a call.'};
 for(const [k,max]of [['reason',500],['notes',4000]] as const)if(v[k]!==undefined&&(typeof v[k]!=='string'||(v[k] as string).length>max))return {error:`${k} must be text, maximum ${max} characters.`};
 const callback=v.follow_up===undefined?null:validateCallback(v.follow_up);if(callback&&!callback.data)return {error:callback.error};if(callback?.data?.state!=='pending'&&callback)return {error:'New callback must be pending.'};
 return {data:{version:Number(v.version),request_id:v.request_id,status_id:v.status_id,reason:v.reason as string??'',notes:v.notes as string??'',...(callback?.data?{follow_up:callback.data}:{})}};
}

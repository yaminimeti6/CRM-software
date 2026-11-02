export type HistoryChange={field:string;before:string;after:string};
export type HistoryEntry={id:string;edited_at:string;version:number;editor_name:string;activity_type?:'created'|'edit'|'call'|null;display_changes:HistoryChange[]};
const labels:Record<string,string>={name:'Name',mobile_no:'Mobile',address:'Address',notes:'Notes',status_id:'Status'};
function object(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function text(value:unknown):string{
  if(value===null||value===undefined)return 'Not set';
  if(value==='')return 'Empty';
  if(['string','number','boolean'].includes(typeof value))return String(value);
  return 'Value unavailable';
}
export function displayChanges(value:unknown,statuses:ReadonlyMap<string,string>):HistoryChange[]{
  const result:HistoryChange[]=[];
  for(const [key,raw]of Object.entries(object(value))){
    const change=object(raw);
    if(key==='answers'){
      const before=object(change.before),after=object(change.after);
      for(const question of new Set([...Object.keys(before),...Object.keys(after)])){
        if(before[question]!==after[question])result.push({field:`Quiz: ${question}`,before:text(before[question]),after:text(after[question])});
      }
    }else{
      const resolve=(v:unknown)=>key==='status_id'?(v==null?'Not set':statuses.get(String(v))??'Unavailable status'):text(v);
      result.push({field:labels[key]??key.replaceAll('_',' '),before:resolve(change.before),after:resolve(change.after)});
    }
  }
  return result;
}

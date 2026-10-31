export type LeadInput = { name: string; mobile_no: string; address: string; notes: string; answers: Record<string,string>; status_id?: string };
export function validateLeadInput(value: unknown, editing = false): { data?: LeadInput; error?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {error:'Enter valid lead details.'};
  const v=value as Record<string,unknown>;
  const allowed=['name','mobile_no','address','notes','answers',...(editing?['status_id']:[])];
  if(Object.keys(v).some(k=>!allowed.includes(k))) return {error:'Protected or unknown fields cannot be changed.'};
  if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>200) return {error:'Name is required (maximum 200 characters).'};
  if(typeof v.mobile_no!=='string'||!/^\+?[0-9 ()-]{6,25}$/.test(v.mobile_no.trim())||!/^\d{6,20}$/.test(v.mobile_no.replace(/\D/g,''))) return {error:'Enter a mobile number with 6–20 digits; +, spaces, parentheses and hyphens are allowed.'};
  for(const [key,max] of [['address',2000],['notes',4000]] as const) if(v[key]!==undefined&&(typeof v[key]!=='string'||(v[key] as string).length>max)) return {error:`${key} must be text, maximum ${max} characters.`};
  const a=v.answers??{};
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length>30) return {error:'Use at most 30 dynamic question/value pairs.'};
  if(Object.entries(a).some(([k,val])=>!k.trim()||k.length>80||typeof val!=='string'||val.length>1000)) return {error:'Question names must be 1–80 characters and answers at most 1000 characters.'};
  if(new TextEncoder().encode(JSON.stringify(a)).length>30000) return {error:'Quiz answers are too large.'};
  if(v.status_id!==undefined&&(typeof v.status_id!=='string'||!isUuid(v.status_id))) return {error:'Select a valid status.'};
  return {data:{name:v.name.trim(),mobile_no:v.mobile_no.trim(),address:(v.address as string)??'',notes:(v.notes as string)??'',answers:a as Record<string,string>,...(v.status_id?{status_id:v.status_id as string}:{})}};
}
export function isUuid(v:string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

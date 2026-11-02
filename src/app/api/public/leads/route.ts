import {body,source,limited,validChallenge,ingestionDb,cors} from '@/lib/ingestion';import {normalizeInquiry} from '@/lib/ingestion-input';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function OPTIONS(request:Request){const origin=request.headers.get('origin'),form=new URL(request.url).searchParams.get('form_id')??'';try{const s=await source(form),allowed=!!origin&&!!s?.enabled&&s.allowed_origins.includes(origin);return new Response(null,{status:allowed?204:403,headers:cors(origin,allowed)});}catch{return new Response(null,{status:503,headers:cors(origin,false)});}}
export async function POST(request:Request){let form=new URL(request.url).searchParams.get('form_id')??'',allowed=false;const origin=request.headers.get('origin');const respond=async(status:number,code:string,message:string)=>{if(/^[-a-zA-Z0-9_]{8,100}$/.test(form)){try{await ingestionDb().rpc('ingestion_rejected',{p_form:form});}catch{}}return Response.json({ok:false,error:{code,message}},{status,headers:cors(origin,allowed)});};
 try{
 if(!await limited(request,'edge'))return respond(429,'RATE_LIMIT','Too many requests. Wait before retrying.');
 let input;try{input=await body(request);}catch(e){return respond(e instanceof Error&&e.message==='Payload exceeds 32 KB.'?413:400,'INVALID_PAYLOAD','Send a valid JSON/form object of at most 32 KB.');}form=typeof input.form_id==='string'?input.form_id:'';
 if(!/^[-a-zA-Z0-9_]{8,100}$/.test(form))return respond(400,'INVALID_SOURCE','A registered form identifier is required.');
 const config=await source(form);allowed=!!origin&&!!config?.allowed_origins.includes(origin);if(!config?.enabled||!allowed)return respond(403,'SOURCE_UNAVAILABLE','Source disabled, unavailable or origin not permitted.');
 if(!await limited(request,form))return respond(429,'RATE_LIMIT','Too many requests. Wait before retrying the same submission.');
 if(input.website!==undefined&&input.website!==''||!validChallenge(input.challenge,form))return respond(400,'BOT_CHECK','Refresh the form verification and wait one second before submitting.');
 let data;try{data=normalizeInquiry(input);if(input.form_version!==undefined&&input.form_version!==config.form_version)throw Error('Form version does not match the registered source.');}catch(e){return respond(400,'VALIDATION',e instanceof Error?e.message:'Invalid inquiry.');}
 const r=await ingestionDb().rpc('ingest_public_lead',{p_form:form,p_submission:data.submission_id,p_origin:origin,p_original:data.original,p_lead:data.lead,p_metadata:data.metadata});
 if(r.error)return respond(r.error.code==='PT409'?409:r.error.code==='42501'?403:503,r.error.code==='PT409'?'IDEMPOTENCY_CONFLICT':'NOT_COMMITTED',r.error.code==='PT409'?'Submission or reliable external identity conflicts with existing/imported content. Existing CRM data is preserved.':'Inquiry was not confirmed. Retry the same submission safely.');
 return Response.json({ok:true,...r.data},{status:r.data.replayed?200:201,headers:cors(origin,allowed)});
 }catch{return respond(503,'UNAVAILABLE','Submission service unavailable. Keep the same submission ID and retry later.');}
}

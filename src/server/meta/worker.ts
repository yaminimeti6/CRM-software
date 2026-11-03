import {GraphReadClient,MetaError,normalizePage,requestFor,stages,unseal,type MetaConfig}from'./core.ts';
export type Query={query:(sql:string,params?:unknown[])=>Promise<{rows:Record<string,any>[]}>};
export async function workerStep(db:Query,config:MetaConfig,provider=new GraphReadClient(config)){
 const job=(await db.query('select public.crm_meta_claim() r')).rows[0]?.r;if(!job)return false;
 try{if(job.stage===5){await db.query('select public.crm_meta_publish($1,$2)',[job.id,job.lease]);return true;}
 const token=unseal(job.ciphertext,config.key,job.organization_id);const page=await provider.page(job.account_id+'/'+stages[job.stage],token,requestFor(job),job.cursor);const rows=normalizePage(job.stage,page.rows,job.currency);
 await db.query('select public.crm_meta_page($1,$2,$3,$4,$5,$6)',[job.id,job.lease,job.stage,job.cursor,page.after,JSON.stringify(rows)]);return true;
 }catch(e){if(e&&typeof e==='object'&&'code'in e&&(e.code==='PT409'||e.code==='40001'))return true;const code=e instanceof MetaError?e.code:'worker_error';try{await db.query('select public.crm_meta_retry($1,$2,$3,$4)',[job.id,job.lease,code,e instanceof MetaError?e.retryAfter:0]);}catch{/* Fenced/disconnected work cannot publish. No raw diagnostics. */}return true;}
}

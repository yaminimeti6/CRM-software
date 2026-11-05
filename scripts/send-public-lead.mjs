// Anonymous HTTP client: no environment files, staff login, API key or DB access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function sendPublicLead({base,origin,inquiry,encoded=false}) {
  const query='?form_id='+encodeURIComponent(inquiry.form_id);
  const challengeResponse=await fetch(base+'/api/public/lead-challenge'+query,{
    headers:{Origin:origin},signal:AbortSignal.timeout(30000)
  });
  const verification=await challengeResponse.json();
  if(!challengeResponse.ok)return {stage:'challenge',status:challengeResponse.status,body:verification};
  await new Promise(resolve=>setTimeout(resolve,Math.max(1100,verification.min_wait_ms??1000)));
  const payload={...inquiry,challenge:verification.challenge,website:''};
  const body=encoded?new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,k==='answers'?JSON.stringify(v):String(v)])):JSON.stringify(payload);
  const response=await fetch(base+'/api/public/leads'+query,{
    method:'POST',headers:{Origin:origin,'Content-Type':encoded?'application/x-www-form-urlencoded':'application/json'},
    body,signal:AbortSignal.timeout(30000)
  });
  return {stage:'submit',status:response.status,body:await response.json()};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const inquiry=JSON.parse(readFileSync(process.argv[2]??'examples/public-lead.synthetic.json','utf8'));
    const base=process.argv[3]??'http://localhost:3000',origin=process.argv[4]??'http://localhost:3000';
    const result=await sendPublicLead({base,origin,inquiry});
    console.log(JSON.stringify(result,null,2));
    if(result.status!==200&&result.status!==201)process.exitCode=1;
  }catch{
    console.error('Request not confirmed. Preserve the same input file/UUID and retry; inspect local connectivity/configuration.');
    process.exitCode=1;
  }
}

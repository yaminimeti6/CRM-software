// Inspect the exact Git index. Never print matched credentials or file contents.
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {parseEnv} from 'node:util';
const git=(args)=>execFileSync('git',['-c',`safe.directory=${realpathSync(process.cwd()).replaceAll('\\','/')}`,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
const secrets=[];
for(const file of ['.env.local','.env.setup.local','.env.integration.local']){
 if(!existsSync(file))continue;
 for(const [key,value]of Object.entries(parseEnv(readFileSync(file,'utf8')))){
  if(!key.startsWith('NEXT_PUBLIC_')&&/SECRET|PASSWORD|TOKEN|DB_URL|PRIVATE|API_KEY/.test(key)&&value.length>=8&&!/YOUR_|REPLACE_/.test(value)){
   secrets.push(value);if(key==='SUPABASE_DB_URL'){try{const p=decodeURIComponent(new URL(value).password);if(p.length>=8)secrets.push(p);}catch{}}
  }
 }
}
const paths=git(['diff','--cached','--name-only','--diff-filter=ACMR','-z']).split('\0').filter(Boolean);
let failed=false;
for(const path of paths){
 if(/(^|\/)(node_modules|\.next[^/]*|dist|build|out|coverage)(\/|$)/.test(path)||/(^|\/)\.env(?!\.example$)/.test(path)||/\.(pem|key|p12|pfx)$/.test(path)){
  console.error(`FAIL: forbidden staged path ${path}`);failed=true;continue;
 }
 const text=git(['show',`:${path}`]);
 if(secrets.some(value=>text.includes(value))||/sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{30}/.test(text)){
  console.error(`FAIL: possible private credential in ${path}; value withheld.`);failed=true;
 }
}
if(failed)process.exitCode=1;else console.log(`PASS: ${paths.length} staged files scanned; no configured private secrets, private-key material, forbidden env files or build/dependency artifacts detected.`);

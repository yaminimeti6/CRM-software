// Append missing server-only configuration. Never print secrets or replace values.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
const file='.env.local';let text=existsSync(file)?readFileSync(file,'utf8'):'';
const current=parseEnv(text),setup=existsSync('.env.setup.local')?parseEnv(readFileSync('.env.setup.local','utf8')):{};
const values={SUPABASE_SECRET_KEY:setup.SUPABASE_SECRET_KEY,TEAM_INVITE_SECRET:randomBytes(32).toString('hex'),CRM_APP_ORIGIN:'http://localhost:3000'};
for(const [key,value]of Object.entries(values)){
 if(Object.hasOwn(current,key)){console.log(`Preserved existing ${key} (value withheld).`);continue;}
 if(!value){console.log(`Missing ${key}: enter it locally in .env.local; never chat.`);continue;}
 text+=(text.endsWith('\n')||!text?'':'\n')+key+'='+value+'\n';console.log(`Added missing server-only ${key} (value withheld).`);
}
writeFileSync(file,text);console.log('SMTP was not configured; no mail sent.');

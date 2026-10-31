import {readFileSync,readdirSync} from 'node:fs';import {parseEnv} from 'node:util';
const values=parseEnv(readFileSync('.env.local','utf8'));
const secrets=['SUPABASE_SECRET_KEY','TEAM_INVITE_SECRET'].map(k=>values[k]).filter(v=>v&&v.length>20);
const root=process.env.CRM_BROWSER_BUILD_DIR??`${process.env.CRM_NEXT_DIST_DIR??'.next'}/static`;
let checked=0,leak=false;
function scan(path){for(const entry of readdirSync(path,{withFileTypes:true})){const file=`${path}/${entry.name}`;if(entry.isDirectory())scan(file);else if(/\.(js|map)$/.test(entry.name)){const data=readFileSync(file);checked++;if(secrets.some(secret=>data.includes(Buffer.from(secret))))leak=true;}}}
try{scan(root);if(leak||secrets.length<2||checked===0){console.error('FAIL: browser secret scan; values withheld.');process.exitCode=1;}else console.log(`PASS: ${checked} browser JS/map files scanned; configured privileged key and Team server secret are absent.`);}catch{console.error('BLOCKED: build browser assets first; values withheld.');process.exitCode=1;}

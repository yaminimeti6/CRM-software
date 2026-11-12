// Presence-only checks. Never prints configuration values or sends network requests.
import {existsSync,readFileSync}from 'node:fs';import {parseEnv}from 'node:util';import {spawnSync}from 'node:child_process';
const env={...(existsSync('.env.local')?parseEnv(readFileSync('.env.local','utf8')):{}),...process.env};
const origin=(()=>{try{const u=new URL(env.CRM_APP_ORIGIN??'');return u.protocol==='https:'&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}})();
const tools=Object.fromEntries(['pg_dump','pg_restore','psql'].map(name=>[name,spawnSync(name,['--version'],{stdio:'ignore',windowsHide:true}).status===0]));
const report={public_https_origin_configured:origin,production_host_selected:false,otp_provider_selected:false,postgres_backup_tools:tools,restore_target_configured:!!env.CRM_RESTORE_DATABASE_URL,meta_worker_configured:!!env.META_WORKER_DATABASE_URL,public_https_verified:false,actual_otp_verified:false,backup_restore_verified:false};
console.log(JSON.stringify(report,null,2));
if(!origin||!Object.values(tools).every(Boolean)||!report.restore_target_configured)process.exitCode=2;

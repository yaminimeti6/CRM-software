// Read-only verification of existing saved Notes history. No fixtures or edits.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {configuration,clients,reportFailure} from './lib/operator.mjs';
import {displayChanges} from '../src/lib/history-display.ts';
let db;
try{
 ({db}=clients(configuration()));await db.connect();
 await db.query('begin read only');
 const saved=(await db.query(`select h.*,p.full_name from public.lead_edit_history h
  left join public.staff_profiles p on p.id=h.editor_id
  where h.version>1 and h.changes ? 'notes'
  order by h.edited_at desc,h.id desc limit 1`)).rows[0];
 if(!saved){console.log('UNVERIFIED: no existing Notes edit found; no records created or modified.');process.exitCode=2;}
 else{
  const beforeHash=createHash('sha256').update(JSON.stringify(saved)).digest('hex');
  const statuses=(await db.query('select id,label from public.lead_statuses where organization_id=$1',[saved.organization_id])).rows;
  const formatted=displayChanges(saved.changes,new Map(statuses.map(s=>[s.id,s.label])));
  const note=formatted.find(c=>c.field==='Notes');assert.ok(note);
  const expected=v=>v==null?'Not set':v===''?'Empty':String(v);
  assert.equal(note.before,expected(saved.changes.notes.before));assert.equal(note.after,expected(saved.changes.notes.after));
  // Use the existing actor's RLS context in a read-only transaction. No Auth
  // credentials, new accounts, token generation or membership changes are needed.
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[saved.editor_id]);
  await db.query('set local role authenticated');
  const names=(await db.query('select * from public.lead_history_editors($1,$2::uuid[])',[saved.lead_id,[saved.editor_id]])).rows;
  assert.equal(names[0]?.display_name,saved.full_name);
  const paged=(await db.query('select id,version from public.lead_edit_history where lead_id=$1 order by version desc limit 20',[saved.lead_id])).rows;
  assert.ok(paged.every((h,i)=>i===0||paged[i-1].version>h.version));
  await db.query('reset role');
  const after=(await db.query(`select h.*,p.full_name from public.lead_edit_history h left join public.staff_profiles p on p.id=h.editor_id where h.id=$1`,[saved.id])).rows[0];
  assert.equal(createHash('sha256').update(JSON.stringify(after)).digest('hex'),beforeHash);
  console.log('PASS: existing saved Notes before/after text matches readable presentation exactly; editor name matches actual same-organization staff profile; newest-first ordering verified; selected audit record unchanged. No private note text or identity printed.');
 }
 await db.query('rollback');
}catch(error){reportFailure(error,'read-only saved Notes verification');}
finally{if(db)await db.end().catch(()=>{});}

'use client';
import {useEffect,useRef,useState} from 'react';
import type {HistoryEntry} from '@/lib/history-display';
const formatTime=(value:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function HistoryPanel({leadId,onClose}:{leadId:string;onClose:()=>void}){
  const [entries,setEntries]=useState<HistoryEntry[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{closeButton.current?.focus();},[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    void fetch(`/api/leads/${leadId}/history?page=${page}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to load history.');
      if(!controller.signal.aborted){setEntries(data.history);setTotal(data.total);}
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load history.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[leadId,page]);
  return <section className="history-panel" aria-label="Lead history" aria-busy={loading}>
    <div className="history-heading"><h2>Lead history</h2><button ref={closeButton} className="secondary" onClick={onClose}>Close history</button></div>
    <p>Newest changes first · Asia/Kolkata (IST)</p>
    {loading?<p role="status">Loading history…</p>:error?<p role="alert">{error}</p>:entries.length===0?<p>No recorded history is available.</p>:<ol className="history-list">{entries.map(entry=><li key={entry.id}>
      <h3>{entry.version===1?'Lead created':'Lead updated'}</h3>
      <p><strong>{entry.editor_name}</strong> · <time dateTime={entry.edited_at}>{formatTime(entry.edited_at)} IST</time></p>
      {entry.display_changes.length>0?<table className="history-changes" aria-label={`Changes in version ${entry.version}`}><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{entry.display_changes.map((change,index)=><tr key={index}><th scope="row">{change.field}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table>:<p>No field details were recorded.</p>}
    </li>)}</ol>}
    <nav className="pagination" aria-label="History pages"><button disabled={loading||page===1} onClick={()=>setPage(page-1)}>Previous history</button><span>Page {page} of {Math.max(1,Math.ceil(total/20))}</span><button disabled={loading||page*20>=total} onClick={()=>setPage(page+1)}>Next history</button></nav>
  </section>;
}

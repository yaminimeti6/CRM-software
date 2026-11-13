import {splitAnswers} from '@/lib/answer-display';
function Value({value}:{value:unknown}){
 if(typeof value==='string'&&/^[\[{]/.test(value.trim())){
  try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return <Value value={parsed}/>;}catch{/* Literal answer text remains literal. */}
 }
 if(value===null||value===undefined||value==='')return <span>Not supplied</span>;
 if(typeof value==='boolean')return <span>{value?'Yes':'No'}</span>;
 if(Array.isArray(value))return value.length?<ul>{value.map((v,i)=><li key={i}><Value value={v}/></li>)}</ul>:<span>No selections</span>;
 if(typeof value==='object')return <Answers values={value as Record<string,unknown>}/>;
 return <span>{String(value)}</span>;
}
function Answers({values}:{values:Record<string,unknown>}){
 return <dl className="lead-detail-fields customer-answer-values">{Object.entries(values).map(([key,value])=><div key={key}><dt>{key.replace(/[_-]/g,' ')}</dt><dd><Value value={value}/></dd></div>)}</dl>;
}
export function CustomerAnswers({original,current}:{original:Record<string,unknown>;current:Record<string,unknown>}){
 const supplied=splitAnswers(original),saved=splitAnswers(current);
 return <><h3>Customer answers</h3><p className="muted">Original answers from the submitted form.</p>{Object.keys(supplied.customer).length?<Answers values={supplied.customer}/>:<p>No additional customer answers supplied.</p>}
 <details><summary>Current saved answers</summary><Answers values={saved.customer}/></details>
 <details className="technical-answer-details"><summary>Order & tracking fields</summary><p>Reported metadata, kept separately from customer answers. Original values are preserved.</p><h4>Original submitted values</h4><Answers values={supplied.details}/><h4>Current saved values</h4><Answers values={saved.details}/><details><summary>Original answer values (advanced)</summary><pre>{JSON.stringify({original,current},null,2)}</pre></details></details></>;
}

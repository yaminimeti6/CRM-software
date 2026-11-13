import {statusHelp} from '@/lib/status-help';
export function StatusLegend({statuses}:{statuses:{id:string;label:string;category:string;active:boolean}[]}){
 return <details className="status-legend"><summary>What do the statuses mean?</summary><dl>{statuses.filter(s=>s.active).map(s=><div key={s.id}><dt>{s.label}</dt><dd>{statusHelp(s)}</dd></div>)}</dl></details>;
}

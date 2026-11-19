// Presentation only: preserve persisted status identities, labels and reporting categories.
export function managedStatusColor(status?:{category:string;is_new?:boolean}):string{
 if(status?.is_new||status?.category==='new')return '#3b82f6';
 if(status?.category==='confirmed')return '#16a34a';
 if(status?.category==='cancelled')return '#dc2626';
 return '#d97706';
}

export const leadColumnLabels={name:'Name',mobile:'Mobile',status:'Status',course:'Course / price',source:'Website / landing page',traffic:'Reported traffic source',received:'Received (IST)',address:'Address',notes:'Notes',actions:'Actions'} as const;
export type LeadColumn=keyof typeof leadColumnLabels;
export const defaultLeadColumns=Object.keys(leadColumnLabels) as LeadColumn[];
export const defaultColumnWidths:Record<LeadColumn,number>={name:220,mobile:150,status:140,course:180,source:220,traffic:180,received:180,address:200,notes:180,actions:180};
export type ColumnLayout={order:LeadColumn[];hidden:LeadColumn[];widths:Partial<Record<LeadColumn,number>>;quiz:string[]};
export const defaultColumnLayout=():ColumnLayout=>({order:[...defaultLeadColumns],hidden:[],widths:{},quiz:[]});
export function validateColumnLayout(raw:unknown):ColumnLayout{
 const v=(raw&&typeof raw==='object'&&!Array.isArray(raw)?{quiz:[],...raw}:raw) as ColumnLayout;if(!v||Object.keys(v).sort().join(',')!=='hidden,order,quiz,widths'||!Array.isArray(v.order)||v.order.length!==defaultLeadColumns.length||new Set(v.order).size!==v.order.length||v.order.some(k=>!defaultLeadColumns.includes(k))||v.order[0]!=='name'||v.order[1]!=='mobile'||v.order.at(-1)!=='actions')throw Error('Keep Name and Mobile first and Actions last; include each column once.');
 if(!Array.isArray(v.hidden)||new Set(v.hidden).size!==v.hidden.length||v.hidden.some(k=>!defaultLeadColumns.includes(k)||['name','mobile','actions'].includes(k))||!v.widths||typeof v.widths!=='object'||Array.isArray(v.widths)||Object.entries(v.widths).some(([k,n])=>!defaultLeadColumns.includes(k as LeadColumn)||!Number.isInteger(n)||n<100||n>600))throw Error('Invalid column visibility or width (100?600px).');if(!Array.isArray(v.quiz)||v.quiz.length>100||new Set(v.quiz).size!==v.quiz.length||v.quiz.some(x=>typeof x!=='string'||x.length>100))throw Error('Choose up to 100 distinct answer columns.');return v;
}

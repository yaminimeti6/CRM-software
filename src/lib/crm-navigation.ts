import type {Role} from './roles';
export type CrmTheme='light'|'dark'|'mixed';
export const crmThemes:CrmTheme[]=['light','dark','mixed'];
export const normalizeCrmTheme=(value:unknown):CrmTheme=>crmThemes.includes(value as CrmTheme)?value as CrmTheme:'mixed';
export type NavigationItem={href:string;label:string;icon:string};
export function crmNavigation(role:Role):{label:string;items:NavigationItem[]}[]{
 const operational=role!=='creative_analyst';
 return [
  {label:'Workspace',items:[{href:'/app',label:'All Leads',icon:'leads'},...(operational?[{href:'/app/follow-ups',label:'Follow-ups',icon:'calendar'}]:[])]},
  {label:'Reports',items:[...(operational?[{href:'/app/performance',label:'Performance',icon:'chart'}]:[]),...(role!=='telecaller'?[{href:'/app/attribution',label:'Attribution',icon:'target'},{href:'/app/meta-spend',label:'Meta spend',icon:'chart'}]:[])]},
  {label:'Admin / Settings',items:role==='admin'?[
   {href:'/app/team',label:'Team & invitations',icon:'team'},
   {href:'/app/ingestion',label:'Lead sources',icon:'source'},
   {href:'/app/catalog',label:'Products & brands',icon:'catalog'},
   {href:'/app/imports',label:'Imports',icon:'import'},
   {href:'/app/meta',label:'Meta settings',icon:'settings'},
  ]:[]},
 ].filter(group=>group.items.length);
}

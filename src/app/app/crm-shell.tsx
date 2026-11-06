'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {crmNavigation,crmThemes,normalizeCrmTheme,type CrmTheme} from '@/lib/crm-navigation';
import {roleLabels,type Role} from '@/lib/roles';

export function CrmIcon({name}:{name:string}){
 const paths:Record<string,ReactNode>={
  leads:<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
  chart:<><path d="M4 3v17h17M8 15v-4m5 4V7m5 8v-6"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  team:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/></>,
  source:<><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 11 10-5M7 13l10 5"/></>,
  catalog:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  import:<><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></>,
  settings:<><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
  collapse:<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-12-4 4 4 4"/></>,
  close:<path d="m6 6 12 12M6 18 18 6"/>,
  light:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  dark:<path d="M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z"/>,
  mixed:<><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/></>,
  bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  chevron:<path d="m8 10 4 4 4-4"/>,
 };
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]??paths.leads}</svg>;
}

function ReminderMenu(){
 const [counts,setCounts]=useState<{due_today:number;overdue:number;pending:number}|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;async function load(){try{const response=await fetch('/api/follow-ups?counts=true',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error();if(live){setCounts(data.counts);setError(false);}}catch{if(live)setError(true);}}void load();const timer=setInterval(load,60000);return()=>{live=false;clearInterval(timer);};},[]);
 return <details className="crm-top-menu"><summary aria-label="Callback reminders" title="Callback reminders"><CrmIcon name="bell"/><span className="crm-reminder-label">Reminders</span><span className="crm-reminder-count">{error?'!':counts?.pending??'–'}</span></summary><div className="crm-menu-content"><strong>Follow-ups</strong>{error?<p role="alert">Reminders unavailable. Open Follow-ups to check.</p>:<><a href="/app/follow-ups?view=due_today">Due today <b>{counts?.due_today??'–'}</b></a><a href="/app/follow-ups?view=overdue">Overdue <b>{counts?.overdue??'–'}</b></a><a href="/app/follow-ups?view=pending">All pending <b>{counts?.pending??'–'}</b></a></>}<small>IST · updates while the app is open. Today and Overdue may overlap.</small></div></details>;
}

type User={name:string;email?:string|null;username?:string|null;role:Role;organizationId:string};
export function CrmShell({user,logoutAction,children}:{user:User;logoutAction:()=>Promise<void>;children:ReactNode}){
 const pathname=usePathname(),[theme,setTheme]=useState<CrmTheme>('mixed'),[collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[mobileOpen,setMobileOpen]=useState(false);
 const side=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null);
 function closeNavigation(){setMobileOpen(false);requestAnimationFrame(()=>menuButton.current?.focus());}
 const groups=crmNavigation(user.role),current=groups.flatMap(group=>group.items).find(item=>item.href===pathname);
 useEffect(()=>{
  try{setTheme(normalizeCrmTheme(localStorage.getItem('crm.ui.theme.v1')));setCollapsed(localStorage.getItem('crm.ui.sidebar.v1')==='collapsed');}catch{}
  const query=matchMedia('(max-width: 900px)');const resize=()=>{setMobile(query.matches);if(!query.matches)setMobileOpen(false);};resize();query.addEventListener('change',resize);
  const storage=(event:StorageEvent)=>{if(event.key==='crm.ui.theme.v1')setTheme(normalizeCrmTheme(event.newValue));if(event.key==='crm.ui.sidebar.v1')setCollapsed(event.newValue==='collapsed');};window.addEventListener('storage',storage);
  return()=>{query.removeEventListener('change',resize);window.removeEventListener('storage',storage);};
 },[]);
 useEffect(()=>{
  if(!mobileOpen)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';side.current?.querySelector<HTMLElement>('button')?.focus();
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){closeNavigation();}if(event.key==='Tab'){const items=Array.from(side.current?.querySelectorAll<HTMLElement>('a[href],button')??[]).filter(item=>item.getClientRects().length>0);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}}};document.addEventListener('keydown',keyboard);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keyboard);};
 },[mobileOpen]);
 function chooseTheme(next:CrmTheme){setTheme(next);try{localStorage.setItem('crm.ui.theme.v1',next);}catch{}}
 function toggleSidebar(){const next=!collapsed;setCollapsed(next);try{localStorage.setItem('crm.ui.sidebar.v1',next?'collapsed':'expanded');}catch{}}
 const initials=user.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'U';
 return <div className="crm-shell" data-crm-theme={theme} data-collapsed={collapsed} data-mobile-open={mobileOpen}>
  <a className="crm-skip-link" href="#crm-page-content">Skip to content</a>
  {mobileOpen&&<button className="crm-mobile-backdrop" aria-label="Close navigation backdrop" onClick={()=>{closeNavigation();}}/>}
  <aside ref={side} className="crm-sidebar" role={mobileOpen?'dialog':undefined} aria-modal={mobileOpen||undefined} aria-label="Main navigation" inert={mobile&&!mobileOpen}>
   <div className="crm-brand"><span className="crm-brand-mark"><CrmIcon name="leads"/></span><div className="crm-sidebar-text"><strong>Staff CRM</strong><span>Team workspace</span></div><button className="crm-mobile-close crm-icon-button" aria-label="Close navigation" onClick={()=>{closeNavigation();}}><CrmIcon name="close"/></button></div>
   <nav>{groups.map(group=><div className="crm-nav-group" key={group.label}><p className="crm-nav-caption">{group.label}</p>{group.items.map(item=><a key={item.href} href={item.href} title={collapsed?item.label:undefined} aria-label={item.label} aria-current={pathname===item.href?'page':undefined}><CrmIcon name={item.icon}/><span className="crm-sidebar-text">{item.label}</span>{pathname===item.href&&<span className="crm-active-dot"/>}</a>)}</div>)}</nav>
   <div className="crm-sidebar-bottom"><div className="crm-sidebar-workspace"><span className="crm-avatar">{initials}</span><span className="crm-sidebar-text"><strong>{user.name}</strong><small>{roleLabels[user.role]}</small></span></div><button className="crm-collapse-button" onClick={toggleSidebar} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} title={collapsed?'Expand sidebar':'Collapse sidebar'}><CrmIcon name="collapse"/><span className="crm-sidebar-text">Collapse sidebar</span></button></div>
  </aside>
  <div className="crm-main" inert={mobileOpen}><header className="crm-topbar"><div className="crm-page-heading"><button ref={menuButton} className="crm-mobile-toggle crm-icon-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><CrmIcon name="menu"/></button><div><span className="crm-breadcrumb">Workspace</span><h2>{current?.label??'All Leads'}</h2></div></div><div className="crm-topbar-actions">
   {user.role!=='creative_analyst'&&<ReminderMenu/>}
   <div className="crm-theme-switch" role="group" aria-label="Color theme">{crmThemes.map(name=><button key={name} type="button" aria-label={'Theme '+name[0].toUpperCase()+name.slice(1)} aria-pressed={theme===name} onClick={()=>chooseTheme(name)} title={name[0].toUpperCase()+name.slice(1)+' theme'}><CrmIcon name={name}/><span>{name[0].toUpperCase()+name.slice(1)}</span></button>)}</div>
   <details className="crm-top-menu crm-profile-menu"><summary aria-label="User profile menu"><span className="crm-avatar">{initials}</span><span className="crm-profile-label">{user.name}</span><CrmIcon name="chevron"/></summary><div className="crm-menu-content"><strong>Your staff account</strong><dl><dt>Name</dt><dd>{user.name}</dd><dt>Role</dt><dd>{roleLabels[user.role]}</dd><dt>{user.username?'Username':'Email'}</dt><dd>{user.username||user.email||'Not required'}</dd><dt>Organization ID</dt><dd>{user.organizationId}</dd></dl><form action={logoutAction}><button>Sign out</button></form></div></details>
  </div></header><div id="crm-page-content" className="crm-content" tabIndex={-1}>{children}</div></div>
 </div>;
}

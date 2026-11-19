import type {AnchorHTMLAttributes} from 'react';
type Props=AnchorHTMLAttributes<HTMLAnchorElement>&{variant?:'secondary'|'primary'};
export function ActionLink({children,className='',href='',variant='secondary',...props}:Props){
 const download=href.startsWith('/api/')||props.download!==undefined,calendar=href.startsWith('/app/follow-ups'),catalog=href==='/app/catalog',back=href==='/app',login=href==='/login';
 const path=download?'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5':calendar?'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2':catalog?'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z':back?'M19 12H5m6-6-6 6 6 6':login?'M9 5H5v14h4m4-14h6v14h-6m-3-7h7m-3-3 3 3-3 3':'M5 12h14m-6-6 6 6-6 6';
 return <a {...props} href={href} className={'crm-action-link crm-action-link-'+variant+(className?' '+className:'')}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path}/></svg><span>{children}</span></a>;
}

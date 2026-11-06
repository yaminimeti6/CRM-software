import type {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {staffSession} from '@/lib/auth';
import {logout} from '../login/actions';
import {CrmShell} from './crm-shell';
import {AuthFrame} from '../auth-frame';

export const dynamic='force-dynamic';
export default async function ApplicationLayout({children}:{children:ReactNode}){
 const session=await staffSession();
 if(session.status==='unauthenticated'||session.status==='unconfigured')redirect('/login');
 if(session.status!=='authorized')return <AuthFrame><section><h1>Access unavailable</h1><p>Your active staff profile and organization membership could not be verified. Contact your administrator.</p><form action={logout}><button>Sign out</button></form></section></AuthFrame>;
 // Individual pages retain their existing role-specific checks; the shell grants no access.
 return <CrmShell user={session.user} logoutAction={logout}>{children}</CrmShell>;
}

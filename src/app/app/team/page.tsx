import {ActionLink} from '@/app/action-link';
import {redirect} from 'next/navigation';
import {staffSession} from '@/lib/auth';
import {Team} from './team';
import {logout} from '../../login/actions';
export const dynamic='force-dynamic';
export default async function TeamPage(){
 const session=await staffSession();if(session.status==='unauthenticated'||session.status==='unconfigured')redirect('/login');
 if(session.status!=='authorized'||session.user.role!=='admin')return <section><h1>Team access denied</h1><p>Active organization Admin access is required.</p><ActionLink href="/app">All Leads</ActionLink></section>;
 return <><Team/></>;
}

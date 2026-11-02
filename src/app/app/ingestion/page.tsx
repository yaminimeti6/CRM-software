import {redirect} from 'next/navigation';import {staffSession} from '@/lib/auth';import {Sources} from './sources';
export const dynamic='force-dynamic';
export default async function Page(){const s=await staffSession();if(s.status==='unauthenticated'||s.status==='unconfigured')redirect('/login');if(s.status!=='authorized'||s.user.role!=='admin')return <section><h1>Admin access required</h1><a href="/app">Back</a></section>;return <><header className="app-header"><a href="/app">All Leads</a><a href="/app/follow-ups">Follow-ups</a><a href="/app/team">Team</a></header><Sources/></>;}

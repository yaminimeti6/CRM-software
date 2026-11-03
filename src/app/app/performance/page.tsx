import {redirect} from 'next/navigation';
import {staffSession} from '@/lib/auth';
import {logout} from '@/app/login/actions';
import {Performance} from './performance';
export const dynamic='force-dynamic';
export default async function PerformancePage(){const s=await staffSession();if(s.status==='unauthenticated'||s.status==='unconfigured')redirect('/login');if(s.status!=='authorized'||s.user.role==='creative_analyst')return <section><h1>Performance access unavailable</h1><p>Active Admin, Manager or Telecaller access is required. Creative Analysts cannot access staff performance or customer records.</p><a href="/app">Back to application</a></section>;return <><header className="app-header"><a href="/app">All Leads</a><a href="/app/follow-ups">Follow-ups</a><span>{s.user.name}</span><form action={logout}><button>Sign out</button></form></header><Performance /></>;}

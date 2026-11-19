import {ActionLink} from '@/app/action-link';
import {redirect} from 'next/navigation';import {staffSession} from '@/lib/auth';import {Catalog} from './catalog';
export const dynamic='force-dynamic';
export default async function Page(){const s=await staffSession();if(s.status==='unauthenticated'||s.status==='unconfigured')redirect('/login');if(s.status!=='authorized'||s.user.role!=='admin')return <section><h1>Admin catalog access required</h1><ActionLink href="/app">Back</ActionLink></section>;return <><Catalog/></>;}

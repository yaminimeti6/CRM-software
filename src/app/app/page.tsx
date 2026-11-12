import { redirect } from 'next/navigation';
import { staffSession } from '@/lib/auth';
import { logout } from '../login/actions';
import { Leads } from './leads';
export const dynamic = 'force-dynamic';
export default async function Application({ searchParams }: { searchParams: Promise<{ logout?: string; q?: string }> }) {
  const session = await staffSession();
  if (session.status === 'unauthenticated' || session.status === 'unconfigured') redirect('/login');
  if (session.status !== 'authorized') return <section><h1>Access unavailable</h1><p>Your active staff profile and organization membership could not be verified. Contact your administrator.</p><form action={logout}><button>Sign out</button></form></section>;
  const { user } = session; const query = await searchParams;
  return <>
    {query.logout === 'failed' && <p role="alert">Sign-out failed. Please try again.</p>}
    {user.role === 'creative_analyst' ? <section><h1>Customer access restricted</h1><p>Your role does not include customer lead records. Contact your administrator for permitted access.</p></section> : <Leads canExport={user.role==='admin'} preferenceKey={user.organizationId+':'+user.id} initialSearch={typeof query.q === 'string' ? query.q.slice(0, 80) : ''} />}
  </>;
}

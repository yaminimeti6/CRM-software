import { FollowUpReminders } from './follow-ups';
import { redirect } from 'next/navigation';
import { staffSession } from '@/lib/auth';
import { roleLabels } from '@/lib/roles';
import { logout } from '../login/actions';
import { Leads } from './leads';
export const dynamic = 'force-dynamic';
export default async function Application({ searchParams }: { searchParams: Promise<{ logout?: string; q?: string }> }) {
  const session = await staffSession();
  if (session.status === 'unauthenticated' || session.status === 'unconfigured') redirect('/login');
  if (session.status !== 'authorized') return <section><h1>Access unavailable</h1><p>Your active staff profile and organization membership could not be verified. Contact your administrator.</p><form action={logout}><button>Sign out</button></form></section>;
  const { user } = session; const query = await searchParams;
  return <><header className="app-header"><a href="/app">All Leads</a>{user.role !== 'creative_analyst' && <a href="/app/follow-ups">Follow-ups</a>}{user.role === 'admin' && <><a href="/app/team">Team</a><a href="/app/ingestion">Lead sources</a><a href="/app/catalog">Catalog</a><a href="/app/imports">Imports</a></>}<span>{user.name} · {roleLabels[user.role]}</span><form action={logout}><button>Sign out</button></form></header><details className="account"><summary>Your staff account</summary><h2>Your staff account</h2><dl><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email ?? 'Not required'}</dd><dt>Username</dt><dd>{user.username ?? 'Email login'}</dd><dt>Role</dt><dd>{roleLabels[user.role]}</dd><dt>Organization ID</dt><dd>{user.organizationId}</dd></dl></details>
    {query.logout === 'failed' && <p role="alert">Sign-out failed. Please try again.</p>}
    {user.role === 'creative_analyst' ? <section><h1>Customer access restricted</h1><p>Your role does not include customer lead records. Contact your administrator for permitted access.</p></section> : <><FollowUpReminders /><Leads initialSearch={typeof query.q === 'string' ? query.q.slice(0, 80) : ''} /></>}</>;
}

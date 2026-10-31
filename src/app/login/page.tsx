import { redirect } from 'next/navigation';
import { staffSession } from '@/lib/auth';
import { LoginForm } from './form';
export const dynamic = 'force-dynamic';
export default async function Login() {
  const session = await staffSession();
  if (session.status === 'authorized') redirect('/app');
  return <section><h1>Staff CRM</h1><p>Sign in with your staff account. Staff accounts are created by your organization administrator; public registration is disabled in the CRM.</p>
    <p>Setting up a new organization? The project owner must run the protected local first-Admin setup command described in the README before anyone can sign in.</p>
    {session.status === 'unconfigured' ? <p role="alert">Setup required: configure Supabase in .env.local. Authentication is unavailable.</p> : <LoginForm />}
  </section>;
}

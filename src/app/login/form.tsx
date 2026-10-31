'use client';
import { useActionState } from 'react';
import { login } from './actions';
export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: '' });
  return <form action={action}>
    <label>Username or email<input name="email" type="text" autoComplete="username" maxLength={254} required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label>
    {state.error && <p role="alert">{state.error}</p>}
    <button disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}

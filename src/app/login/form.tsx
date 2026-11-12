"use client";
import {useActionState}from 'react';import {login}from './actions';
export function LoginForm(){
 const[state,action,pending]=useActionState(login,{error:''});
 return <form action={action}>
 <p id="login-identifier-help">Use your registered email, or the username chosen when activating your staff account. Your display name is not a sign-in username. Each website address has a separate sign-in session.</p>
 <label>Username or email<input name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-describedby="login-identifier-help"/></label>
 <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={1024} required/></label>
 {state.error&&<p role="alert">{state.error}</p>}
 <button disabled={pending}>{pending?'Signing in...':'Sign in'}</button>
 </form>;
}

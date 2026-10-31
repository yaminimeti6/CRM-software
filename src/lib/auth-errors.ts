export function loginFailure(code: string | undefined, status: number | undefined) {
  if (status === 429 || code === 'over_request_rate_limit') return 'Too many sign-in attempts. Please wait and try again. [AUTH_RATE_LIMIT]';
  if (code === 'email_not_confirmed') return 'Your email is not confirmed. Contact the administrator to confirm your staff account. [AUTH_EMAIL_UNCONFIRMED]';
  if (code === 'invalid_credentials') return 'Username/email or password is incorrect. Staff access must first be granted by an administrator. [AUTH_INVALID_CREDENTIALS]';
  if (code === 'email_provider_disabled' || code === 'signup_disabled') return 'Email/password sign-in is unavailable. Contact the administrator. [AUTH_PROVIDER]';
  return 'The authentication service could not complete sign-in. Please try again or contact the administrator. [AUTH_UNAVAILABLE]';
}

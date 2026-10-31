import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginFailure } from '../src/lib/auth-errors.ts';
test('Auth diagnostics distinguish provider failures without exposing server messages', () => {
  assert.match(loginFailure('invalid_credentials', 400), /AUTH_INVALID_CREDENTIALS/);
  assert.match(loginFailure('email_not_confirmed', 400), /AUTH_EMAIL_UNCONFIRMED/);
  assert.match(loginFailure(undefined, 429), /AUTH_RATE_LIMIT/);
  assert.match(loginFailure('email_provider_disabled', 400), /AUTH_PROVIDER/);
  assert.match(loginFailure('unexpected-private-server-message', 500), /AUTH_UNAVAILABLE/);
  assert.doesNotMatch(loginFailure('unexpected-private-server-message', 500), /unexpected-private/);
});

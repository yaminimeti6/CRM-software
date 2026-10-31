import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
try {
  const app = await fetch(`${base}/app`, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert.equal(app.status, 307);
  assert.equal(app.headers.get('location'), '/login');
  for (const path of ['/api/me','/api/admin/access']) {
    const result = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
    assert.equal(result.status, 401);
    assert.match(result.headers.get('cache-control'), /no-store/);
  }
  const mutation = await fetch(`${base}/api/me`, { method: 'PATCH', body: '{}', signal: AbortSignal.timeout(20000) });
  assert.equal(mutation.status, 405);
  console.log('PASS: configured application denies logged-out protected pages/APIs, disables caching and refuses unsupported mutations. No password login tested.');
} catch {
  console.error('FAIL: HTTP protection test. Ensure this CRM is running on localhost:3000. Details withheld.');
  process.exitCode = 1;
}

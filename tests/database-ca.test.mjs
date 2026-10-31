import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { validateDatabaseCa, databaseCa } from '../scripts/lib/database-ca.mjs';
test('database CA parser accepts current CA PEM/DER and rejects invalid trust material safely', () => {
  const ca = rootCertificates.find(pem => {
    const cert = new X509Certificate(pem);
    return cert.ca && Date.parse(cert.validFrom) < Date.now() && Date.parse(cert.validTo) > Date.now();
  });
  assert.ok(ca);
  assert.match(validateDatabaseCa(Buffer.from(ca)), /BEGIN CERTIFICATE/);
  assert.match(validateDatabaseCa(new X509Certificate(ca).raw), /BEGIN CERTIFICATE/);
  assert.throws(() => validateDatabaseCa(Buffer.from('not-a-certificate-private-value')), /valid, unexpired CA/);
  assert.throws(() => validateDatabaseCa(Buffer.from('-----BEGIN PRIVATE KEY-----\n' + ca)), /valid, unexpired CA/);
  assert.throws(() => databaseCa('nonexistent-private-path-to-certificate'), error => {
    assert.doesNotMatch(error.message, /nonexistent-private-path/);
    return /cannot be read/.test(error.message);
  });
  assert.equal(databaseCa(undefined), undefined);
});

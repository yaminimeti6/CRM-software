import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
let browser;
try {
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Username or email', { exact: true }).fill(`crm-invalid-${randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(`Invalid-${randomUUID()}`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'AUTH_INVALID_CREDENTIALS' }).waitFor({ timeout: 30000 });
  assert.equal((await context.request.get('http://localhost:3000/api/me')).status(), 401);
  console.log('PASS: actual browser login Server Action rejects invalid credentials through real Supabase Auth, displays AUTH_INVALID_CREDENTIALS, and grants no protected API access.');
} catch {
  console.error('FAIL: live invalid-credential browser test. No request bodies, passwords or response payloads printed.');
  process.exitCode = 1;
} finally { if (browser) await browser.close(); }

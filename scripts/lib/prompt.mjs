import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { SetupError } from './bootstrap.mjs';
export async function question(label, hidden = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new SetupError('Run this command in your own interactive terminal. Credentials cannot be supplied through chat or CLI arguments.');
  const output = hidden ? new Writable({ write(_chunk, _encoding, done) { done(); } }) : process.stdout;
  if (hidden) process.stdout.write(label);
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  try { return await prompt.question(hidden ? '' : label); }
  finally { prompt.close(); if (hidden) process.stdout.write('\n'); }
}

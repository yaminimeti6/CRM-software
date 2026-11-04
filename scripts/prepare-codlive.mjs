import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
// Read the supplied browser artifact as data; never execute scripts from the ZIP here.
const zip = process.argv[2];
if (!zip) throw Error('Usage: node scripts/prepare-codlive.mjs path/to/CodLive.zip');
const original = execFileSync('tar', ['-xOf', zip, 'CodLive/index.html'], { encoding: 'utf8', maxBuffer: 2000000 });
let html = original;
const anchor = '      submitOrderToSheet(payload)';
if (html.split(anchor).length !== 2) throw Error('Unexpected page version; review manually.');
html = html.replace(anchor, '      submitCodLiveOrder(payload, submitOrderToSheet)');
const setup = `<script src="crm-adapter.js"></script>\n<script>const submitCodLiveOrder = createCodLiveCRM({base: 'http://localhost:3106', formId: 'codlive_test_v1'});</script>\n`;
html = html.replace(/(<script>\s*(?:[\s\S]*?)const scriptURL)/, setup + '$1');
if (!html.includes(setup)) throw Error('Expected script anchor missing.');
mkdirSync('.cache/codlive', { recursive: true });
const live = html.replace("base: 'http://localhost:3106'", "base: 'https://CRM-ENDPOINT.invalid'");
writeFileSync('.cache/codlive/original.html', original);
writeFileSync('.cache/codlive/live.html', live);
try { execFileSync('git', ['diff', '--no-index', '--unified=0', '--', '.cache/codlive/original.html', '.cache/codlive/live.html']); }
catch (error) {
 if (error.status !== 1) throw error;
 const patch = error.stdout.toString().replaceAll('a/.cache/codlive/original.html','a/CodLive/index.html').replaceAll('b/.cache/codlive/live.html','b/CodLive/index.html');
 writeFileSync('integrations/codlive/index.patch', patch);
}
// Safe test copy: no live Sheet or IP lookup, even if accidentally opened outside the harness.
html = html.replace(/const scriptURL = "[^"]+";/, 'const scriptURL = "/mock-sheet";').replace('https://api.ipify.org?format=json', '/mock-ip');
mkdirSync('.cache/codlive', { recursive: true });
writeFileSync('.cache/codlive/index.html', html);
writeFileSync('.cache/codlive/crm-adapter.js', readFileSync('integrations/codlive/crm-adapter.js'));
writeFileSync('.cache/codlive/input.sha256', createHash('sha256').update(original).digest('hex'));
console.log('Prepared isolated test copy in .cache/codlive; Sheet/IP URLs replaced with local mocks.');

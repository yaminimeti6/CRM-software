import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crmNavigation,normalizeCrmTheme} from '../src/lib/crm-navigation.ts';

test('sidebar preserves existing role-visible routes without granting backend access',()=>{
 const hrefs=(role:Parameters<typeof crmNavigation>[0])=>crmNavigation(role).flatMap(group=>group.items.map(item=>item.href));
 assert.deepEqual(hrefs('telecaller'),['/app','/app/follow-ups','/app/performance']);
 assert.deepEqual(hrefs('creative_analyst'),['/app','/app/attribution','/app/meta-spend']);
 assert.deepEqual(hrefs('manager'),['/app','/app/follow-ups','/app/performance','/app/attribution','/app/meta-spend']);
 assert.deepEqual(hrefs('admin'),['/app','/app/follow-ups','/app/performance','/app/attribution','/app/meta-spend','/app/team','/app/ingestion','/app/catalog','/app/imports','/app/meta','/app/settings']);
 for(const role of ['telecaller','creative_analyst','manager'] as const)assert(!crmNavigation(role).some(group=>group.label==='Admin / Settings'));
});
test('only the three supported stored themes are accepted; missing/corrupt preference defaults to Mixed',()=>{
 for(const theme of ['light','dark','mixed'] as const)assert.equal(normalizeCrmTheme(theme),theme);
 for(const value of [null,undefined,'Dark','unknown',{},''])assert.equal(normalizeCrmTheme(value),'mixed');
});

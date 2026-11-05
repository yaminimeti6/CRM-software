import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderTracking} from '../src/lib/order-tracking.ts';

test('reported campaign details preserve legacy identities and never infer a creative from click IDs', () => {
  const fields=orderTracking({AdCrevId:'campaign-text',AdCrevName:'content-text',ad_id:'ad-123',FbClickId:'click-only',creative_id:'  ',utm_campaign:0});
  assert.deepEqual(fields.map(f=>[f.label,f.value]),[
    ['Campaign (UTM)','0'],['Legacy AdCrevId','campaign-text'],['Legacy AdCrevName','content-text'],['Ad ID','ad-123'],
  ]);
  assert.deepEqual(orderTracking({FbClickId:'click-only',utm_campaign:null}),[]);
});

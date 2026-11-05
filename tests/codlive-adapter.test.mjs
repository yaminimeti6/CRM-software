import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';

test('adapter freezes supplied order IDs and ad claims across receipt loss without repeating acknowledged Sheet',async()=>{
  const data=new Map(),requests=[];let sheetPosts=0,loseReceipt=true;
  const sandbox={window:{},sessionStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},location:{href:'https://landing.example/Wife/?utm_source=instagram&ad_id=reported-ad&creative_id=reported-creative',hostname:'landing.example'},URL,crypto:{randomUUID},setTimeout:fn=>fn(),fetch:async(url,options)=>{
    if(!options)return {ok:true,json:async()=>({challenge:'synthetic'})};
    const inquiry=JSON.parse(options.body);requests.push(inquiry);
    if(loseReceipt){loseReceipt=false;throw Error('Synthetic receipt loss after commit');}
    return {ok:true,json:async()=>({ok:true,accepted:true,submission_id:inquiry.submission_id,replayed:true})};
  }};
  runInNewContext(readFileSync('integrations/codlive/crm-adapter.js','utf8'),sandbox);
  const submit=sandbox.window.createCodLiveCRM({base:'https://crm.example',formId:'synthetic_test'});
  const payload={name:'Synthetic',phone:'9000000000',address:'Test',courseName:'1 Month',coursePrice:'Rs. 499.00',lead_id:'external-order',order_id:'dynamic-order'};
  const sheet=async()=>{sheetPosts++;};
  await assert.rejects(submit(payload,sheet),/partially unconfirmed/);
  await submit({...payload,lead_id:'edited-order'},sheet);
  assert.equal(sheetPosts,1);assert.equal(requests.length,2);
  assert.deepEqual(requests[0],requests[1]);assert.equal(requests[1].lead_id,'external-order');
  assert.equal(requests[1].answers.order_id,'dynamic-order');assert.equal(requests[1].answers.ad_id,'reported-ad');
  assert.equal(requests[1].answers.creative_id,'reported-creative');assert.equal(data.size,0);
});

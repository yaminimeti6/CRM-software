// Browser diagnostics regression: all POSTs and API challenges are intercepted.
// Nothing is submitted to CRM, mock Sheet, or the local receipt/diagnostic store.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync),headless:true});
const posts=[],diagnostics=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.pathname==='/api/public/lead-challenge')return route.fulfill({json:{challenge:'intercepted-only',min_wait_ms:1000}});
  if(request.method()==='POST'){
   posts.push(u.pathname);
   if(u.pathname==='/local-diagnostics'){diagnostics.push(request.postDataJSON());return route.fulfill({json:{recorded:true}});}
   if(u.pathname==='/mock-sheet'){assert(request.headers()['x-local-submission-id']);return route.fulfill({json:{result:'success'}});}
   if(u.pathname==='/api/public/leads')return route.fulfill({status:403,json:{ok:false,error:{code:'SOURCE_UNAVAILABLE',message:'Intercepted browser regression only'}}});
   return route.abort();
  }
  if(u.origin!=='http://localhost:3108')return route.abort();
  return route.continue();
 });
 await page.goto('http://localhost:3108/Wife/');
 await page.locator('#submitBtn').click();
 await page.waitForFunction(()=>document.getElementById('local-submit-status').textContent.includes('Not sent.'));
 assert.match(await page.locator('#local-submit-status').innerText(),/Landmark/);
 assert.equal(posts.some(p=>p==='/api/public/leads'||p==='/mock-sheet'),false);
 await page.locator('#coursePickerButton').click();await page.locator('.course-picker-option[data-value="1 Month"]').click();
 for(const[id,value]of Object.entries({fullName:'Browser validation only',phone:'9000000000',address:'Validation only',landmark:'Validation only',pincode:'380001',city:'Ahmedabad'}))await page.locator('#'+id).fill(value);
 await page.locator('#state').selectOption({label:'Gujarat'});await page.locator('#submitBtn').click();
 await page.waitForFunction(()=>document.getElementById('local-submit-status').textContent.includes('HTTP 403 / SOURCE_UNAVAILABLE'));
 assert(posts.includes('/api/public/leads'));assert(posts.includes('/mock-sheet'));assert.equal(errors.length,0);
 assert.equal(new URL(page.url()).pathname,'/Wife/');
 assert(diagnostics.some(d=>d.stage==='validation_blocked'));assert(diagnostics.some(d=>d.stage==='http_error'&&d.status===403));
 console.log('PASS: missing fields visible with zero order requests; valid submit reaches both intercepted destinations; HTTP 403/code visible; no JavaScript errors. All POSTs intercepted; zero CRM/Sheet/diagnostic writes.');
}finally{await browser.close();}

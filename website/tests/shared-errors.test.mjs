import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sharedErrorResponse} from '../node/shared-errors.mjs';
test('shared notice serves the same accessible page with correct denial status',async()=>{
 const response=await sharedErrorResponse(new Request('https://cp.dunerealms.com/account-required.html'));
 assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const html=await response.text();assert.match(html,/Link Minecraft account/);assert.match(html,/target="_top"/);
 const main=await sharedErrorResponse(new Request('https://www.dunerealms.com/account-required.html'));
 assert.equal(await main.text(),html);
});
test('shared asset allowlist rejects arbitrary paths and writes',async()=>{
 assert.equal(await sharedErrorResponse(new Request('https://cp.dunerealms.com/private.env')),null);
 assert.equal((await sharedErrorResponse(new Request('https://cp.dunerealms.com/error.html',{method:'POST'}))).status,405);
 const head=await sharedErrorResponse(new Request('https://cp.dunerealms.com/shared-error-art.png',{method:'HEAD'}));
 assert.equal(head.headers.get('Content-Type'),'image/png');assert.equal(await head.text(),'');
});

import test from 'node:test';import assert from 'node:assert/strict';import {createWorldStatus} from '../node/world-status.mjs';
const ids=['spacing-guild','arrakis','caladan','giedi-prime','kaitain','sigma-draconis-iv','velocity'];
test('Live status is cached and only known server fields reach the browser',async()=>{
 let count=0;const servers=Object.fromEntries(ids.map(id=>[id,{online:id==='spacing-guild'||id==='velocity',configured:id==='spacing-guild'||id==='velocity',players:1,host:'private-host',secret:'never exposed'}]));
 const status=createWorldStatus({WORLD_STATUS_URL:'http://agent/status'},async()=>{count++;return Response.json({checkedAt:Date.now(),servers});});
 const a=await (await status()).json();await status();assert.equal(count,1);assert.equal(a.servers.length,7);assert.equal(a.servers[0].state,'online');assert.equal(a.servers[1].state,'offline');assert.equal(a.servers[1].configured,false);assert.ok(!JSON.stringify(a).includes('private-host'));assert.ok(!JSON.stringify(a).includes('secret'));
});
test('Missing, failed and stale monitoring never invent online or offline status',async()=>{
 for(const fetcher of [async()=>{throw Error('down')},async()=>Response.json({checkedAt:1,servers:{}})]){const r=await (await createWorldStatus({WORLD_STATUS_URL:'http://agent/status'},fetcher)()).json();assert.equal(r.available,false);assert.ok(r.servers.every(s=>s.state==='unknown'));}
 const r=await (await createWorldStatus({})()).json();assert.equal(r.available,false);
});

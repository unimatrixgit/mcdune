import test from 'node:test';import assert from 'node:assert/strict';
import {createBanking,projectBank} from '../control-panel/banking.mjs';
const player='00000000-0000-0000-0009-01f09764757f',bank={playerUuid:player,currency:'dunemarks',balanceDunemarks:'12.30',walletDunemarks:'45.67',ledger:[]};
function fixture({nodes=['web.bank.personal.view'],linked=player,response=bank,user={id:'account'}}={}){const calls=[];const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{authenticate:async()=>user,access:async()=>({nodes}),linked:async()=>linked,fetcher:async(url,options)=>{calls.push({url,options});return Response.json(response);}});return{calls,request:(path='/api/bank/personal',method='GET')=>app(new Request('https://cp.dunerealms.com'+path,{method}))};}
test('bank reads require current permission and linked UUID for personal and staff',async()=>{assert.equal((await fixture({user:null}).request()).status,401);assert.equal((await fixture({nodes:[]}).request()).status,403);const f=fixture({nodes:['web.bank.personal.view'],linked:null});assert.deepEqual(await(await f.request()).json(),{linked:false});assert.equal(f.calls.length,0);});
test('personal bank identity comes only from the verified session link',async()=>{const f=fixture();assert.equal((await f.request('/api/bank/personal?uuid=other')).status,400);assert.equal(f.calls.length,0);assert.equal((await f.request()).status,200);assert(f.calls[0].url.endsWith('/bank/player?uuid='+player));assert.equal((await f.request('/api/bank/personal','POST')).status,405);});
test('wrong identity, old currencies and numeric balances fail closed',()=>{assert(projectBank(bank,{playerUuid:player}));assert.equal(projectBank({...bank,playerUuid:'other'},{playerUuid:player}),null);assert.equal(projectBank({...bank,currency:'spice'},{playerUuid:player}),null);assert.equal(projectBank({...bank,balanceDunemarks:12.30},{playerUuid:player}),null);});
test('staff bank has one fixed server account and no caller-supplied account selector',async()=>{const f=fixture({nodes:['web.bank.staff.view'],response:{account:'server',currency:'dunemarks',balanceDunemarks:'0.00',ledger:[]}});const r=await f.request('/api/bank/staff');assert.equal(r.status,200);assert.equal((await r.json()).canManage,false);assert(f.calls[0].url.endsWith('/bank/staff'));assert.equal((await f.request('/api/bank/staff?account=someone')).status,400);});

test('missing permission nodes fail closed instead of crashing',async()=>{
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),access:async()=>({}),linked:async()=>player
 });
 assert.equal((await app(new Request('https://cp.dunerealms.com/api/bank/personal'))).status,403);
});
test('ledger timestamps must be valid nonnegative integer epoch values',()=>{
 const entry={id:'tx-1',action:'deposit',amountDunemarks:'1.00',balanceDunemarks:'12.30',createdAt:1730000000000};
 assert(projectBank({...bank,ledger:[entry]},{playerUuid:player}));
 for(const createdAt of [null,'1730000000000','',-1,1.5,NaN,Infinity]){
  assert.equal(projectBank({...bank,ledger:[{...entry,createdAt}]},{playerUuid:player}),null);
 }
});

test('authorized treasury access does not depend on a personal Minecraft link',async()=>{
 const response={account:'server',currency:'dunemarks',balanceDunemarks:'0.00',ledger:[]};
 const f=fixture({nodes:['web.bank.staff.view'],linked:null,response});
 const r=await f.request('/api/bank/staff');
 assert.equal(r.status,200);
 assert.equal((await r.json()).bank.account,'server');
 assert.equal(f.calls.length,1);
 assert(f.calls[0].url.endsWith('/bank/staff'));
});

test('malformed linked player identity is rejected without throwing',()=>{
 for(const playerUuid of [null,{},42,[],true]){
  assert.equal(projectBank({...bank,playerUuid},{playerUuid:player}),null);
 }
});
test('malformed permission node types do not grant bank access',async()=>{
 for(const nodes of [null,{},'web.bank.personal.view',true]){
  const f=fixture({nodes});
  assert.equal((await f.request()).status,403);
  assert.equal(f.calls.length,0);
 }
});

test('bank access is revoked if permissions change during the upstream request',async()=>{
 let checks=0;
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:++checks===1?['web.bank.personal.view']:[]}),
  linked:async()=>player,
  fetcher:async()=>Response.json(bank)
 });
 assert.equal((await app(new Request('https://cp.dunerealms.com/api/bank/personal'))).status,403);
});
test('bank refuses to disclose data when Minecraft link changes mid-request',async()=>{
 let checks=0;
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>++checks===1?player:'11111111-1111-1111-1111-111111111111',
  fetcher:async()=>Response.json(bank)
 });
 assert.equal((await app(new Request('https://cp.dunerealms.com/api/bank/personal'))).status,409);
});
test('upstream bank failures do not leak internal details or cached balances',async()=>{
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>player,
  fetcher:async()=>{throw Error('secret internal bank failure');}
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.doesNotMatch(JSON.stringify(await response.json()),/secret internal bank failure/);
});

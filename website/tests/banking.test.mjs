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

test('bank rejects duplicate ledger transaction IDs and malformed metadata',()=>{
 const entry={id:'tx-1',action:'deposit',amountDunemarks:'1.00',balanceDunemarks:'12.30',createdAt:1730000000000};
 assert(projectBank({...bank,ledger:[entry]},{playerUuid:player}));
 assert.equal(projectBank({...bank,ledger:[entry,{...entry,createdAt:1730000000001}]},{playerUuid:player}),null);
 for(const invalid of [{...entry,id:''},{...entry,id:'x'.repeat(129)},{...entry,action:''},{...entry,action:'x'.repeat(81)}]){
  assert.equal(projectBank({...bank,ledger:[invalid]},{playerUuid:player}),null);
 }
});

test('revoked bank access is denied after the upstream response',async()=>{
 let checks=0;
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:++checks===1?['web.bank.personal.view']:[]}),
  linked:async()=>player,
  fetcher:async()=>Response.json(bank)
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,403);
 assert.equal(checks,2);
});
test('changed Minecraft link prevents returning another account bank data',async()=>{
 let links=0;
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>++links===1?player:'11111111-1111-1111-1111-111111111111',
  fetcher:async()=>Response.json(bank)
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,409);
});

test('malformed ledger records are rejected without throwing',()=>{
 for(const entry of [null,undefined,false,42,'invalid']){
  assert.equal(projectBank({...bank,ledger:[entry]},{playerUuid:player}),null);
 }
});

test('invalid server control token types never reach upstream bank',async()=>{
 for(const token of [null,{},[],42,true,'short']){
  let calls=0;
  const app=createBanking({}, {SERVER_CONTROL_TOKEN:token},{
   authenticate:async()=>({id:'account'}),
   access:async()=>({nodes:['web.bank.personal.view']}),
   linked:async()=>player,
   fetcher:async()=>{calls++;return Response.json(bank);}
  });
  assert.equal((await app(new Request('https://cp.dunerealms.com/api/bank/personal'))).status,503);
  assert.equal(calls,0);
 }
});

test('invalid linked account identifiers never reach upstream bank',async()=>{
 for(const linked of [42,{},[],true,'not-a-uuid']){
  const f=fixture({linked});
  assert.equal((await f.request()).status,503);
  assert.equal(f.calls.length,0);
 }
});

test('malformed upstream bank payload shapes fail closed',()=>{
 for(const payload of [null,undefined,false,42,'invalid',[],[bank]]){
  assert.equal(projectBank(payload,{playerUuid:player}),null);
 }
});

test('bank requires a stable authenticated website account ID',async()=>{
 for(const user of [null,{}, {id:null},{id:''},{id:42}]){
  const f=fixture({user});
  assert.equal((await f.request()).status,401);
  assert.equal(f.calls.length,0);
 }
});
test('bank rejects a changed or missing account identity after upstream lookup',async()=>{
 for(const second of [{},{id:null},{id:'different'}]){
  let count=0;
  const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
   authenticate:async()=>++count===1?{id:'account'}:second,
   access:async()=>({nodes:['web.bank.personal.view']}),
   linked:async()=>player,
   fetcher:async()=>Response.json(bank)
  });
  assert.equal((await app(new Request('https://cp.dunerealms.com/api/bank/personal'))).status,401);
 }
});

test('personal bank projection requires valid UUID syntax on both sides',()=>{
 for(const invalid of ['not-a-uuid','', '00000000-0000-0000-0000-00000000000z']){
  assert.equal(projectBank({...bank,playerUuid:invalid},{playerUuid:invalid}),null);
  assert.equal(projectBank(bank,{playerUuid:invalid}),null);
 }
 assert(projectBank(bank,{playerUuid:player.toUpperCase()}));
});

test('bank rejects unexpected upstream success status without disclosing data',async()=>{
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>player,
  fetcher:async()=>new Response(null,{status:204})
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});

test('bank upstream requests never follow redirects or use cached responses',async()=>{
 const f=fixture();
 assert.equal((await f.request()).status,200);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].options.redirect,'error');
 assert.equal(f.calls[0].options.cache,'no-store');
});

test('bank rejects upstream redirect responses without returning account data',async()=>{
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>player,
  fetcher:async()=>Response.redirect('https://example.invalid/collect',302)
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('staff account cannot be queried using a personal bank permission',async()=>{
 const f=fixture({nodes:['web.bank.personal.view']});
 assert.equal((await f.request('/api/bank/staff')).status,403);
 assert.equal(f.calls.length,0);
});

test('bank authentication and permission lookup failures return private 503 responses',async()=>{
 for(const failing of ['authenticate','access']){
  let upstream=0;
  const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
   authenticate:async()=>{if(failing==='authenticate')throw Error('sensitive auth details');return{id:'account'};},
   access:async()=>{if(failing==='access')throw Error('sensitive database details');return{nodes:['web.bank.personal.view']};},
   linked:async()=>player,
   fetcher:async()=>{upstream++;return Response.json(bank);}
  });
  const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
  assert.equal(response.status,503);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.equal(upstream,0);
  assert.doesNotMatch(JSON.stringify(await response.json()),/sensitive/);
 }
});

test('bank refuses redirect responses even when a fetch stub returns one',async()=>{
 const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>({id:'account'}),
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=>player,
  fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://example.invalid/'}})
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('bank fails closed on malformed upstream JSON and server errors',async()=>{
 for(const fetcher of [
  async()=>new Response('not-json',{status:200}),
  async()=>Response.json({message:'internal secret'},{status:500}),
  async()=>Response.json({...bank,balanceDunemarks:'invalid'})
 ]){
  const app=createBanking({}, {SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
   authenticate:async()=>({id:'account'}),
   access:async()=>({nodes:['web.bank.personal.view']}),
   linked:async()=>player,fetcher
  });
  const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(await response.json()),/internal secret|not-json/);
 }
});

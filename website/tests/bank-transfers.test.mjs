import test from 'node:test';
import assert from 'node:assert/strict';
import {createBankTransfers} from '../control-panel/bank-transfers.mjs';

const player='00000000-0000-0000-0009-01f09764757f';
const requestId='11111111-1111-4111-8111-111111111111';
const payload={source:'current',amount:'12.50',requestId,memo:'test',confirmed:true};
function setup({linked=player,token='s'.repeat(64),permissions=['web.bank.personal.view'],fetcher=async()=>Response.json({reference:requestId})}={}){
 let upstream=0;
 const handler=createBankTransfers({}, {SERVER_CONTROL_TOKEN:token},{
  authenticate:async()=>({id:'account'}),access:async()=>({nodes:permissions}),
  linked:async()=>linked,excluded:async()=>false,
  fetcher:async(...args)=>{upstream++;return fetcher(...args);}
 });
 const send=(data=payload)=>handler(new Request('https://cp.dunerealms.com/api/bank/transfer-own',{
  method:'POST',headers:{origin:'https://cp.dunerealms.com','content-type':'application/json'},body:JSON.stringify(data)
 }));
 return {send,get upstream(){return upstream;}};
}
test('valid own-account transfer preserves idempotency reference and uses no redirects',async()=>{
 const f=setup({fetcher:async(url,options)=>{
  assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  const data=JSON.parse(options.body);assert.equal(data.request_id,requestId);
  assert.equal(data.amount,'12.50');return Response.json({reference:requestId});
 }});
 const r=await f.send();assert.equal(r.status,200);assert.equal((await r.json()).transfer.reference,requestId);assert.equal(f.upstream,1);
});
test('transfer rejects JSON arrays and invalid identities without contacting bank',async()=>{
 for(const data of [[],[payload],null,'text',42]){
  const f=setup();assert.equal((await f.send(data)).status,400);assert.equal(f.upstream,0);
 }
 for(const linked of [{},[],42,true,'invalid']){
  const f=setup({linked});assert.equal((await f.send()).status,403);assert.equal(f.upstream,0);
 }
});
test('transfer rejects non-string control tokens and never calls bank',async()=>{
 for(const token of [{length:64},[],null,42]){
  const f=setup({token});assert.equal((await f.send()).status,503);assert.equal(f.upstream,0);
 }
});
test('transfer rejects invalid upstream confirmation without implying success',async()=>{
 const f=setup({fetcher:async()=>Response.json({reference:'different'})});
 const r=await f.send();assert.equal(r.status,503);assert.match((await r.json()).message,/Retry this same request/);
});

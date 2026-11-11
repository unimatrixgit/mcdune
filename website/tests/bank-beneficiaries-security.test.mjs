import test from 'node:test';
import assert from 'node:assert/strict';
import {createBankBeneficiaries} from '../control-panel/bank-beneficiaries.mjs';

const endpoint='https://cp.dunerealms.com/api/bank/beneficiaries?q=atreides';
const user={id:42};
function fixture(overrides={}){
 let searches=0;
 const deps={
  authenticate:async()=>user,
  access:async()=>({nodes:['web.bank.personal.view']}),
  linked:async()=> '11111111-1111-4111-8111-111111111111',
  excluded:async()=>false,
  search:async()=>{searches++;return [];},
  ...overrides
 };
 return {handler:createBankBeneficiaries({},deps),searches:()=>searches};
}
test('beneficiary lookup rejects anonymous requests before searching',async()=>{
 const f=fixture({authenticate:async()=>null});
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,401);
 assert.equal(f.searches(),0);
});
test('beneficiary lookup rejects unlinked players',async()=>{
 const f=fixture({linked:async()=>null});
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,403);
 assert.equal(f.searches(),0);
});
test('beneficiary lookup rejects excluded accounts',async()=>{
 const f=fixture({excluded:async()=>true});
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,403);
 assert.equal(f.searches(),0);
});
test('beneficiary lookup rejects missing permission',async()=>{
 const f=fixture({access:async()=>({nodes:[]})});
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,403);
 assert.equal(f.searches(),0);
});
test('beneficiary lookup refuses changed Minecraft link after search',async()=>{
 let calls=0;
 const f=fixture({linked:async()=>++calls<=1?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222'});
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,403);
 assert.equal(f.searches(),1);
});
test('eligible linked player can search',async()=>{
 const f=fixture();
 const response=await f.handler(new Request(endpoint));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{beneficiaries:[]});
 assert.equal(f.searches(),1);
});

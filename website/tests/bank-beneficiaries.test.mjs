import test from 'node:test';
import assert from 'node:assert/strict';
import {createBankBeneficiaries} from '../control-panel/bank-beneficiaries.mjs';
import {accountNumber} from '../control-panel/imperial-accounts.mjs';

function fixture({rows=[],permissions=['web.bank.personal.view'],search=async()=>rows}={}){
 const handler=createBankBeneficiaries({},{
  authenticate:async()=>({id:'user'}),
  access:async()=>({nodes:permissions}),
  search
 });
 return q=>handler(new Request('https://cp.dunerealms.com/api/bank/beneficiaries?q='+encodeURIComponent(q)));
}
test('beneficiary search returns only valid bounded account records',async()=>{
 const rows=[
  {id:42,bank_type:'current',username:'Alice'},
  {id:2,bank_type:'player',username:'Bob'},
  {id:0,bank_type:'player',username:'Invalid'},
  {id:3,bank_type:'server',username:'Treasury'},
  null,
  ...Array.from({length:20},(_,i)=>({id:i+100,bank_type:'current',username:'Extra'}))
 ];
 const response=await fixture({rows})('Alice');
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.beneficiaries.length,7);
 assert.equal(body.beneficiaries[0].accountNumber,accountNumber('current',42));
 assert.equal(body.beneficiaries[1].accountNumber,accountNumber('player',2));
});
test('beneficiary search requires permissions and rejects malformed query',async()=>{
 assert.equal((await fixture({permissions:[]})('Alice')).status,403);
 assert.equal((await fixture()('a')).status,400);
});
test('beneficiary search fails closed when database result is unavailable',async()=>{
 const response=await fixture({search:async()=>{throw Error('private database details')}})('Alice');
 assert.equal(response.status,503);
 assert.doesNotMatch(JSON.stringify(await response.json()),/private database details/);
});

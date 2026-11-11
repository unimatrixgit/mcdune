import test from 'node:test';
import assert from 'node:assert/strict';
import {accountNumber,validAccountNumber} from '../control-panel/imperial-accounts.mjs';

test('DR account numbers round trip for every supported account type',()=>{
 for(const type of ['player','current','clan','faction','server']){
  for(const id of [1,42,9999999]){
   const number=accountNumber(type,id);
   assert(validAccountNumber(number));
   assert.match(number,/^DR[A-Z]{2} /);
  }
 }
});
test('DR account validation rejects modified checksums and invalid identifiers',()=>{
 const number=accountNumber('current',42);
 assert.equal(validAccountNumber(number.replace(/\d$/,digit=>digit==='9'?'8':'9')),false);
 for(const invalid of ['',null,42,'DRCA000000000000','BE68000000000000'])assert.equal(validAccountNumber(invalid),false);
 for(const id of [0,-1,10000000,NaN])assert.throws(()=>accountNumber('player',id));
});

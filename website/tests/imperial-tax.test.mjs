import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateImperialVat} from '../control-panel/imperial-tax.mjs';

test('21% Imperial VAT is added to taxable sales',()=>{
 const quote=calculateImperialVat(100000n,'exchange-item-sale');
 assert.equal(quote.vatCents,21000n);
 assert.equal(quote.totalCents,121000n);
});
test('tax is rounded to the nearest cent',()=>{
 assert.equal(calculateImperialVat(3n,'kit-sale').vatCents,1n);
 assert.equal(calculateImperialVat(2n,'mail-service').vatCents,0n);
});
test('bank movements, secondary share trades and refunds do not create VAT',()=>{
 for(const kind of ['bank-own-transfer','bank-player-transfer','treasury-transfer','deposit','withdrawal','share-secondary-trade','refund'])
  assert.equal(calculateImperialVat(10000n,kind).vatCents,0n);
});
test('unknown transaction kinds and unsafe values are rejected',()=>{
 assert.throws(()=>calculateImperialVat(100n,'magic-money'));
 assert.throws(()=>calculateImperialVat(-1n,'kit-sale'));
 assert.throws(()=>calculateImperialVat(10,'kit-sale'));
});

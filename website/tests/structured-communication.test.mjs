import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeSaleOgm,validOgm} from '../control-panel/inventory/structured-communication.mjs';

test('OGM matches Belgian-style MOD-97 example',()=>{
 assert.equal(exchangeSaleOgm('1234567890'),'+++123/4567/89002+++');
 assert.equal(validOgm('+++123/4567/89002+++'),true);
});
test('sale IDs generate stable distinct references',()=>{
 assert.equal(exchangeSaleOgm('1'),'+++000/0000/00101+++');
 assert.notEqual(exchangeSaleOgm('1'),exchangeSaleOgm('2'));
 assert.equal(exchangeSaleOgm('10000000000'),null);
 assert.equal(exchangeSaleOgm('not-a-sale'),null);
});
test('invalid check digits are rejected',()=>{
 assert.equal(validOgm('+++123/4567/89001+++'),false);
 assert.equal(validOgm('123/4567/89002'),false);
});

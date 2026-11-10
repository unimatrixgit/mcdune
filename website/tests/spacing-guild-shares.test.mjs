import test from 'node:test';
import assert from 'node:assert/strict';
import {SPACING_GUILD,guildSpiceIndicator} from '../control-panel/spacing-guild-shares.mjs';
const base={baselineQuantity:1000,baselineRevenueCents:150000};
test('Spacing Guild has a dedicated ticker',()=>assert.equal(SPACING_GUILD.ticker,'DRSG'));
test('lower spice sales reduces reference value',()=>{
 const result=guildSpiceIndicator({...base,currentQuantity:500,currentRevenueCents:75000});
 assert.equal(result.direction,'down');assert.equal(result.referenceLevel,50);
 assert.equal(result.isTradePrice,false);
});
test('higher sales increases reference value',()=>{
 const result=guildSpiceIndicator({...base,currentQuantity:1500,currentRevenueCents:225000});
 assert.equal(result.direction,'up');assert.equal(result.referenceLevel,150);
});
test('missing baseline cannot invent a price',()=>{
 assert.equal(guildSpiceIndicator({...base,baselineQuantity:0,currentQuantity:1,currentRevenueCents:100}),null);
});
test('reject negative or fractional metrics',()=>{
 assert.throws(()=>guildSpiceIndicator({...base,currentQuantity:-1,currentRevenueCents:0}));
});

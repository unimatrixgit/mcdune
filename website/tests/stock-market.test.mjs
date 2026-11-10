import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDING_ISSUERS,drx20Level,marketCapitalization,validateIssuerDraft} from '../control-panel/stock-market.mjs';

test('five founding official company templates',()=>{
 assert.deepEqual(FOUNDING_ISSUERS.map(i=>i.ticker),['DRMG','DRML','DRTV','DRBK','DRSG']);
});
test('market cap and index calculations do not change Dunemarks balances',()=>{
 assert.equal(marketCapitalization(1250,200),250000n);
 assert.deepEqual(drx20Level([{lastTradeCents:1250,freeFloatShares:200},{lastTradeCents:500,freeFloatShares:100}],100n),{numeratorCents:'300000',divisor:'100'});
});
test('missing price means no fabricated index value',()=>{
 assert.equal(drx20Level([{lastTradeCents:null,freeFloatShares:10}],1n),null);
 assert.throws(()=>drx20Level([],0n));
});
test('official issuer drafts are validated but not activated',()=>{
 assert.equal(validateIssuerDraft({ticker:'DRML',name:'DuneRealms Mail',kind:'mail'}).status,'draft');
 assert.throws(()=>validateIssuerDraft({ticker:'$',name:'Bad',kind:'mail'}));
});

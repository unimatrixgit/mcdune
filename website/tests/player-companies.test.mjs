import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_PRODUCT_SKU,validateCompanyApplication,verifyCompanyEntitlement,provisioningPlan} from '../control-panel/player-companies.mjs';
const founder='12345678-1234-1234-1234-123456789abc';
test('registration requires meaningful name, ticker and description',()=>{
 const a=validateCompanyApplication({name:'Arrakis Logistics',ticker:'ARLX',description:'Freight and trading across the planets.'});
 assert.equal(a.state,'pending');
 assert.throws(()=>validateCompanyApplication({name:'A',ticker:'X',description:'short'}));
 assert.throws(()=>validateCompanyApplication({name:'Arrakis',ticker:'ARLX',description:'Freight and trading across the planets.',paid:true}));
});
test('only settled, unused server verified entitlement is eligible',()=>{
 const e={purchaser_uuid:founder,product_sku:COMPANY_PRODUCT_SKU,payment_state:'verified',consumed_company_id:null,provider_payment_id:'paid-123'};
 assert.equal(verifyCompanyEntitlement(e,founder),true);
 assert.throws(()=>verifyCompanyEntitlement({...e,payment_state:'refunded'},founder));
 assert.throws(()=>verifyCompanyEntitlement({...e,consumed_company_id:founder},founder));
});
test('company provision starts with no funds or shares and trading disabled',()=>{
 const p=provisioningPlan({issuerId:founder,founderUuid:founder,provisioningId:founder});
 assert.equal(p.initialDunemarks,'0.00');
 assert.equal(p.initialShares,0);
 assert.equal(p.tradingEnabled,false);
});

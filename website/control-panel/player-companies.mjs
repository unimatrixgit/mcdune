/** Pure validation for paid player-company applications. Never trusts a browser payment claim. */
export const COMPANY_PRODUCT_SKU='drx-company-registration';
const tickerPattern=/^[A-Z][A-Z0-9]{2,7}$/;
const uuidPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function validateCompanyApplication(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='description,name,ticker')
  throw new TypeError('Invalid company application');
 const name=input.name?.trim(),description=input.description?.trim(),ticker=input.ticker;
 if(typeof name!=='string'||name.length<3||name.length>120||
    typeof description!=='string'||description.length<20||description.length>1000||
    typeof ticker!=='string'||!tickerPattern.test(ticker))
  throw new TypeError('Invalid company name, ticker or description');
 return {name,ticker,description,state:'pending'};
}

export function verifyCompanyEntitlement(entitlement,founderUuid) {
 if(!uuidPattern.test(founderUuid)||!entitlement||
    entitlement.purchaser_uuid?.toLowerCase()!==founderUuid.toLowerCase()||
    entitlement.product_sku!==COMPANY_PRODUCT_SKU||
    entitlement.payment_state!=='verified'||entitlement.consumed_company_id!==null||
    typeof entitlement.provider_payment_id!=='string'||!entitlement.provider_payment_id)
  throw new Error('No verified unused company registration entitlement');
 return true;
}

/** Provision only after approval; bank service must atomically create account and mandates. */
export function provisioningPlan({issuerId,founderUuid,provisioningId}) {
 if(![issuerId,founderUuid,provisioningId].every(v=>typeof v==='string'&&uuidPattern.test(v)))
  throw new TypeError('Invalid company provisioning identity');
 return Object.freeze({issuerId,founderUuid,provisioningId,accountType:'joint-company',
  founderRole:'owner',bankState:'pending-bank-provision',tradingEnabled:false,
  initialDunemarks:'0.00',initialShares:0});
}

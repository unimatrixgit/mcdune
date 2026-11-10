/** Pure read-only DRX20 market projections. No trading or balance writes. */
export const FOUNDING_ISSUERS=Object.freeze([
 {ticker:'DRMG',name:'DuneRealms Mother Group',kind:'holding'},
 {ticker:'DRML',name:'DuneRealms Mail',kind:'mail'},
 {ticker:'DRTV',name:'DuneRealms Travel',kind:'travel'},
 {ticker:'DRBK',name:'Spacing Trust Bank',kind:'bank'},
 {ticker:'DRSG',name:'Spacing Guild',kind:'transport'}
]);

export function marketCapitalization(priceCents,issuedShares) {
 if(!Number.isSafeInteger(priceCents)||priceCents<0||!Number.isSafeInteger(issuedShares)||issuedShares<0)
  throw new TypeError('Invalid market cap inputs');
 return BigInt(priceCents)*BigInt(issuedShares);
}

/** Weighted index with explicit divisor; null means there is no reliable price history. */
export function drx20Level(constituents,divisor) {
 if(typeof divisor!=='bigint'||divisor<=0n)throw new TypeError('Invalid index divisor');
 if(!Array.isArray(constituents)||!constituents.length||constituents.length>20)return null;
 let sum=0n;
 for(const item of constituents) {
  if(!item||!Number.isSafeInteger(item.lastTradeCents)||item.lastTradeCents<1||
     !Number.isSafeInteger(item.freeFloatShares)||item.freeFloatShares<0)return null;
  sum+=marketCapitalization(item.lastTradeCents,item.freeFloatShares);
 }
 return {numeratorCents:sum.toString(),divisor:divisor.toString()};
}

export function validateIssuerDraft({ticker,name,kind}) {
 if(typeof ticker!=='string'||!/^[A-Z][A-Z0-9]{1,7}$/.test(ticker)||
    typeof name!=='string'||name.trim().length<3||name.length>120||
    !['holding','mail','travel','bank','other'].includes(kind))throw new TypeError('Invalid issuer draft');
 return {ticker,name:name.trim(),kind,status:'draft'};
}

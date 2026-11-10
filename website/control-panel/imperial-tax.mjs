/** Fictional Imperial VAT for Dunemarks commerce, NOT Belgian real-world VAT.
 * All monetary values are integer cents. The caller must use the existing
 * authoritative treasury/bank transaction to settle the tax atomically.
 */
export const IMPERIAL_VAT_BASIS_POINTS=2100n;
export const VAT_POLICY_VERSION='imperial-vat-v1';
export const TAXABLE_KINDS=Object.freeze([
 'exchange-item-sale','kit-sale','corporate-service','transport-ticket',
 'mail-service','commercial-contract','company-share-primary-issuance'
]);
export const EXEMPT_KINDS=Object.freeze([
 'bank-own-transfer','bank-player-transfer','treasury-transfer','deposit',
 'withdrawal','share-secondary-trade','dividend','refund','tax-payment'
]);
export function calculateImperialVat(baseCents,kind) {
 if(typeof baseCents!=='bigint'||baseCents<0n||baseCents>10_000_000_000_000n)
  throw new TypeError('Amount must be a nonnegative BigInt in Dunemark cents');
 if(typeof kind!=='string')throw new TypeError('Invalid transaction kind');
 if(EXEMPT_KINDS.includes(kind))return Object.freeze({
  policy:VAT_POLICY_VERSION,kind,baseCents,vatCents:0n,totalCents:baseCents,taxable:false});
 if(!TAXABLE_KINDS.includes(kind))throw new TypeError('Unknown transaction tax classification');
 // Round half-up to one cent.
 const vatCents=(baseCents*IMPERIAL_VAT_BASIS_POINTS+5000n)/10000n;
 return Object.freeze({policy:VAT_POLICY_VERSION,kind,baseCents,vatCents,
  totalCents:baseCents+vatCents,taxable:true});
}

/** DRX public company financial statement projection. Pure, privacy-safe and read-only.
 * Values are integer Dunemark cents. Unknown figures are null, never invented zeros.
 */
export const PUBLIC_METRICS=Object.freeze([
 'revenueCents','operatingExpensesCents','taxCents','profitCents',
 'openingCashCents','closingCashCents','spiceQuantity','spiceSalesCents',
 'exchangeVolumeCents','sharesOutstanding'
]);
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const TICKER=/^[A-Z][A-Z0-9]{1,7}$/;
function value(input,key) {
 const n=input[key];
 if(n===null||n===undefined)return null;
 if(!Number.isSafeInteger(n)||(!['profitCents','openingCashCents','closingCashCents'].includes(key)&&n<0))
  throw new TypeError('Invalid financial metric: '+key);
 return n;
}
export function projectMonthlyStatement(input) {
 if(!input||typeof input!=='object'||!TICKER.test(input.ticker)||
    typeof input.month!=='string'||!MONTH.test(input.month)||
    !['published','restated'].includes(input.status)||
    !Number.isSafeInteger(input.publishedAt)||input.publishedAt<0)
  throw new TypeError('Statement is not public or has invalid metadata');
 const result={ticker:input.ticker,month:input.month,status:input.status,currency:'DM',
  publishedAt:input.publishedAt,sourceCutoffAt:input.sourceCutoffAt??null};
 for(const key of PUBLIC_METRICS)result[key]=value(input,key);
 if(result.profitCents!==null && result.revenueCents!==null &&
    result.operatingExpensesCents!==null && result.taxCents!==null &&
    BigInt(result.profitCents)!==BigInt(result.revenueCents)-BigInt(result.operatingExpensesCents)-BigInt(result.taxCents))
  throw new TypeError('Profit does not reconcile');
 result.notes=typeof input.notes==='string'?input.notes.slice(0,2000):'';
 // Never copy internal sources, UUIDs, bank account numbers, owners or raw ledger.
 return Object.freeze(result);
}
export function publicMonthlyReports(reports) {
 if(!Array.isArray(reports)||reports.length>240)throw new TypeError('Invalid report list');
 return reports.filter(r=>r?.status==='published'||r?.status==='restated')
  .map(projectMonthlyStatement).sort((a,b)=>b.month.localeCompare(a.month));
}

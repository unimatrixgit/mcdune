/** Fictional Spacing Guild activity index, derived from completed spice sales.
 * NOT a traded share price. Market prices still require real settled share trades.
 */
export const SPACING_GUILD={ticker:'DRSG',name:'Spacing Guild',kind:'transport',metric:'verified-spice-sales'};
export function guildSpiceIndicator({currentQuantity,baselineQuantity,currentRevenueCents,baselineRevenueCents}) {
 for(const n of [currentQuantity,baselineQuantity,currentRevenueCents,baselineRevenueCents])
  if(!Number.isSafeInteger(n)||n<0)throw new TypeError('Invalid verified spice metric');
 if(baselineQuantity===0||baselineRevenueCents===0)return null;
 // Both activity and realized revenue matter; 70% volume, 30% sales revenue.
 // Clamp to avoid a single unusual session dominating the indicator.
 const volume=Math.min(2, currentQuantity/baselineQuantity);
 const revenue=Math.min(2, currentRevenueCents/baselineRevenueCents);
 const ratio=.7*volume+.3*revenue;
 return {ratio:Number(ratio.toFixed(6)),direction:ratio<.995?'down':ratio>1.005?'up':'flat',
   referenceLevel:Number((100*ratio).toFixed(2)),isTradePrice:false};
}

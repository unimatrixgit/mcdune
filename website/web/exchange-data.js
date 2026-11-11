export const categories = {ores:'Ores & Minerals',spice:'Spice & Rare',building:'Building Blocks',equipment:'Equipment',farming:'Food & Farming',misc:'Miscellaneous'};
export const planets = {arrakis:'Arrakduin',caladan:'Kaladam',giedi_prime:'Giedermark',kaitain:'Kaiterhof',sigma_draconis_iv:'Sigmadraken IV'};
const planetSearchNames={arrakis:'arrakis serevan',caladan:'caladan pelareth',giedi_prime:'giedi prime varkesh',kaitain:'kaitain orivane',sigma_draconis_iv:'sigma draconis iv nivareth'};
const materialLabels={fremen_stillsuit:'Vrijduin reclaimer suit',spice_melange:'spice',arrakis_water:'Arrakduin water'};
export const materialName=value=>materialLabels[value]||String(value).replaceAll('_',' ');
const samples = [
  ['spice_melange','spice','arrakis',1250,16], ['arrakis_water','spice','arrakis',180,4],
  ['spice_harvest_shovel','equipment','arrakis',420,1], ['fremen_stillsuit','equipment','arrakis',950,1],
  ['sandstone','building','arrakis',25,64], ['smooth_sandstone','building','arrakis',32,64],
  ['glass','building','arrakis',12,32], ['cactus','farming','arrakis',8,32],
  ['iron_ingot','ores','giedi_prime',90,64], ['ancient_debris','ores','giedi_prime',2800,4],
  ['netherite_scrap','ores','giedi_prime',1800,2], ['coal','ores','giedi_prime',15,64],
  ['blackstone','building','giedi_prime',20,64], ['iron_pickaxe','equipment','giedi_prime',320,1],
  ['blast_furnace','misc','giedi_prime',240,3], ['gold_ingot','ores','kaitain',160,32],
  ['diamond','ores','kaitain',650,12], ['quartz','ores','kaitain',35,48],
  ['quartz_block','building','kaitain',140,32], ['golden_carrot','farming','kaitain',45,16],
  ['enchanted_book','equipment','kaitain',850,1], ['lantern','misc','kaitain',35,16],
  ['copper_ingot','ores','caladan',30,64], ['oak_log','building','caladan',18,64],
  ['spruce_planks','building','caladan',12,64], ['wheat','farming','caladan',18,32],
  ['cooked_cod','farming','caladan',28,24], ['potato','farming','caladan',7,64],
  ['bow','equipment','caladan',125,1], ['fishing_rod','equipment','caladan',85,1],
  ['redstone','ores','sigma_draconis_iv',75,48], ['lapis_lazuli','ores','sigma_draconis_iv',55,32],
  ['emerald','ores','sigma_draconis_iv',220,16], ['observer','misc','sigma_draconis_iv',320,4],
  ['piston','misc','sigma_draconis_iv',180,8], ['repeater','misc','sigma_draconis_iv',110,16],
  ['tinted_glass','building','sigma_draconis_iv',65,32], ['ender_pearl','spice','sigma_draconis_iv',240,8],
  ['paper','misc','caladan',8,64], ['shield','equipment','kaitain',210,1]
];
export const demoListings = samples.map(([material,category,origin,price,quantity],i)=>({
  id:i+1, material, category, origin, price, quantity,
  seller:({arrakis:'Rockhaven Supply',caladan:'Kaladam Farms',giedi_prime:'Foundry Depot',kaitain:'Imperial Emporium',sigma_draconis_iv:'Oordwijk Research'})[origin]+' (demo)'
}));
export function validListings(rows) {
  if(!Array.isArray(rows)) throw Error('Invalid market response');
  const seen=new Set();
  return rows.slice(0,500).filter(x=>{
    if(!x||!Number.isSafeInteger(x.id)||x.id<1||seen.has(x.id)||typeof x.material!=='string'||!x.material.trim()
      ||x.material.length>80||typeof x.seller!=='string'||x.seller.length>48||!Object.hasOwn(categories,x.category)
      ||!Object.hasOwn(planets,x.origin)||!Number.isFinite(x.price)||x.price<=0||!Number.isSafeInteger(x.quantity)||x.quantity<1) return false;
    seen.add(x.id); return true;
  });
}
export function filterListings(rows,{search='',category='all',planet='all',sort='new'}={}) {
  const term=search.trim().toLowerCase();
  return rows.filter(x=>(category==='all'||x.category===category)&&(planet==='all'||x.origin===planet)
    &&(!term||[materialName(x.material),x.material,x.seller,categories[x.category],planets[x.origin],planetSearchNames[x.origin]||''].some(value=>value.toLowerCase().includes(term))))
    .sort((a,b)=>sort==='price'?a.price-b.price||b.id-a.id:sort==='quantity'?b.quantity-a.quantity||b.id-a.id:b.id-a.id);
}
export function listingInstruction(offer,demo) {
  return demo?'DEMO · Illustrative offer · Not purchasable':'Buy in Minecraft: /exchange buy '+offer.id;
}

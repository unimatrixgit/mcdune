// Preparatory recognition only. These ranks never confer office or game authority.
export const POLITICAL_HERALDRY=[
 ['house_aerdrecht','House Aerdrecht','house-aerdrecht-v1.png','House & faction'],
 ['house_harkveen','House Harkveen','house-harkveen-v1.png','House & faction'],
 ['house_korenholt','House Korenholt','house-korenholt-v1.png','House & faction'],
 ['house_oordwijk','House Oordwijk','house-oordwijk-v1.png','House & faction'],
 ['house_vrijduin','Vrijduin','house-vrijduin-v1.png','House & faction'],
 ['veiled_concord','The Veiled Concord','veiled-concord-v1.png','House & faction'],
 ['reverent_mother','Reverent Mother','veiled-concord-v1.png','Imperial offices & rights'],
 ['seal_emperor','Emperor','emperor-v1.png','Imperial offices & rights'],
 ['seal_water','Water','water-rights-v1.png','Imperial offices & rights'],
 ['seal_spice','Spice','spice-rights-v1.png','Imperial offices & rights']
].map(([rank,label,file,group])=>({rank,label,file,group,key:'political-'+rank}));
export function politicalSeals(ranks=[]){return POLITICAL_HERALDRY.filter(seal=>ranks.includes(seal.rank));}

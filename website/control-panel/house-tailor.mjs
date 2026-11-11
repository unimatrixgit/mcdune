import {randomUUID} from 'node:crypto';

export const HOUSE_QUALITIES=Object.freeze(['common','uncommon','rare','very_rare','legendary']);
export const HOUSE_MINIMUM_DM=Object.freeze({common:100,uncommon:200,rare:400,very_rare:800,legendary:1600});
export const HOUSE_KIT_SCHEMA=`CREATE TABLE IF NOT EXISTS site_clan_kit_designs (
 id CHAR(36) PRIMARY KEY,clan_id CHAR(36) NOT NULL,quality VARCHAR(16) NOT NULL,
 name VARCHAR(60) NOT NULL,color CHAR(7) NOT NULL,lore_json TEXT NOT NULL,item_names_json TEXT NOT NULL,
 version INTEGER NOT NULL,shop_price_cents BIGINT NOT NULL,updated_at BIGINT NOT NULL,updated_by CHAR(36) NOT NULL,
 UNIQUE(clan_id,quality),FOREIGN KEY(clan_id) REFERENCES site_clans(id),
 CHECK(quality IN ('common','uncommon','rare','very_rare','legendary')),CHECK(version>0),CHECK(shop_price_cents>0))`;
export const HOUSE_UNLOCK_SCHEMA=`CREATE TABLE IF NOT EXISTS site_clan_kit_quality_unlocks (
 clan_id CHAR(36) NOT NULL,quality VARCHAR(16) NOT NULL,source_key VARCHAR(128) NOT NULL,created_at BIGINT NOT NULL,
 PRIMARY KEY(clan_id,quality),FOREIGN KEY(clan_id) REFERENCES site_clans(id),
 CHECK(quality IN ('common','uncommon','rare','very_rare','legendary')))`;

export async function initializeHouseTailor(db){
 for(const sql of [HOUSE_KIT_SCHEMA,HOUSE_UNLOCK_SCHEMA])await db.prepare(sql+' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4').run();
 // Preserve the original ID, version, price, content and authorship. Existing v2 rows are never overwritten.
 await db.prepare(`INSERT INTO site_clan_kit_designs(id,clan_id,quality,name,color,lore_json,item_names_json,version,shop_price_cents,updated_at,updated_by)
 SELECT id,clan_id,'uncommon',name,color,lore_json,'{}',version,shop_price_cents,updated_at,updated_by FROM site_clan_kits WHERE 1=1
 ON CONFLICT(clan_id,quality) DO UPDATE SET id=site_clan_kit_designs.id`).run();
}

const plain=(value,limit)=>typeof value==='string'&&value.length<=limit&&!/[<>§\x00-\x1f\x7f]/.test(value);
export function validateHouseKit(body){
 const fields=['name','color','lore','version','shopPriceDunemarks','quality','itemNames'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!fields.includes(key)))return null;
 const quality=body.quality??'uncommon';
 if(!HOUSE_QUALITIES.includes(quality)||!plain(body.name,60)||body.name.trim().length<3||typeof body.color!=='string'||!/^#[a-f0-9]{6}$/i.test(body.color)||!Array.isArray(body.lore)||body.lore.length>4||body.lore.some(line=>!plain(line,80))||!Number.isSafeInteger(body.version)||body.version<0||body.version>2147483646)return null;
 if(body.shopPriceDunemarks!==undefined&&(!Number.isSafeInteger(body.shopPriceDunemarks)||body.shopPriceDunemarks<HOUSE_MINIMUM_DM[quality]||body.shopPriceDunemarks>1000000))return null;
 const names=body.itemNames??{};
 if(!names||typeof names!=='object'||Array.isArray(names)||Object.keys(names).some(key=>!['helmet','chestplate','leggings','boots'].includes(key))||Object.values(names).some(value=>!plain(value,64))||(!['rare','very_rare','legendary'].includes(quality)&&Object.keys(names).length))return null;
 return {name:body.name.trim(),color:body.color.toUpperCase(),lore:body.lore.map(line=>line.trim()),version:body.version,quality,itemNames:Object.fromEntries(Object.entries(names).map(([key,value])=>[key,value.trim()])),shopPriceDunemarks:body.shopPriceDunemarks};
}

const ownerRank=`EXISTS (SELECT 1 FROM site_accounts a WHERE a.id=m.user_id AND
 (a.role='owners' OR EXISTS (SELECT 1 FROM cp_account_ranks ar WHERE ar.user_id=a.id AND ar.rank_key='owners')))
 AND EXISTS (SELECT 1 FROM cp_ranks r WHERE r.rank_key='owners' AND r.kind='access' AND r.rank_level>0)`;
function fence(quality,userId,uuid,clanId){
 const base=`EXISTS (SELECT 1 FROM site_clan_members m JOIN site_game_links l ON l.user_id=m.user_id AND l.minecraft_uuid=m.minecraft_uuid
 JOIN site_clans c ON c.id=m.clan_id AND c.active=1 WHERE m.user_id=? AND m.minecraft_uuid=? AND m.clan_id=? AND m.clan_role IN ('owner','officer')`;
 if(['common','uncommon'].includes(quality))return{sql:base+')',values:[userId,uuid,clanId]};
 return{sql:base+` AND (EXISTS (SELECT 1 FROM site_clan_kit_quality_unlocks uq WHERE uq.clan_id=c.id AND uq.quality=?)
 OR (EXISTS (SELECT 1 FROM site_kit_design_unlocks eu WHERE eu.user_id=m.user_id AND eu.quality=?) AND ${ownerRank})))`,values:[userId,uuid,clanId,quality,quality]};
}
const serialized=row=>row?{id:row.id,name:row.name,color:row.color,lore:JSON.parse(row.lore_json),itemNames:JSON.parse(row.item_names_json||'{}'),version:Number(row.version),quality:row.quality,shopPriceDunemarks:Number(row.shop_price_cents)/100,pieces:4}:null;

export async function houseTailorState(db,user,clan,legacy){
 const [{results:rows},{results:unlocks},{results:overrides}]=await Promise.all([
  db.prepare('SELECT id,quality,name,color,lore_json,item_names_json,version,shop_price_cents FROM site_clan_kit_designs WHERE clan_id=?').bind(clan.id).all(),
  db.prepare('SELECT quality FROM site_clan_kit_quality_unlocks WHERE clan_id=?').bind(clan.id).all(),
  db.prepare(`SELECT eu.quality FROM site_kit_design_unlocks eu JOIN site_accounts a ON a.id=eu.user_id WHERE a.id=?
   AND (a.role='owners' OR EXISTS (SELECT 1 FROM cp_account_ranks ar WHERE ar.user_id=a.id AND ar.rank_key='owners'))
   AND EXISTS (SELECT 1 FROM cp_ranks r WHERE r.rank_key='owners' AND r.kind='access' AND r.rank_level>0)`).bind(user.id).all()
 ]);
 const allowed=new Set(['common','uncommon',...unlocks.map(row=>row.quality),...overrides.map(row=>row.quality)]),stored=new Map(rows.map(row=>[row.quality,row]));
 return {stored,tiers:HOUSE_QUALITIES.map(quality=>({quality,unlocked:allowed.has(quality),minimumShopPriceDunemarks:HOUSE_MINIMUM_DM[quality],isLegacyGameKit:quality==='uncommon',
  // The original Uncommon row remains the native consumer's authority.
  blueprint:quality==='uncommon'?(legacy?{...legacy,quality:'uncommon',itemNames:{}}:null):serialized(stored.get(quality))}))};
}

export class HouseKitConflict extends Error{constructor(message='Clan membership, quality access or design changed. Refresh before saving.'){super(message);this.status=409;}}
export async function saveHouseKit(db,user,clan,uuid,body,legacy){
 const state=await houseTailorState(db,user,clan,legacy),tier=state.tiers.find(row=>row.quality===body.quality),current=tier.blueprint,stored=state.stored.get(body.quality);
 if(!tier.unlocked){const error=new Error('This quality needs a clan unlock.');error.status=403;throw error;}
 if((current?.version||0)!==body.version)throw new HouseKitConflict();
 if(body.quality==='uncommon'&&stored&&(!current||stored.id!==current.id))throw new HouseKitConflict('The original Uncommon design needs an integrity review.');
 const id=current?.id||randomUUID(),version=body.version+1,now=Date.now(),price=body.shopPriceDunemarks??current?.shopPriceDunemarks??HOUSE_MINIMUM_DM[body.quality];
 const guard=fence(body.quality,user.id,uuid,clan.id),values=[body.name,body.color,JSON.stringify(body.lore),JSON.stringify(body.itemNames),price*100,version,now,user.id];
 const update=stored?db.prepare(`UPDATE site_clan_kit_designs SET name=?,color=?,lore_json=?,item_names_json=?,shop_price_cents=?,version=?,updated_at=?,updated_by=? WHERE id=? AND clan_id=? AND quality=? AND version=? AND ${guard.sql}`).bind(...values,id,clan.id,body.quality,Number(stored.version),...guard.values)
  :db.prepare(`INSERT INTO site_clan_kit_designs(id,clan_id,quality,name,color,lore_json,item_names_json,shop_price_cents,version,updated_at,updated_by) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${guard.sql}`).bind(id,clan.id,body.quality,...values,...guard.values);
 const checked=statement=>({async run(c){const result=await statement.run(c);if(result.meta.changes!==1)throw new HouseKitConflict();return result;}}),operations=[checked(update)];
 if(body.quality==='uncommon'){
  const mirror=current?db.prepare(`UPDATE site_clan_kits SET name=?,color=?,lore_json=?,shop_price_cents=?,version=?,updated_at=?,updated_by=? WHERE id=? AND clan_id=? AND version=? AND ${guard.sql}`).bind(body.name,body.color,JSON.stringify(body.lore),price*100,version,now,user.id,id,clan.id,body.version,...guard.values)
   :db.prepare(`INSERT INTO site_clan_kits(id,clan_id,name,color,lore_json,shop_price_cents,version,updated_at,updated_by) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard.sql}`).bind(id,clan.id,body.name,body.color,JSON.stringify(body.lore),price*100,version,now,user.id,...guard.values);
  operations.push(checked(mirror));
 }
 operations.push(db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'clan-kit-design',JSON.stringify({clanId:clan.id,quality:body.quality,kitId:id,version}),now));
 try{await db.batch(operations);}catch(error){if(error.code==='ER_DUP_ENTRY'||error.code?.startsWith('SQLITE_CONSTRAINT'))throw new HouseKitConflict();throw error;}
 return {id,quality:body.quality,name:body.name,color:body.color,lore:body.lore,itemNames:body.itemNames,version,shopPriceDunemarks:price,pieces:4};
}

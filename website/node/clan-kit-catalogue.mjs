// Clan designs are live website publications; game delivery is enabled separately.
export async function clanKitCatalogue(db) {
  if (!db) return [];
  const {results} = await db.prepare(`SELECT k.id,k.name,k.color,k.lore_json,k.version,k.shop_price_cents,k.quality,c.name AS clan_name,a.username AS owner_name
    FROM (SELECT id,clan_id,name,color,lore_json,version,shop_price_cents,'uncommon' AS quality FROM site_clan_kits
      UNION ALL SELECT id,clan_id,name,color,lore_json,version,shop_price_cents,quality FROM site_clan_kit_designs WHERE quality!='uncommon') k JOIN site_clans c ON c.id=k.clan_id AND c.active=1
    JOIN site_accounts a ON a.id=c.owner_id ORDER BY c.name,CASE k.quality WHEN 'common' THEN 0 WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2 WHEN 'very_rare' THEN 3 ELSE 4 END,k.id LIMIT 500`).all();
  return results.map(row => ({listingId:row.id,listingVersion:Number(row.version),blueprintVersion:Number(row.version),
    priceCents:Number(row.shop_price_cents),name:row.name,sellerName:row.clan_name,ownerName:row.owner_name,
    quality:row.quality,commerceKind:'personal_sale',shopType:'clan',purchaseAvailable:false,
    completedSales:0,color:row.color,lore:JSON.parse(row.lore_json)}));
}

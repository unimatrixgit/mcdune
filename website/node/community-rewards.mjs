import {badgesFor} from './community-badges.mjs';
import {can} from './permissions.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {identity} from './auth.mjs';
import {json,gameAuthorized,validUuid} from './game-link.mjs';
const code=()=>randomBytes(16).toString('hex').toUpperCase();
const monthValid=value=>typeof value==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(value);
export function createCommunityRewards(db,settings,origin){
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/community/game/')){
   if(request.method!=='POST')return json({message:'Method not allowed'},405);
   if(!gameAuthorized(request,settings))return json({message:'Unauthorized'},401);
   let data;try{data=await request.json();}catch{return json({message:'Invalid request'},400);}
   if(!validUuid(data.uuid))return json({message:'Invalid player UUID'},400);
   if(path==='/api/community/game/ack'){
    if(!/^[a-f0-9]{64}$/.test(data.receipt||''))return json({message:'Invalid receipt'},400);
    const now=Date.now();
    await db.prepare('UPDATE season_rewards SET delivered_at=COALESCE(delivered_at,?) WHERE minecraft_uuid=? AND receipt=?').bind(now,data.uuid,data.receipt).run();
    const seasonAck=await db.prepare('SELECT delivered_at FROM season_rewards WHERE minecraft_uuid=? AND receipt=?').bind(data.uuid,data.receipt).first();if(seasonAck?.delivered_at)return json({ok:true});
    const result=await db.batch([
     db.prepare('UPDATE community_claims SET delivered_at=COALESCE(delivered_at,?) WHERE minecraft_uuid=? AND receipt=?').bind(now,data.uuid,data.receipt),
     db.prepare('UPDATE community_rewards SET used_at=COALESCE(used_at,?) WHERE minecraft_uuid=? AND month IN (SELECT month FROM community_claims WHERE minecraft_uuid=? AND receipt=? AND delivered_at IS NOT NULL)').bind(now,data.uuid,data.uuid,data.receipt)
    ]);
    // MySQL reports zero changes for a replayed acknowledgement; a delivered receipt remains valid.
    const row=await db.prepare('SELECT delivered_at FROM community_claims WHERE minecraft_uuid=? AND receipt=?').bind(data.uuid,data.receipt).first();
    return row?.delivered_at?json({ok:true}):json({message:'Unknown receipt'},404);
   }
   if(path!=='/api/community/game/prepare')return json({message:'Not found'},404);
   if(!/^[A-Z0-9-]{4,48}$/.test(data.code||''))return json({message:'Invalid code'},400);
   const season=await db.prepare('SELECT * FROM season_rewards WHERE minecraft_uuid=? AND personal_code=?').bind(data.uuid,data.code).first();
   if(season)return json({month:'S000001',amount:season.amount,receipt:season.receipt,delivered:!!season.delivered_at});
   const campaign=await db.prepare('SELECT c.* FROM community_campaigns c WHERE c.reached_at IS NOT NULL AND (c.public_code=? OR EXISTS (SELECT 1 FROM community_rewards r WHERE r.month=c.month AND r.minecraft_uuid=? AND r.personal_code=?))').bind(data.code,data.uuid,data.code).first();
   if(!campaign)return json({message:'Code unavailable or not earned by this UUID.'},404);
   await db.prepare('INSERT INTO community_claims(minecraft_uuid,month,receipt,amount,prepared_at) VALUES(?,?,?,?,?) ON CONFLICT(minecraft_uuid,month) DO UPDATE SET minecraft_uuid=excluded.minecraft_uuid').bind(data.uuid,campaign.month,randomBytes(32).toString('hex'),campaign.reward_amount,Date.now()).run();
   const claim=await db.prepare('SELECT * FROM community_claims WHERE minecraft_uuid=? AND month=?').bind(data.uuid,campaign.month).first();
   return json({month:claim.month,amount:claim.amount,receipt:claim.receipt,delivered:!!claim.delivered_at});
  }
  if(path==='/api/community/campaigns'&&request.method==='GET'){
   const {results}=await db.prepare('SELECT month,target_cents,received_cents,reward_amount,reached_at,CASE WHEN reached_at IS NOT NULL THEN public_code ELSE NULL END AS public_code FROM community_campaigns ORDER BY month DESC LIMIT 120').all();return json({campaigns:results,paymentsOpen:false});
  }
  const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
  if(path==='/api/community/rewards'&&request.method==='GET'){
   const link=await db.prepare('SELECT l.minecraft_uuid,i.first_linked_at FROM site_game_links l JOIN site_game_identities i ON i.minecraft_uuid=l.minecraft_uuid WHERE l.user_id=?').bind(user.id).first();
   if(!link)return json({linked:false,available:[],history:[]});
   const {results:earned}=await db.prepare('SELECT month FROM community_campaigns WHERE reached_at>? ORDER BY month').bind(link.first_linked_at).all();
   for(const campaign of earned)await db.prepare('INSERT INTO community_rewards(minecraft_uuid,month,personal_code,issued_at) VALUES(?,?,?,?) ON CONFLICT(minecraft_uuid,month) DO UPDATE SET minecraft_uuid=excluded.minecraft_uuid').bind(link.minecraft_uuid,campaign.month,code(),Date.now()).run();
   // Public-code claims and personal-code claims share exactly one UUID/month ledger.
   const {results}=await db.prepare('SELECT r.month,r.personal_code,r.issued_at,c.reward_amount,q.delivered_at FROM community_rewards r JOIN community_campaigns c ON c.month=r.month LEFT JOIN community_claims q ON q.minecraft_uuid=r.minecraft_uuid AND q.month=r.month WHERE r.minecraft_uuid=? ORDER BY r.month DESC').bind(link.minecraft_uuid).all();
   const badges=await badgesFor(db,user.id);if(badges.includes('season-tavren-ii'))await db.prepare("INSERT INTO season_rewards(minecraft_uuid,season_key,personal_code,receipt,amount,issued_at) VALUES(?,'season-tavren-ii',?,?,5000,?) ON CONFLICT(minecraft_uuid,season_key) DO UPDATE SET minecraft_uuid=excluded.minecraft_uuid").bind(link.minecraft_uuid,'SEASON-'+code(),randomBytes(32).toString('hex'),Date.now()).run();
   const {results:seasonRows}=await db.prepare('SELECT season_key AS month,personal_code,issued_at,amount AS reward_amount,delivered_at FROM season_rewards WHERE minecraft_uuid=?').bind(link.minecraft_uuid).all();const ready=await db.prepare("SELECT setting_value FROM website_settings WHERE setting_key='season-game-redemption-ready'").first();results.push(...seasonRows.map(r=>({...r,delivery_ready:ready?.setting_value==='1'})));
   return json({linked:true,eligibleSince:link.first_linked_at,available:results.filter(r=>!r.delivered_at),history:results.filter(r=>r.delivered_at).map(({personal_code,...row})=>row)});
  }
  if(!await can(db,user,'web.community.manage'))return json({message:'Community management permission required.'},403);
  if(request.method!=='POST')return json({message:'Method not allowed'},405);
  if(request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
  let data;try{data=await request.json();}catch{return json({message:'Invalid request'},400);}
  const now=Date.now();
  if(path==='/api/community/campaigns'){
   const today=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'}).slice(0,7);
   if(!monthValid(data.month)||data.month<today||!Number.isSafeInteger(data.targetCents)||data.targetCents<100||data.targetCents>10000000||!Number.isSafeInteger(data.rewardAmount)||data.rewardAmount<1||data.rewardAmount>10000)return json({message:'Use a current/future month, target €1–€100,000 and reward 1–10,000 Dunemarks.'},400);
   try{await db.batch([
    db.prepare('INSERT INTO community_campaigns(month,target_cents,reward_amount,public_code,created_at) VALUES(?,?,?,?,?)').bind(data.month,data.targetCents,data.rewardAmount,'COMMUNITY-'+code(),now),
    db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'campaign-created',JSON.stringify(data),now)
   ]);}catch(error){if(error.code==='ER_DUP_ENTRY'||String(error.message).includes('UNIQUE'))return json({message:'That month already has a campaign. Targets and rewards are fixed.'},409);throw error;}
   return json({ok:true},201);
  }
  if(path==='/api/community/verify-total'){
   const today=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'}).slice(0,7);
   if(!monthValid(data.month)||data.month!==today||!Number.isSafeInteger(data.receivedCents)||data.receivedCents<0||data.receivedCents>10000000||typeof data.reference!=='string'||data.reference.trim().length<5||data.reference.length>150)return json({message:'Record the current month, a verified total and an accounting reference.'},400);
   const result=await db.batch([
    db.prepare('UPDATE community_campaigns SET received_cents=?,reached_at=CASE WHEN ?>=target_cents THEN COALESCE(reached_at,?) ELSE reached_at END WHERE month=? AND received_cents<=?').bind(data.receivedCents,data.receivedCents,now,data.month,data.receivedCents),
    db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'total-verified',JSON.stringify(data),now)
   ]);
   const row=await db.prepare('SELECT received_cents FROM community_campaigns WHERE month=?').bind(data.month).first();
   if(!row||Number(row.received_cents)!==data.receivedCents)return json({message:'Campaign missing or total would decrease. Use operator accounting review for corrections.'},409);
   return json({ok:true});
  }
  return json({message:'Not found'},404);
 };
}

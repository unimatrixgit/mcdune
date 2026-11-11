import {MANUAL_AWARDS,FORUM_AWARDS,forumAwardsFor,forumPostCount} from './recognition.mjs';
const recognition=new Set([...MANUAL_AWARDS,...FORUM_AWARDS].map(a=>a.key));
// Awards recognise contribution independently of current staff membership.
export const communityBadgeVisible=(key,ranks)=>key==='alpha-tester'||recognition.has(key)?ranks.length>0&&!ranks.includes('memorial'):communitySealEligible(ranks);
export const communitySealEligible=ranks=>ranks.includes('web_streamer')?ranks.every(r=>['user','web_streamer','web_news'].includes(r)):ranks.every(r=>['user','vip','patron_caravan','patron_guild','patron_grand'].includes(r));
export const BADGES=['alpha-tester','beta-tester','launch-contributor','dedicated-tester','season-tavren-ii','dunegit-owner',...recognition];
export async function badgesFor(db,id){
 if(!id)return[];
 const {results}=await db.prepare('SELECT badge_key FROM website_badges WHERE user_id=? ORDER BY earned_at,badge_key').bind(id).all();
 const user=await db.prepare('SELECT username FROM site_accounts WHERE id=?').bind(id).first();
 if(user?.username?.toLowerCase()==='dunerealms')return [...BADGES];
 return [...new Set([...results.map(r=>r.badge_key).filter(k=>BADGES.includes(k)&&!FORUM_AWARDS.some(a=>a.key===k)),...forumAwardsFor(await forumPostCount(db,id)).map(a=>a.key)])];
}
export function alphaGrant(db,id,now=Date.now()){
 return db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) SELECT ?, 'alpha-tester', ? FROM website_settings WHERE setting_key='alpha-badge-active' AND setting_value='1' ON CONFLICT(user_id,badge_key) DO UPDATE SET user_id=excluded.user_id").bind(id,now);
}
export async function initializeBadges(db){
 await db.prepare("INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES('alpha-badge-active','1',?) ON CONFLICT(setting_key) DO UPDATE SET setting_key=excluded.setting_key").bind(Date.now()).run();
 await db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) SELECT a.id,'alpha-tester',? FROM site_accounts a JOIN website_settings s ON s.setting_key='alpha-badge-active' AND s.setting_value='1' WHERE a.role IN ('user','vip','player','patron_caravan','patron_guild','patron_grand') AND NOT EXISTS (SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key NOT IN ('user','vip','patron_caravan','patron_guild','patron_grand')) AND NOT EXISTS (SELECT 1 FROM website_badges b WHERE b.user_id=a.id AND b.badge_key='alpha-tester')").bind(Date.now()).run();
 await db.prepare("INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES('season-tavren-ii-active','1',?) ON CONFLICT(setting_key) DO UPDATE SET setting_key=excluded.setting_key").bind(Date.now()).run();
 await db.prepare("INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES('season-game-redemption-ready','0',?) ON CONFLICT(setting_key) DO UPDATE SET setting_key=excluded.setting_key").bind(Date.now()).run();
 await db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) SELECT a.id,'season-tavren-ii',? FROM site_accounts a JOIN website_settings s ON s.setting_key='season-tavren-ii-active' AND s.setting_value='1' WHERE NOT EXISTS (SELECT 1 FROM website_badges b WHERE b.user_id=a.id AND b.badge_key='season-tavren-ii')").bind(Date.now()).run();
}
export async function awardDedicated(db,userId,{statements=[]}={}){
 const user=await db.prepare('SELECT role FROM site_accounts WHERE id=?').bind(userId).first();
 if(!user||!['user','vip','player','patron_caravan','patron_guild','patron_grand'].includes(user.role))return false;
 const {results:ranks}=await db.prepare('SELECT rank_key FROM cp_account_ranks WHERE user_id=?').bind(userId).all();
 if(ranks.some(r=>!['user','vip','patron_caravan','patron_guild','patron_grand'].includes(r.rank_key)))return false;
 const badges=await badgesFor(db,userId);
 if(!['alpha-tester','beta-tester','launch-contributor'].every(k=>badges.includes(k)))return false;
 await db.batch([
  db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) VALUES(?,'dedicated-tester',?) ON CONFLICT(user_id,badge_key) DO UPDATE SET user_id=excluded.user_id").bind(userId,Date.now()),
  db.prepare("INSERT INTO cp_account_ranks(user_id,rank_key) VALUES(?,'vip') ON CONFLICT(user_id,rank_key) DO UPDATE SET user_id=excluded.user_id").bind(userId),...statements
 ]);
 return true;
}

export function seasonGrant(db,id,now=Date.now()){return db.prepare("INSERT INTO website_badges(user_id,badge_key,earned_at) SELECT ?, 'season-tavren-ii', ? FROM website_settings WHERE setting_key='season-tavren-ii-active' AND setting_value='1' ON CONFLICT(user_id,badge_key) DO UPDATE SET user_id=excluded.user_id").bind(id,now);}

import {electionAuthority} from './election-authority.mjs';
import {createHash} from 'node:crypto';
import {accessFor,DEFAULT_RANKS} from './permissions.mjs';
const houses={atreides:'House Aerdrecht',harkonnen:'House Harkveen',corrino:'House Korenholt',ordos:'House Oordwijk',fremen:'Vrijduin'};
async function councilRank(db,user,key){const row=await db.prepare('SELECT a.role,EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key=?) AS assigned FROM site_accounts a WHERE a.id=?').bind(key,user.id).first();return row?.role===key||Number(row?.assigned)===1;}
function resourceId(name){const b=createHash('sha1').update('dunerealms-government-mail:'+name).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export async function initializePoliticalMailRanks(db){
 const basic=DEFAULT_RANKS.find(r=>r.key==='user').nodes;
 for(const [key,label,node]of [['faction_council','Faction Council','web.mail.faction.view'],['imperial_council','Imperial Council','web.mail.imperial.view']])await db.prepare('INSERT INTO cp_ranks(rank_key,label,rank_level,kind,permissions_json,version) VALUES(?,?,?,?,?,1) ON CONFLICT(rank_key) DO UPDATE SET rank_key=excluded.rank_key').bind(key,label,30,'access',JSON.stringify([...new Set([...basic,node])])).run();
}
export async function politicalMailContext(db,user,settings=process.env,{fetcher=fetch,accessLookup=accessFor,authorityLookup=electionAuthority}={}){
 const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(link?.minecraft_uuid||''))return null;
 const access=await accessLookup(db,user);if(!access.nodes.includes('web.menu.game'))return null;
 const uuid=link.minecraft_uuid.toLowerCase(),explicitImperial=await councilRank(db,user,'imperial_council');
 if((settings.SERVER_CONTROL_TOKEN||'').length<64)return{factionId:null,canFactionMail:false,canImperialMail:explicitImperial};
 const read=async path=>{const r=await fetcher('http://127.0.0.1:15433'+path+'?uuid='+encodeURIComponent(uuid),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Political authority unavailable');const v=await r.json();if(v.playerUuid?.toLowerCase()!==uuid)throw Error('Political identity mismatch');return v;};
 const [bank,kits]=await Promise.allSettled([read('/bank/faction'),read('/kits/player')]);
 const current=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();if(current?.minecraft_uuid?.toLowerCase()!==uuid)return null;
 const rights=await accessLookup(db,user),faction=bank.status==='fulfilled'?String(bank.value.factionId||'').toLowerCase():null;if(!rights.nodes.includes('web.menu.game'))return null;
 const factionId=Object.hasOwn(houses,faction)?faction:null,offices=kits.status==='fulfilled'&&Array.isArray(kits.value.offices)?kits.value.offices:[];
 let leader=!!factionId&&offices.some(o=>String(o.office).toLowerCase()==='house-leader:'+factionId||String(o.office)==='house_leader'&&String(o.factionId||o.faction||'').toLowerCase()===factionId);
 const authority=await authorityLookup(db,{userId:user.id,playerUuid:uuid,faction:factionId});
 if(authority.house.managed)leader=authority.house.verified&&authority.house.active;
 const emperor=authority.imperial.managed?authority.imperial.verified&&authority.imperial.active:offices.some(o=>o.office==='emperor');
 const finalLink=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();if(finalLink?.minecraft_uuid?.toLowerCase()!==uuid)return null;
 return{factionId,factionName:houses[factionId]||null,canFactionMail:!!factionId&&(leader||await councilRank(db,user,'faction_council')),canImperialMail:await councilRank(db,user,'imperial_council')||emperor};
}
export async function ensureGovernmentMailbox(kind,factionId,broker){
 if(kind==='faction'&&!Object.hasOwn(houses,factionId))throw Error('Verified faction required');
 if(!['faction','imperial'].includes(kind))throw Error('Unknown government mailbox');
 const resource=resourceId(kind==='faction'?factionId:'imperial'),userId=resourceId('mailbox:'+resource),localPart=kind==='faction'?'faction-'+factionId+'.internal':'imperial.internal';
 const status=await broker({action:'internal_ensure',userId,eligible:true,mailboxKind:kind,resourceId:resource,localPart});return{userId,address:status.address};
}

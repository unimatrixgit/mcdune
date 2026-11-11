import {randomUUID} from 'node:crypto';
import {initializeHouseTailor,validateHouseKit,houseTailorState,saveHouseKit} from './house-tailor.mjs';
import {imperialAccount} from './imperial-accounts.mjs';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {gameAuthorized,validUuid} from '../node/game-link.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export function projectClanWallet(bank,clanId){
 const money=/^(?:0|[1-9]\d{0,17})\.\d{2}$/,signed=/^-?(?:0|[1-9]\d{0,17})\.\d{2}$/;
 if(bank?.clanId!==clanId||bank.currency!=='dunemarks'||typeof bank.balanceDunemarks!=='string'||!money.test(bank.balanceDunemarks)||!Array.isArray(bank.ledger)||bank.ledger.length>200)return null;
 if(bank.ledger.some(r=>typeof r.id!=='string'||typeof r.action!=='string'||typeof r.amountDunemarks!=='string'||!signed.test(r.amountDunemarks)||typeof r.balanceDunemarks!=='string'||!money.test(r.balanceDunemarks)||!Number.isFinite(Number(r.createdAt))))return null;
 return{currency:'dunemarks',balanceDunemarks:bank.balanceDunemarks,ledger:bank.ledger.slice(0,50).map(r=>({id:r.id,kind:r.action,amountDunemarks:r.amountDunemarks,balanceDunemarks:r.balanceDunemarks,createdAt:r.createdAt}))};
}
export const CLAN_KIT_SCHEMA=`CREATE TABLE IF NOT EXISTS site_clan_kits (id CHAR(36) PRIMARY KEY,clan_id CHAR(36) NOT NULL UNIQUE,name VARCHAR(60) NOT NULL,color CHAR(7) NOT NULL,lore_json TEXT NOT NULL,version INTEGER NOT NULL,updated_at BIGINT NOT NULL,updated_by CHAR(36) NOT NULL,shop_price_cents BIGINT NOT NULL DEFAULT 20000,FOREIGN KEY(clan_id) REFERENCES site_clans(id))`;
export async function initializeClanShop(db){await db.prepare(CLAN_KIT_SCHEMA+' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4').run();await db.prepare("INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES('clan-kit-price-dunemarks','100',?) ON CONFLICT(setting_key) DO UPDATE SET setting_key=excluded.setting_key").bind(Date.now()).run();await initializeHouseTailor(db);}
export const validateClanKit=validateHouseKit;
export function createClanShop(db,settings={},dependencies={}){
 const auth=dependencies.authenticate||(r=>identity(r,db)),access=dependencies.access||(u=>accessFor(db,u));
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 const membership=async(uuid)=>db.prepare("SELECT c.id,c.name,c.tag,c.version,m.user_id,m.clan_role FROM site_clan_members m JOIN site_clans c ON c.id=m.clan_id AND c.active=1 JOIN site_game_links l ON l.user_id=m.user_id AND l.minecraft_uuid=m.minecraft_uuid WHERE m.minecraft_uuid=?").bind(uuid).first();
 const price=async()=>{const row=await db.prepare("SELECT setting_value FROM website_settings WHERE setting_key='clan-kit-price-dunemarks'").first();const n=Number(row?.setting_value||100);return Number.isSafeInteger(n)&&n>=1&&n<=1000000?n:100;};
 const blueprint=async(clan)=>{const row=await db.prepare('SELECT id,name,color,lore_json,version,shop_price_cents FROM site_clan_kits WHERE clan_id=?').bind(clan.id).first();return row?{id:row.id,name:row.name,color:row.color,lore:JSON.parse(row.lore_json),version:Number(row.version),quality:'UNCOMMON',shopPriceDunemarks:Number(row.shop_price_cents)/100,pieces:4,priceDunemarks:await price()}:null;};
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname==='/api/clans/game-context'){
   if(request.method!=='GET')return reply({message:'Method not allowed'},405);
   if(!gameAuthorized(request,settings))return reply({message:'Unauthorized'},401);
   const uuid=url.searchParams.get('uuid');if(!validUuid(uuid)||[...url.searchParams.keys()].some(k=>k!=='uuid'))return reply({message:'Invalid player identity'},400);
   const clan=await membership(uuid);if(!clan)return reply({member:false});
   return reply({member:true,playerUuid:uuid,clanId:clan.id,name:clan.name,tag:clan.tag,role:clan.clan_role,bankWithdrawAllowed:['owner','officer'].includes(clan.clan_role),blueprint:await blueprint(clan)});
  }
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const nodes=(await access(user)).nodes;
  if(url.pathname==='/api/clans/shop/price'){
   if(!nodes.includes('web.items.manage'))return reply({message:'Kit pricing requires item administration.'},403);
   if(request.method!=='POST')return reply({message:'Method not allowed'},405);if(request.headers.get('origin')!==origin)return reply({message:'Origin rejected.'},403);let b;try{b=await request.json();}catch{}if(!Number.isSafeInteger(b?.priceDunemarks)||b.priceDunemarks<1||b.priceDunemarks>1000000)return reply({message:'Use a whole Dunemarks price from 1 to 1,000,000.'},400);
   await db.batch([db.prepare("UPDATE website_settings SET setting_value=?,updated_at=? WHERE setting_key='clan-kit-price-dunemarks'").bind(String(b.priceDunemarks),Date.now()),db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,'clan-kit-price',JSON.stringify({priceDunemarks:b.priceDunemarks}),Date.now())]);return reply({ok:true,priceDunemarks:b.priceDunemarks});
  }
  if(!nodes.includes('web.menu.game'))return reply({message:'Game account access required.'},403);
  if(url.search)return reply({message:'Player and clan overrides are not accepted.'},400);
  const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();
  const clan=link?await membership(link.minecraft_uuid):null;
  if(!clan)return reply({member:false,canSetPrice:nodes.includes('web.items.manage'),priceDunemarks:await price(),message:'Join a clan with your verified Minecraft identity to use its shop.'},request.method==='GET'?200:403);
  if(request.method==='GET'){
   let bank=null;try{if((settings.SERVER_CONTROL_TOKEN||'').length>=64){const r=await(dependencies.fetcher||fetch)('http://127.0.0.1:15433/clans/bank?clanId='+encodeURIComponent(clan.id),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(7000)});if(r.ok){bank=projectClanWallet(await r.json(),clan.id);}}}catch{}
   const currentUser=await auth(request);if(!currentUser||currentUser.id!==user.id)return reply({message:'Sign in again to view your clan.'},401);
   const currentNodes=(await access(currentUser))?.nodes;if(!currentNodes?.includes('web.menu.game'))return reply({message:'Game account access is no longer available.'},403);
   const currentLink=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(currentUser.id).first();
   const currentClan=currentLink?await membership(currentLink.minecraft_uuid):null;
   if(!currentLink||currentLink.minecraft_uuid!==link.minecraft_uuid||!currentClan||currentClan.id!==clan.id||currentClan.user_id!==currentUser.id)return reply({message:'Your linked account or clan membership changed. Refresh before continuing.'},409);
   if(bank)bank.accountNumber=await (dependencies.accountNumber||imperialAccount)(db,'clan',currentClan.id);
   const legacy=await blueprint(currentClan),state=await houseTailorState(db,currentUser,currentClan,legacy);
   return reply({member:true,clan:{id:currentClan.id,name:currentClan.name,tag:currentClan.tag,role:currentClan.clan_role},canDesign:['owner','officer'].includes(currentClan.clan_role),blueprint:legacy,qualities:state.tiers,priceDunemarks:await price(),canSetPrice:currentNodes.includes('web.items.manage'),bank,bankAvailable:!!bank});
  }
  if(request.method!=='POST')return reply({message:'Method not allowed'},405);
  if(request.headers.get('origin')!==origin)return reply({message:'Origin rejected.'},403);
  if(!['owner','officer'].includes(clan.clan_role))return reply({message:'Only clan owners and officers may design clan kits.'},403);
  let body;try{const raw=await request.text();if(Buffer.byteLength(raw)>4096)throw Error();body=validateClanKit(JSON.parse(raw));}catch{}if(!body)return reply({message:'Use a name of 3–60 characters, a colour and up to four lore lines of 80 characters.'},400);
  try{const saved=await saveHouseKit(db,user,clan,link.minecraft_uuid,body,await blueprint(clan));return reply({ok:true,version:saved.version,blueprint:saved});}catch(error){if([403,409].includes(error.status))return reply({message:error.message},error.status);throw error;}

 };
}

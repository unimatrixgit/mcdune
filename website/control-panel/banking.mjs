import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,money=/^(?:0|[1-9]\d{0,17})\.\d{2}$/,signed=/^-?(?:0|[1-9]\d{0,17})\.\d{2}$/;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function projectBank(data,{playerUuid,staff=false}={}){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.currency!=='dunemarks'||typeof data.balanceDunemarks!=='string'||!money.test(data.balanceDunemarks)||!Array.isArray(data.ledger)||data.ledger.length>200)return null;
 if(staff?data.account!=='server':typeof data.playerUuid!=='string'||typeof playerUuid!=='string'||!uuid.test(data.playerUuid)||!uuid.test(playerUuid)||data.playerUuid.toLowerCase()!==playerUuid.toLowerCase()||typeof data.walletDunemarks!=='string'||!signed.test(data.walletDunemarks))return null;
 if(data.ledger.some(r=>!r||typeof r!=='object'||typeof r.id!=='string'||r.id.length<1||r.id.length>128||typeof r.action!=='string'||r.action.length<1||r.action.length>80||typeof r.amountDunemarks!=='string'||!signed.test(r.amountDunemarks)||typeof r.balanceDunemarks!=='string'||!money.test(r.balanceDunemarks)||!(typeof r.createdAt==='number'&&Number.isSafeInteger(r.createdAt)&&r.createdAt>=0)))return null;
 if(new Set(data.ledger.map(r=>r.id)).size!==data.ledger.length)return null;
 return{currency:'dunemarks',balanceDunemarks:data.balanceDunemarks,...(staff?{account:'server'}:{walletDunemarks:data.walletDunemarks}),ledger:data.ledger.slice(0,100).map(r=>({id:r.id,action:r.action,amountDunemarks:r.amountDunemarks,balanceDunemarks:r.balanceDunemarks,createdAt:r.createdAt,...(staff?{actorName:typeof r.actorName==='string'?r.actorName.slice(0,80):''}:{})}))};
}
export function createBanking(db,settings={},dependencies={}){
 const authenticate=dependencies.authenticate||(r=>identity(r,db)),access=dependencies.access||(u=>accessFor(db,u));
 const linked=dependencies.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 return async request=>{
  const url=new URL(request.url),staff=url.pathname==='/api/bank/staff';
  if(!['/api/bank/personal','/api/bank/staff'].includes(url.pathname))return reply({message:'Not found.'},404);
  if(request.method!=='GET')return reply({message:'Bank transfers are handled in game.'},405);
  if(url.search)return reply({message:'This bank does not accept account or player overrides.'},400);
  try{
   const user=await authenticate(request);if(!user||typeof user.id!=='string'||!user.id)return reply({message:'Sign in to view your bank.'},401);
   const rights=await access(user);if(!Array.isArray(rights?.nodes)||!rights.nodes.includes(staff?'web.bank.staff.view':'web.bank.personal.view'))return reply({message:'Bank access is not available for this account.'},403);
   const player=staff?null:await linked(user);if(!staff&&!player)return reply({linked:false});if(!staff&&(typeof player!=='string'||!uuid.test(player)))throw Error();
   if(typeof settings.SERVER_CONTROL_TOKEN!=='string'||settings.SERVER_CONTROL_TOKEN.length<64)throw Error();
   const r=await(dependencies.fetcher||fetch)('http://127.0.0.1:15433'+(staff?'/bank/staff':'/bank/player?uuid='+encodeURIComponent(player)),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!r.ok||r.status!==200)throw Error();const payload=await r.json();const bank=projectBank(payload,{playerUuid:player,staff});if(!bank)throw Error();
   const currentUser=await authenticate(request);if(!currentUser||typeof currentUser.id!=='string'||currentUser.id!==user.id)return reply({message:'Sign in again before viewing this bank.'},401);
   const currentRights=await access(currentUser);if(!Array.isArray(currentRights?.nodes)||!currentRights.nodes.includes(staff?'web.bank.staff.view':'web.bank.personal.view'))return reply({message:'Bank access is no longer available for this account.'},403);
   if(!staff){const currentPlayer=await linked(currentUser);if(typeof currentPlayer!=='string'||!uuid.test(currentPlayer)||currentPlayer.toLowerCase()!==player.toLowerCase())return reply({message:'Your linked Minecraft account changed. Refresh before viewing this bank.'},409);}
   return reply({linked:staff?undefined:true,bank,canManage:staff?currentRights.nodes.includes('web.bank.staff.manage'):true});
  }catch{return reply({message:'The Dunemarks bank is temporarily unavailable. Refresh to check the current balance.'},503);}
 };
}

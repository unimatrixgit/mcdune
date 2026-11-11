import {imperialAccount,validAccountNumber} from './imperial-accounts.mjs';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,money=/^(?:0|[1-9]\d{0,17})\.\d{2}$/,signed=/^-?(?:0|[1-9]\d{0,17})\.\d{2}$/;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function ledgerCounterparty(row,player,staff=false,current=false){
 const ref=row.reference;
 if(typeof ref!=='string')return null;
 if(!staff&&new RegExp('^web-own:[a-f0-9-]{36}:'+(current?'current':'savings')+'$').test(ref))return {type:current?'player':'current',owner:player.toLowerCase()};
 if(!staff&&row.amountDunemarks==='5000.00'&&ref==='alpha-launch-20261108:from-server:'+player.toLowerCase())return {type:'server',owner:'network'};
 const match=staff&&row.amountDunemarks==='-5000.00'&&/^alpha-launch-20261108:to:([a-f0-9-]{36})$/.exec(ref);
 return match&&uuid.test(match[1])?{type:'player',owner:match[1]}:null;
}
export function projectBank(data,{playerUuid,staff=false}={}){
 if(data?.currency!=='dunemarks'||typeof data.balanceDunemarks!=='string'||!money.test(data.balanceDunemarks)||!Array.isArray(data.ledger)||data.ledger.length>200)return null;
 if(staff?data.account!=='server':data.playerUuid?.toLowerCase()!==playerUuid?.toLowerCase()||typeof data.walletDunemarks!=='string'||!signed.test(data.walletDunemarks))return null;
 if(data.ledger.some(r=>typeof r.id!=='string'||typeof r.action!=='string'||typeof r.amountDunemarks!=='string'||!signed.test(r.amountDunemarks)||typeof r.balanceDunemarks!=='string'||!money.test(r.balanceDunemarks)||!Number.isFinite(Number(r.createdAt))))return null;
 return{currency:'dunemarks',balanceDunemarks:data.balanceDunemarks,...(staff?{account:'server'}:{walletDunemarks:data.walletDunemarks}),ledger:data.ledger.slice(0,100).map(r=>({id:r.id,action:r.action,amountDunemarks:r.amountDunemarks,balanceDunemarks:r.balanceDunemarks,createdAt:r.createdAt,memo:typeof r.memo==='string'?r.memo.slice(0,140):'',...(validAccountNumber(r.fromAccount)&&validAccountNumber(r.toAccount)?{fromAccount:r.fromAccount,toAccount:r.toAccount,memo:typeof r.memo==='string'?r.memo.slice(0,140):''}:{}),counterparty:ledgerCounterparty(r,playerUuid,staff),...(staff?{actorName:typeof r.actorName==='string'?r.actorName.slice(0,80):''}:{})}))};
}
export function createBanking(db,settings={},dependencies={}){
 const authenticate=dependencies.authenticate||(r=>identity(r,db)),access=dependencies.access||(u=>accessFor(db,u));
 const linked=dependencies.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 return async request=>{
  const url=new URL(request.url),staff=url.pathname==='/api/bank/staff',faction=url.pathname==='/api/bank/faction',required=faction?'web.menu.game':staff?'web.bank.staff.view':'web.bank.personal.view';
  if(!['/api/bank/personal','/api/bank/staff','/api/bank/faction'].includes(url.pathname))return reply({message:'Not found.'},404);
  if(request.method!=='GET')return reply({message:'Bank transfers are handled in game.'},405);
  if(url.search)return reply({message:'This bank does not accept account or player overrides.'},400);
  const user=await authenticate(request);if(!user)return reply({message:'Sign in to view your bank.'},401);
  const rights=await access(user);if(!rights?.nodes.includes(required))return reply({message:'Bank access is not available for this account.'},403);
  try{
   const player=await linked(user);if(!player)return reply({linked:false});if(!uuid.test(player))throw Error();
   if((settings.SERVER_CONTROL_TOKEN||'').length<64)throw Error();
   const r=await(dependencies.fetcher||fetch)('http://127.0.0.1:15433'+(staff?'/bank/staff':(faction?'/bank/faction?uuid=':'/bank/player?uuid=')+encodeURIComponent(player)),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error();const raw=await r.json();
   if(faction&&!['atreides','harkonnen','corrino','ordos','fremen','veiled_concord','spacing_guild'].includes(raw.factionId))throw Error();
   const bank=projectBank(faction?{...raw,walletDunemarks:'0.00',ledger:raw.ledger?.map(row=>({...row,reference:undefined}))}:raw,{playerUuid:player,staff});if(!bank)throw Error();
   if(faction){delete bank.walletDunemarks;bank.factionId=raw.factionId;}

   if(faction){
    const verify=await(dependencies.fetcher||fetch)('http://127.0.0.1:15433/bank/faction?uuid='+encodeURIComponent(player),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(8000)});
    if(!verify.ok)throw Error();const latest=await verify.json();if(latest.playerUuid?.toLowerCase()!==player.toLowerCase()||latest.factionId!==bank.factionId)return reply({message:'Your House changed. Refresh the bank.'},409);
   }
   const currentUser=await authenticate(request);if(!currentUser||currentUser.id!==user.id)return reply({message:'Sign in again before viewing this bank.'},401);
   const currentRights=await access(currentUser);if(!currentRights?.nodes?.includes(required))return reply({message:'Bank access is no longer available for this account.'},403);
   const currentPlayer=await linked(currentUser);if(typeof currentPlayer!=='string'||!uuid.test(currentPlayer)||currentPlayer.toLowerCase()!==player.toLowerCase())return reply({message:'Your linked Minecraft account changed. Refresh before viewing this bank.'},409);
   bank.accountNumber=await (dependencies.accountNumber||imperialAccount)(db,faction?'faction':staff?'server':'player',faction?bank.factionId:staff?'network':player.toLowerCase());
   if(!staff&&!faction)bank.currentAccountNumber=await(dependencies.accountNumber||imperialAccount)(db,'current',player.toLowerCase());
   if(!staff&&!faction){
    const current=projectBank({...raw,ledger:raw.currentLedger||[]},{playerUuid:player});if(!current)throw Error();bank.currentLedger=current.ledger;
    for(const row of bank.currentLedger)row.counterparty=ledgerCounterparty((raw.currentLedger||[]).find(r=>r.id===row.id)||{},player,false,true);
   }
   for(const row of [...bank.ledger,...(bank.currentLedger||[])]){
    const counterparty=row.counterparty;delete row.counterparty;
    const number=counterparty?await(dependencies.accountNumber||imperialAccount)(db,counterparty.type,counterparty.owner):null;
    const outgoing=row.amountDunemarks.startsWith('-'),own=(bank.currentLedger||[]).includes(row)?bank.currentAccountNumber:bank.accountNumber;
    const ownName=staff?'I.D. Revenue':faction?'House '+bank.factionId:currentUser.username||'Your account';
    let otherName=null;if(counterparty?.type==='server')otherName='I.D. Revenue';else if(counterparty?.owner===player.toLowerCase())otherName=currentUser.username||'Your account';else if(counterparty?.type==='player')otherName=await(dependencies.accountName|| (async owner=>(await db.prepare('SELECT a.username FROM site_game_links l JOIN site_accounts a ON a.id=l.user_id WHERE l.minecraft_uuid=?').bind(owner).first())?.username||'Account holder'))(counterparty.owner);
    row.fromName=outgoing?ownName:otherName;row.toName=outgoing?otherName:ownName;
    row.fromAccount=row.fromAccount||(outgoing?own:number);
    row.toAccount=row.toAccount||(outgoing?number:own);
   }
   return reply({linked:staff?undefined:true,bank,canManage:faction?false:staff?currentRights.nodes.includes('web.bank.staff.manage'):true});
  }catch{return reply({message:'The Dunemarks bank is temporarily unavailable. Refresh to check the current balance.'},503);}
 };
}

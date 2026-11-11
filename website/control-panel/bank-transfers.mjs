import {imperialAccount,validAccountNumber} from './imperial-accounts.mjs';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function createBankTransfers(db,settings={},deps={}){
 const auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u));
 const linked=deps.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 const excluded=deps.excluded||(async u=>!!await db.prepare("SELECT id FROM site_accounts WHERE id=? AND (role IN ('official_account','memorial') OR password_hash LIKE '!%' OR EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=site_accounts.id AND p.game_link_exempt=1))").bind(u.id).first());
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 const resolve=deps.resolve||(async(number,name)=>{
  if(!validAccountNumber(number)||!/^DR\d{2}(?:101|102)/.test(number.replaceAll(' ','')))return null;const raw=number.replaceAll(' ','');
  return db.prepare("SELECT b.owner_key AS player,b.bank_type,a.username FROM imperial_bank_accounts b JOIN site_game_links l ON l.minecraft_uuid=b.owner_key JOIN site_accounts a ON a.id=l.user_id WHERE b.id=? AND b.bank_type=? AND a.username=? AND a.role NOT IN ('official_account','memorial') AND a.password_hash NOT LIKE '!%' AND NOT EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=a.id AND p.game_link_exempt=1)").bind(Number(raw.slice(7,16)),raw.slice(4,7)==='102'?'current':'player',name).first();
 });
 return async request=>{
  const external=new URL(request.url).pathname==='/api/bank/remittance';
  if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
  if(new URL(request.url).search)return reply({message:'Account overrides are not accepted.'},400);
  if(request.headers.get('origin')!==origin)return reply({message:'Invalid request origin.'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply({message:'JSON required.'},415);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const permitted=async u=>(await access(u))?.nodes?.includes('web.bank.personal.view')&&!await excluded(u);
  if(!await permitted(user))return reply({message:'Personal bank access required.'},403);
  const text=await request.text();if(text.length>2000)return reply({message:'Request too large.'},413);
  let data;try{data=JSON.parse(text);}catch{return reply({message:'Invalid transfer.'},400);}
  if(!data||Object.keys(data).some(k=>!['source','amount','requestId','memo','confirmed',...(external?['recipientAccount','recipientName']:[])].includes(k))||data.confirmed!==true||!['current','savings'].includes(data.source)||typeof data.amount!=='string'||! /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(data.amount)||Number(data.amount)<=0||Number(data.amount)>1000000||!uuid.test(data.requestId||'')||typeof data.memo!=='string'||data.memo.length>140||/[\x00-\x1f]/.test(data.memo))return reply({message:'Check the amount, reference and confirmation.'},400);
  if(external&&data.source!=='current')return reply({message:'Use your current account for payments to other accounts.'},400);
  const player=(await linked(user))?.toLowerCase();if(!uuid.test(player||''))return reply({message:'Link your Minecraft account first.'},403);
  let recipient=null,fromNumber=null;
  if(external){
   if(typeof data.recipientAccount!=='string'||typeof data.recipientName!=='string'||data.recipientName.length>80)return reply({message:'Select a verified recipient.'},400);
   recipient=await resolve(data.recipientAccount,data.recipientName);if(!recipient||!uuid.test(recipient.player)||recipient.player===player)return reply({message:'Recipient changed or invalid. Check the account again; use Current & Savings for your own accounts.'},409);
   fromNumber=await(deps.accountNumber||imperialAccount)(db,data.source==='current'?'current':'player',player);
  }
  const current=await auth(request);if(!current||current.id!==user.id||!await permitted(current)||(await linked(current))?.toLowerCase()!==player)return reply({message:'Account access changed. Refresh before submitting.'},409);
  if(external){
   const verified=await resolve(data.recipientAccount,data.recipientName);
   if(!verified||verified.player!==recipient.player||
      verified.bank_type!==recipient.bank_type)
    return reply({message:'Recipient account changed. Verify the recipient again.'},409);
   const sender=await db.prepare(
    'SELECT owner_key FROM imperial_bank_accounts WHERE bank_type=? AND owner_key=?'
   ).bind('current',player).first();
   if(!sender||sender.owner_key!==player)
    return reply({message:'Sender account unavailable.'},409);
  }
  if((settings.SERVER_CONTROL_TOKEN||'').length<64)return reply({message:'Transfers unavailable.'},503);
  try{
   const result=await(deps.fetcher||fetch)('http://127.0.0.1:15433/bank/'+(external?'remittance':'transfer-own'),{method:'POST',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({player,source:data.source,amount:data.amount,request_id:data.requestId,memo:data.memo,...(external?{target:recipient.player,target_type:recipient.bank_type==='current'?'current':'savings',from_number:fromNumber,to_number:data.recipientAccount}:{})}),signal:AbortSignal.timeout(12000)});
   if(!result.ok)return reply({message:result.status===409?'Transfer declined: insufficient funds, changed request or unavailable account. No transfer was confirmed.':'Transfer could not be confirmed. Retry the same request to check its result.'},result.status===409?409:503);
   const body=await result.json();if(body.reference!==data.requestId)throw Error();return reply({transfer:body});
  }catch{return reply({message:'Confirmation unavailable. Retry this same request; do not create a replacement payment.'},503);}
 };
}

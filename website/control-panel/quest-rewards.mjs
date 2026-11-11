import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {gameAuthorized,validUuid} from '../node/game-link.mjs';

export const QUEST_ID='imperial-portal-eye-ra-v1';
const AMOUNT=1000;
const sha=value=>createHash('sha256').update(value).digest('hex');
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const canonical=body=>`quest-discovery-v1\n${QUEST_ID}\n${body.uuid}\n${body.nonce}\n${body.expires}`;
const codeFor=(secret,accountId,body)=>'DRQ-'+createHmac('sha256',secret).update(`quest-code-v1\n${QUEST_ID}\n${accountId}\n${body.uuid}\n${body.nonce}`).digest('hex').slice(0,40).toUpperCase();
async function smallJson(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('Body too large');chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

/** Only trusted game code may attest the actual hidden GUI interaction. No browser
 * route accepts discoveries, amounts, UUID overrides or caller-selected quest IDs.
 * PostgreSQL owns the first-finder lock, one-use code and atomic fixed-size credit. */
export function createQuestRewards(db,settings,pool,dependencies={}){
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 const authenticate=dependencies.authenticate||(request=>identity(request,db));
 const access=dependencies.access||(user=>accessFor(db,user));
 const now=dependencies.now||Date.now,attempts=new Map();
 const query=(text,values)=>pool.query({text,values,query_timeout:5000});
 function allowed(key){
  const time=now();for(const [id,row]of attempts)if(row.until<=time)attempts.delete(id);
  let row=attempts.get(key);if(!row){if(attempts.size>=5000)return false;attempts.set(key,row={count:0,until:time+60000});}
  return ++row.count<=10;
 }
 async function linkedUser(uuid){return db.prepare('SELECT a.id,a.username,a.role FROM site_game_links l JOIN site_accounts a ON a.id=l.user_id WHERE l.minecraft_uuid=?').bind(uuid).first();}
 return async request=>{
  const path=new URL(request.url).pathname;
  if(!['/api/game/quest/discover','/api/quest/rewards','/api/quest/rewards/claim'].includes(path))return reply({message:'Not found'},404);
  if(path==='/api/game/quest/discover'){
   if(request.method!=='POST')return reply({message:'Method not allowed'},405);
   if(!gameAuthorized(request,settings))return reply({message:'Unauthorized'},401);
   let body;try{body=await smallJson(request);}catch{return reply({message:'Invalid discovery.'},400);}
   const time=now();
   if(!body||!validUuid(body.uuid)||body.quest!==QUEST_ID||!/^[a-f0-9]{64}$/.test(body.nonce||'')||!/^[a-f0-9]{64}$/.test(body.proof||'')||!Number.isSafeInteger(body.expires)||body.expires<=time||body.expires>time+45000)return reply({message:'Invalid or expired discovery.'},400);
   const expected=createHmac('sha256',settings.GAME_LINK_SECRET).update(canonical(body)).digest();
   if(!timingSafeEqual(expected,Buffer.from(body.proof,'hex')))return reply({message:'Invalid discovery proof.'},403);
   if(!allowed('discover:'+body.uuid))return reply({message:'Wait a minute before trying again.'},429);
   try{
    const user=await linkedUser(body.uuid);
    if(!user||!validUuid(user.id))return reply({message:'Link your Minecraft identity in Account Center before collecting this discovery.'},403);
    if(!(await access(user)).nodes.includes('web.menu.game'))return reply({message:'Game account access is required.'},403);
    const code=codeFor(settings.GAME_LINK_SECRET,user.id,body);
    const result=await query('SELECT outcome FROM public.dune_quest_register($1::uuid,$2::uuid,$3::text,$4::text)',[user.id,body.uuid,sha(code),sha(body.proof)]);
    const outcome=result.rows[0]?.outcome;
    if(outcome==='taken')return reply({message:'This discovery has already been found.'},409);
    if(outcome==='redeemed')return reply({ok:true,redeemed:true,amount:AMOUNT,message:'Your discovery reward was already redeemed.'});
    if(!['issued','reissued'].includes(outcome))throw Error('Unexpected discovery result');
    return reply({ok:true,code,amount:AMOUNT,redeemUrl:origin+'/#game',message:'Redeem this account-bound code in Account Center. It can be used once.'});
   }catch{return reply({message:'Discovery rewards are temporarily unavailable. Try the discovery again shortly.'},503);}
  }
  if(request.method!==(path.endsWith('/claim')?'POST':'GET'))return reply({message:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply({message:'Request origin rejected.'},403);
  try{
   const user=await authenticate(request);if(!user)return reply({message:'Sign in first.'},401);
   if(!validUuid(user.id)||!(await access(user)).nodes.includes('web.menu.game'))return reply({message:'Game account access is required.'},403);
   const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first();
   if(!validUuid(link?.minecraft_uuid))return reply({linked:false,message:'Link your Minecraft identity before redeeming a discovery code.'},403);
   if(request.method==='GET'){
    const result=await query('SELECT available,discovered,redeemed FROM public.dune_quest_status($1::uuid,$2::uuid)',[user.id,link.minecraft_uuid]);
    const row=result.rows[0];if(!row||[row.available,row.discovered,row.redeemed].some(value=>typeof value!=='boolean'))throw Error('Unexpected reward status');
    return reply({linked:true,amount:AMOUNT,available:row.available,discovered:row.discovered,redeemed:row.redeemed});
   }
   if(!allowed('claim:'+user.id))return reply({message:'Wait a minute before trying another code.'},429);
   let body;try{body=await smallJson(request);}catch{return reply({message:'Enter a valid discovery code.'},400);}
   const code=typeof body?.code==='string'?body.code.trim().toUpperCase():'';
   if(!/^DRQ-[A-F0-9]{40}$/.test(code))return reply({message:'Enter a valid discovery code.'},400);
   const result=await query('SELECT outcome FROM public.dune_quest_claim($1::uuid,$2::uuid,$3::text)',[user.id,link.minecraft_uuid,sha(code)]);
   const outcome=result.rows[0]?.outcome;
   if(outcome==='invalid')return reply({message:'This code is invalid for your currently linked account.'},409);
   if(!['credited','already_redeemed'].includes(outcome))throw Error('Unexpected redemption result');
   return reply({ok:true,credited:outcome==='credited',amount:AMOUNT,message:outcome==='credited'?'1,000 Dunemarks credited to your game wallet.':'This reward was already redeemed; no duplicate Dunemarks were credited.'});
  }catch{return reply({message:'Discovery rewards are temporarily unavailable.'},503);}
 };
}

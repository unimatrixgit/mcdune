import {nativeSyncChange} from './native-sync-outbox.mjs';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {identity} from './auth.mjs';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function gameAuthorized(request,settings){const secret=settings.GAME_LINK_SECRET||'';return secret.length>=32&&timingSafeEqual(Buffer.from(digest(request.headers.get('authorization')||'')),Buffer.from(digest('Bearer '+secret)));}
export const validUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export function createGameLink(db,settings,origin){
 const attempts=new Map();
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/game-link/consume'){
   if(request.method!=='POST')return json({message:'Method not allowed'},405);
   if(!gameAuthorized(request,settings))return json({message:'Unauthorized'},401);
   let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
   if(!/^[a-f0-9]{32}$/.test(body.code||'')||!validUuid(body.uuid)||!/^[A-Za-z0-9_.-]{1,32}$/.test(body.name||''))return json({message:'Invalid request'},400);
   const now=Date.now(),token=digest(body.code);
   try{
    const result=await db.batch([
     db.prepare('INSERT INTO site_game_links(user_id,minecraft_uuid,minecraft_name,linked_at) SELECT user_id,?,?,? FROM site_link_challenges WHERE token_hash=? AND expires_at>?').bind(body.uuid,body.name,now,token,now),
     db.prepare('INSERT INTO site_game_identities(minecraft_uuid,first_linked_at,last_name) SELECT minecraft_uuid,linked_at,minecraft_name FROM site_game_links WHERE minecraft_uuid=? ON CONFLICT(minecraft_uuid) DO UPDATE SET last_name=excluded.last_name').bind(body.uuid),
     db.prepare('UPDATE site_clan_members SET minecraft_uuid=(SELECT minecraft_uuid FROM site_game_links WHERE user_id=site_clan_members.user_id) WHERE user_id IN (SELECT user_id FROM site_link_challenges WHERE token_hash=? AND expires_at>?)').bind(token,now),
     db.prepare('DELETE FROM site_link_challenges WHERE token_hash=?').bind(token),nativeSyncChange(db)
    ]);
    return result[0].meta.changes?json({ok:true}):json({message:'Code expired, used or invalid.'},409);
   }catch(error){if(error.code==='ER_DUP_ENTRY'||String(error.message).includes('UNIQUE'))return json({message:'This website or game account is already linked. Unlink before linking again.'},409);throw error;}
  }
  const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
  if(request.method==='GET'&&path==='/api/game-link'){
   const link=await db.prepare('SELECT l.minecraft_uuid,l.minecraft_name,l.linked_at,i.first_linked_at FROM site_game_links l LEFT JOIN site_game_identities i ON i.minecraft_uuid=l.minecraft_uuid WHERE l.user_id=?').bind(user.id).first();
   return json({linked:!!link?.minecraft_uuid,link:link?.minecraft_uuid?link:null});
  }
  if(request.method!=='POST')return json({message:'Method not allowed'},405);
  if(request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
  const now=Date.now();for(const [key,time]of attempts)if(now-time>60000)attempts.delete(key);
  if(path==='/api/game-link/unlink'){
   await db.batch([db.prepare('UPDATE site_clan_members SET minecraft_uuid=NULL WHERE user_id=?').bind(user.id),db.prepare('DELETE FROM site_game_links WHERE user_id=?').bind(user.id),db.prepare('DELETE FROM site_link_challenges WHERE user_id=?').bind(user.id),nativeSyncChange(db)]);return json({ok:true});
  }
  if(path!=='/api/game-link')return json({message:'Not found'},404);
  if(attempts.size>=5000||now-(attempts.get(user.id)||0)<30000)return json({message:'Wait 30 seconds before trying again.'},429);
  if((settings.GAME_LINK_SECRET||'').length<32)return json({message:'Game linking is not configured yet.'},503);
  if((await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first())?.minecraft_uuid)return json({message:'Unlink your current game account first.'},409);
  attempts.set(user.id,now);
  const code=randomBytes(16).toString('hex');
  await db.prepare('INSERT INTO site_link_challenges(user_id,token_hash,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at').bind(user.id,digest(code),now+600000).run();
  return json({code,expiresAt:now+600000,command:'/linkwebsite '+code});
 };
}

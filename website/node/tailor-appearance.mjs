import {createHash} from 'node:crypto';
import {identity} from './auth.mjs';
import {minecraftSkins,skinIdentity} from './minecraft-skins.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
const json=(body,status=200)=>Response.json(body,{status,headers});
function verifiedLink(link){
 const skin=skinIdentity(link?.minecraft_uuid),linkedAt=Number(link?.linked_at);
 return skin&&Number.isSafeInteger(linkedAt)&&linkedAt>0?{uuid:skin.uuid,linkedAt}:null;
}
const stamp=(user,link)=>createHash('sha256').update(JSON.stringify([user.id,link.uuid,link.linkedAt])).digest('hex');
export function createTailorAppearance(db,{authenticate=request=>identity(request,db),resolveSkin=uuid=>minecraftSkins.resolve(uuid),now=Date.now}={}){
 const windows=new Map();
 const getLink=async user=>verifiedLink(await db.prepare('SELECT minecraft_uuid,linked_at FROM site_game_links WHERE user_id=?').bind(user.id).first());
 return async request=>{
  const url=new URL(request.url),image=url.pathname==='/api/tailor/skin';
  if(!image&&url.pathname!=='/api/tailor/appearance')return json({message:'Not found.'},404);
  if(request.method!=='GET')return json({message:'Method not allowed.'},405);
  const user=await authenticate(request);if(!user)return json({message:'Sign in first.'},401);
  const keys=[...url.searchParams.keys()],version=url.searchParams.get('v');
  if(image?(keys.length!==1||keys[0]!=='v'||! /^[0-9a-f]{64}\.[0-9a-f]{64}$/.test(version||'')):keys.length)return json({message:'Invalid appearance request.'},400);
  const time=now();for(const[id,window]of windows)if(window.until<=time)windows.delete(id);
  let window=windows.get(user.id);if(!window){if(windows.size>=5000)return json({message:'Please try the preview again shortly.'},429);windows.set(user.id,window={until:time+60000,count:0});}
  if(++window.count>60)return json({message:'Please try the preview again shortly.'},429);
  const link=await getLink(user);
  if(!link)return image?json({message:'Appearance changed. Reload the preview.'},409):json({linked:false,model:'default',skinUrl:null});
  const revision=stamp(user,link);
  // Reject another account's or an earlier link's image before any remote lookup.
  if(image&&version.split('.')[0]!==revision)return json({message:'Appearance changed. Reload the preview.'},409);
  let skin;try{skin=await resolveSkin(link.uuid);}catch{skin=null;}
  // Remote work can overlap logout, unlink or relink. Never release the old identity's result.
  const currentUser=await authenticate(request);if(!currentUser)return json({message:'Sign in first.'},401);
  const currentLink=currentUser.id===user.id?await getLink(currentUser):null;
  if(!currentLink||stamp(currentUser,currentLink)!==revision)return json({message:'Appearance changed. Reload the preview.'},409);
  if(!skin)return image?json({message:'Linked skin is temporarily unavailable.'},404):json({linked:true,model:'default',skinUrl:null});
  if(image){
   if(version.split('.')[1]!==skin.hash)return json({message:'Appearance changed. Reload the preview.'},409);
   return new Response(skin.bytes,{headers:{...headers,'Content-Type':'image/png','Content-Length':String(skin.bytes.length)}});
  }
  return json({linked:true,model:skin.model,skinUrl:'/api/tailor/skin?v='+revision+'.'+skin.hash});
 };
}

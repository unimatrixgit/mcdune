import {identity} from '../node/auth.mjs';
export function createExchange(db,pool){return async request=>{
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 const user=await identity(request,db);if(!user)return reply({message:'Sign in first.'},401);
 if(request.method!=='GET')return reply({message:'Method not allowed'},405);
 const view=new URL(request.url).searchParams.get('view')||'all';if(!['all','mine'].includes(view))return reply({message:'Unknown listings view.'},400);
 const paused=await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind('exchange_public_enabled').first();
 if(paused?.setting_value==='false')return reply({message:'The exchange is temporarily paused.'},503);
 try{
  const link=await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(user.id).first(),linked=!!link?.minecraft_uuid;
  if(view==='mine'&&!linked)return reply({listings:[],view,linked:false,message:'Link your Minecraft account to view your listings.'});
  const result=await pool.query({text:'SELECT id::text AS id,material,display_name AS "displayName",category,origin,seller_name AS seller,quantity,price::text AS price FROM dune_exchange_listings'+(view==='mine'?' WHERE seller=$1':'')+' ORDER BY id DESC LIMIT 500',...(view==='mine'?{values:[link.minecraft_uuid]}:{}),query_timeout:5000});return reply({listings:result.rows,view,linked});
 }catch{return reply({message:'The exchange is temporarily unavailable.'},503);}
};}

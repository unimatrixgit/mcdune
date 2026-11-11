import {retiredTicketResponse} from '../node/retired-tickets.mjs';
import {randomUUID} from 'node:crypto';
import {identity} from '../node/auth.mjs';
import {can} from '../node/permissions.mjs';
import {json} from '../node/game-link.mjs';
import {handleForum} from '../worker/forum-api.mjs';
export function createCommunityAdmin(db,settings,{pool}={}){return async request=>{const retiredTickets=retiredTicketResponse(request);if(retiredTickets)return retiredTickets;
 const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
 const url=new URL(request.url),path=url.pathname,write=!['GET','HEAD'].includes(request.method),origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 if(write&&request.headers.get('origin')!==origin)return json({message:'Origin rejected'},403);
 const need=async(...nodes)=>{for(const node of nodes)if(!await can(db,user,node))return json({message:'Permission required: '+node},403);};
 const audit=(action,details)=>db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),user.id,action,details,Date.now());
 if(path==='/api/cp/bans'){
  const denied=await need('web.menu.bans',write?'web.bans.tickets':'web.bans.view');if(denied)return denied;
  let live;try{const response=await fetch('http://127.0.0.1:15433/bans',{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();live=await response.json();if(!Array.isArray(live.bans))throw Error();}catch{return json({message:'Live ban sources are unavailable.'},503);}
  if(request.method==='POST'){const staff=await need('web.tickets.staff');if(staff)return staff;let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}if(!live.bans.some(b=>b.key===body.banKey))return json({message:'Ban not found in the connected sources'},404);const ticket=await db.prepare('SELECT id FROM support_tickets WHERE id=?').bind(body.ticketId||'').first();if(!ticket)return json({message:'Support ticket not found'},404);await db.batch([db.prepare('INSERT INTO moderation_ticket_links(ban_key,ticket_id,actor_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(ban_key) DO UPDATE SET ticket_id=excluded.ticket_id,actor_id=excluded.actor_id,updated_at=excluded.updated_at').bind(body.banKey,body.ticketId,user.id,Date.now()),audit('ban-ticket',body.banKey+' -> '+body.ticketId)]);return json({ok:true});}
  if(request.method!=='GET')return json({message:'Method not allowed'},405);const {results:links}=await db.prepare('SELECT ban_key,ticket_id FROM moderation_ticket_links').all();return json({...live,bans:live.bans.map(b=>({...b,ticketId:links.find(l=>l.ban_key===b.key)?.ticket_id||null}))});
 }
 if(path.startsWith('/api/cp/forum')){
  const denied=await need('web.menu.forum',write?'web.forum.moderate':'web.forum.view');if(denied)return denied;
  const headers=new Headers(request.headers);for(const key of [...headers.keys()])if(key.startsWith('oai-')||key.startsWith('x-internal-'))headers.delete(key);
  headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email','cp-forum-staff@internal.invalid');
  if(write)await audit('forum-moderation',path.slice(0,200)).run();
  return handleForum(new Request(origin+path.replace('/api/cp/forum','/api/forum')+url.search,{method:request.method,headers,...(write?{body:request.body,duplex:'half'}:{})}),{DB:db,FORUM_ADMIN_EMAILS:'cp-forum-staff@internal.invalid'});
 }
 if(path==='/api/cp/exchange'){
  const denied=await need('web.menu.exchange',write?'web.exchange.manage':'web.exchange.view');if(denied)return denied;
  if(request.method==='POST'){let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}if(typeof body.enabled!=='boolean')return json({message:'Choose enabled or paused'},400);await db.batch([db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at').bind('exchange_public_enabled',String(body.enabled),Date.now()),audit('exchange-visibility',String(body.enabled))]);return json({ok:true});}
  if(request.method!=='GET')return json({message:'Method not allowed'},405);
  const setting=await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind('exchange_public_enabled').first();
  try{const result=await pool.query({text:'SELECT id::text,material,category,origin,seller_name,quantity,price::text FROM dune_exchange_listings ORDER BY id DESC LIMIT 500',query_timeout:5000});return json({enabled:setting?.setting_value!=='false',listings:result.rows,connected:true});}catch{return json({enabled:setting?.setting_value!=='false',listings:[],connected:false,message:'The game exchange is unavailable.'});}
 }
 if(path.startsWith('/api/cp/posts')){
  const denied=await need('web.menu.posts',write?'web.posts.edit':'web.posts.view');if(denied)return denied;
  if(path==='/api/cp/posts'&&request.method==='GET'){const {results:posts}=await db.prepare("SELECT * FROM website_posts WHERE status<>'deleted' ORDER BY updated_at DESC,id DESC LIMIT 200").all();const {results:categories}=await db.prepare('SELECT * FROM website_post_categories ORDER BY label').all();return json({posts,categories});}
  if(path==='/api/cp/posts/delete'&&request.method==='POST'){
   let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
   if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||!Number.isInteger(body.version))return json({message:'Refresh the post before deleting.'},400);
   const post=await db.prepare('SELECT id,status,version FROM website_posts WHERE id=?').bind(body.id).first();
   if(!post||post.status==='deleted')return json({message:'Post not found'},404);
   if(post.status!=='draft'&&!await can(db,user,'web.posts.publish'))return json({message:'Permission required: web.posts.publish'},403);
   if(Number(post.version)!==body.version)return json({message:'This post changed elsewhere. Refresh before deleting.'},409);
   const result=await db.batch([db.prepare("UPDATE website_posts SET status='deleted',updated_at=?,version=version+1 WHERE id=? AND version=?").bind(Date.now(),body.id,body.version),audit('post-delete',body.id+' previous status: '+post.status)]);
   if(!result[0].meta.changes)return json({message:'This post changed elsewhere. Refresh before deleting.'},409);
   return json({ok:true});
  }
  if(path!=='/api/cp/posts/save'||request.method!=='POST')return json({message:'Not found'},404);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request'},400);}
  if(typeof body.title!=='string'||body.title.trim().length<5||body.title.length>120||typeof body.body!=='string'||body.body.trim().length<10||body.body.length>12000||!['draft','published','archived'].includes(body.status))return json({message:'Enter a title of 5–120 characters and a post of 10–12000 characters.'},400);
  const category=await db.prepare('SELECT category_key FROM website_post_categories WHERE category_key=?').bind(body.category||'').first();if(!category)return json({message:'Choose a news category.'},400);
  const previous=body.id?await db.prepare('SELECT id,status,published_at,version FROM website_posts WHERE id=?').bind(body.id).first():null;
  if(body.id&&(!previous||previous.status==='deleted'))return json({message:'Post not found'},404);
  if((body.status!=='draft'||previous&&previous.status!=='draft')&&!await can(db,user,'web.posts.publish'))return json({message:'Permission required: web.posts.publish'},403);
  const now=Date.now(),id=previous?.id||randomUUID(),published=body.status==='published'?(previous?.published_at||now):previous?.published_at||null;
  if(previous){if(!Number.isInteger(body.version))return json({message:'Refresh the post before saving'},409);const result=await db.batch([db.prepare('UPDATE website_posts SET category=?,title=?,body=?,status=?,updated_at=?,published_at=?,version=version+1 WHERE id=? AND version=?').bind(body.category,body.title.trim(),body.body.trim(),body.status,now,published,id,body.version),audit('post-save',id+' '+body.status)]);if(!result[0].meta.changes)return json({message:'This post changed elsewhere. Refresh before saving.'},409);}else await db.batch([db.prepare('INSERT INTO website_posts(id,category,title,body,status,author_id,created_at,updated_at,published_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)').bind(id,body.category,body.title.trim(),body.body.trim(),body.status,user.id,now,now,published),audit('post-create',id+' '+body.status)]);
  return json({id,ok:true});
 }
 return json({message:'Not found'},404);
};}

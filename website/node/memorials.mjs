import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {identity} from './auth.mjs';
import {accessFor} from './permissions.mjs';
import {honoursFor,honourMarkup,HONOUR_CSS} from './honours.mjs';
import {SHARED_HEAD,SHARED_HEADER} from '../scripts/portal-navigation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export function condolenceText(value){return typeof value==='string'&&Array.from(value.trim()).length>=3&&Array.from(value).length<=2000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);}
export async function memorialRoleStatements(db,target,keys){
 if(!keys.includes('memorial'))return [];
 if(await db.prepare('SELECT slug FROM site_memorials WHERE user_id=?').bind(target.id).first())return [];
 const account=await db.prepare('SELECT username,display_name FROM site_accounts WHERE id=?').bind(target.id).first();
 const slug=account.username.toLowerCase().replaceAll('_','-');
 return [db.prepare('INSERT INTO site_memorials(slug,user_id,title,summary) VALUES(?,?,?,?) ON CONFLICT(slug) DO UPDATE SET user_id=excluded.user_id').bind(slug,target.id,account.display_name+' — Community Memorial','A community remembrance maintained by DuneRealms. Share a respectful memory or message below.')];
}
export async function memorialPortalBlock(db){
 const {results}=await db.prepare("SELECT m.slug,m.title,m.summary,a.display_name FROM site_memorials m JOIN site_accounts a ON a.id=m.user_id WHERE a.role='memorial' OR EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key='memorial') ORDER BY m.title,m.slug").all();
 if(!results.length)return '';
 return '<section class="portal-memorials" aria-labelledby="portal-memorials-title"><header><p class="memorial-kicker">THE IMPERIAL BOOK OF REMEMBRANCE</p><h2 id="portal-memorials-title">Community memorials</h2><p>Remembered by our community. These are tribute pages, never personal or official accounts.</p></header><div class="portal-memorial-grid">'+results.map(m=>'<article><img src="/assets/seals/order-crysknife-v1.png" alt="DuneRealms remembrance seal" width="96" height="96"><h3>'+esc(m.display_name.replace(/\s*[—-]\s*Memorial$/i,''))+'</h3><p>Community memorial · account locked</p><a href="/memorial/'+encodeURIComponent(m.slug)+'">Visit memorial &amp; condolences →</a></article>').join('')+'</div></section>';
}
export function createMemorials(db,settings={}){return async request=>{
 const url=new URL(request.url),path=url.pathname,origin=new URL(settings.PUBLIC_ORIGIN||'https://www.dunerealms.com').origin;
 if(path==='/memorial.css')return new Response(HONOUR_CSS+await readFile(new URL('./public/memorial.css',import.meta.url),'utf8'),{headers:{'Content-Type':'text/css; charset=utf-8'}});
 if(path==='/memorial.js')return new Response(await readFile(new URL('./public/memorial.js',import.meta.url),'utf8'),{headers:{'Content-Type':'text/javascript; charset=utf-8'}});
 const api=path.match(/^\/api\/memorials\/([a-z0-9-]{3,64})(?:\/(decision|session))?$/);
 if(api){
  const memorial=await db.prepare('SELECT slug FROM site_memorials WHERE slug=?').bind(api[1]).first();if(!memorial)return json({message:'Memorial not found.'},404);
  const actor=await identity(request,db);if(!actor)return json({message:'Sign in to participate.'},401);
  const rights=await accessFor(db,actor),moderator=rights.nodes.includes('web.posts.publish');
  if(api[2]==='session')return request.method==='GET'?json({authenticated:true,username:actor.username,canModerate:moderator}):json({message:'Method rejected.'},405);
  if(request.method==='GET'&&!api[2]){
   if(!moderator)return json({message:'Moderation permission required.'},403);
   const {results}=await db.prepare("SELECT c.id,c.body,c.version,a.username FROM site_condolences c JOIN site_accounts a ON a.id=c.user_id WHERE c.memorial_slug=? AND c.status='pending' ORDER BY c.created_at LIMIT 50").bind(api[1]).all();return json({pending:results});
  }
  if(request.method!=='POST'||request.headers.get('origin')!==origin)return json({message:'Origin or method rejected.'},403);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({message:'Invalid request.'},400);
  if(api[2]){
   if(!moderator)return json({message:'Moderation permission required.'},403);
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id)||!['approved','denied'].includes(body.status)||!Number.isSafeInteger(body.version))return json({message:'Invalid decision.'},400);
   const result=await db.batch([db.prepare("UPDATE site_condolences SET status=?,reviewed_by=?,reviewed_at=?,version=version+1 WHERE id=? AND memorial_slug=? AND status='pending' AND version=?").bind(body.status,actor.id,Date.now(),body.id,api[1],body.version),db.prepare('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(randomUUID(),actor.id,'condolence-review',body.id+' '+body.status,Date.now())]);
   return result[0].meta.changes?json({ok:true}):json({message:'This message has already been reviewed.'},409);
  }
  if(!condolenceText(body.message)||body.website||Object.keys(body).some(k=>!['message','website'].includes(k)))return json({message:'Use a respectful message of 3–2,000 characters.'},400);
  const recent=await db.prepare('SELECT COUNT(*) AS n FROM site_condolences WHERE user_id=? AND created_at>?').bind(actor.id,Date.now()-86400000).first();if(Number(recent?.n)>=3)return json({message:'Please wait before posting another tribute.'},429);
  const text=body.message.replaceAll('\r\n','\n').trim(),hash=createHash('sha256').update(text).digest('hex');
  try{await db.prepare("INSERT INTO site_condolences(id,memorial_slug,user_id,body,body_hash,status,created_at,version) VALUES(?,?,?,?,?,'pending',?,1)").bind(randomUUID(),api[1],actor.id,text,hash,Date.now()).run();}catch(e){if(e.code==='ER_DUP_ENTRY'||String(e.message).includes('UNIQUE'))return json({message:'This tribute has already been submitted.'},409);throw e;}
  return json({ok:true,message:'Thank you. Your condolence will appear after review.'},201);
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const match=path.match(/^\/(memorial|people)\/([a-z0-9_-]{3,64})$/);if(!match)return new Response('Not found',{status:404});
 let account,memorial=null;
 if(match[1]==='memorial') {memorial=await db.prepare('SELECT * FROM site_memorials WHERE slug=?').bind(match[2]).first();if(memorial)account=await db.prepare('SELECT id,username,display_name,role FROM site_accounts WHERE id=?').bind(memorial.user_id).first();}
 else {
  account=await db.prepare("SELECT id,username,display_name,role FROM site_accounts WHERE username=? AND (password_hash NOT LIKE '!%' OR password_hash='!memorial')").bind(match[2]).first();
  if(account){const tribute=await db.prepare('SELECT slug FROM site_memorials WHERE user_id=?').bind(account.id).first();if(tribute)return Response.redirect(origin+'/memorial/'+encodeURIComponent(tribute.slug),302);}
 }
 if(!account)return new Response('Profile not found',{status:404});
 if(memorial&&account.role!=='memorial'&&!(await accessFor(db,account)).ranks.includes('memorial'))return new Response('Memorial not found',{status:404});
 const honours=account.username.toLowerCase()==='dunerealms'?[]:await honoursFor(db,account);let content='';
 if(memorial){
  const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>10000)return json({message:'Invalid page.'},400);
  const count=await db.prepare("SELECT COUNT(*) AS n FROM site_condolences WHERE memorial_slug=? AND status='approved'").bind(memorial.slug).first();
  const {results}=await db.prepare("SELECT c.body,c.created_at,a.display_name,a.password_hash FROM site_condolences c JOIN site_accounts a ON a.id=c.user_id WHERE c.memorial_slug=? AND c.status='approved' ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET ?").bind(memorial.slug,(page-1)*20).all();
  const pages=Math.max(1,Math.ceil(Number(count?.n)/20));
  content='<section class="memorial-box"><h2>Leave a condolence</h2><p>Sign in with your community account to post. Messages are reviewed before appearing. Please do not include private contact details.</p><form id="condolence-form" data-slug="'+esc(memorial.slug)+'"><label>Your message<textarea name="message" rows="6" minlength="3" maxlength="2000" required></textarea></label><input name="website" tabindex="-1" autocomplete="off" class="memorial-trap" aria-hidden="true"><button type="submit">Submit condolence</button><a id="memorial-signin" href="https://cp.dunerealms.com/memorial-login?slug='+encodeURIComponent(memorial.slug)+'">Sign in</a><p id="condolence-status" role="status"></p></form></section><section class="memorial-box"><h2>Community condolences</h2>'+(!results.length?'<p>No condolences have been published yet.</p>':results.map(r=>'<article class="condolence"><strong>'+esc(r.password_hash.startsWith('!')?'Former community member':r.display_name)+'</strong><p>'+esc(r.body)+'</p></article>').join(''))+'<nav class="memorial-pagination" aria-label="Condolence pages">'+(page>1?'<a href="?page='+(page-1)+'">Previous</a>':'')+'<span>Page '+page+' of '+pages+'</span>'+(page<pages?'<a href="?page='+(page+1)+'">Next</a>':'')+'</nav></section><section class="memorial-box" id="condolence-moderation" hidden><h2>Pending condolences</h2><div id="condolence-queue"></div></section>';
 }
 if(!memorial)content='<section class="member-profile-content" id="member-profile" data-username="'+esc(account.username)+'"><div class="memorial-box member-profile-access"><h2>Community profile</h2><p id="member-profile-status" role="status">Checking your DuneRealms session…</p><a id="member-profile-signin" href="https://cp.dunerealms.com/profile-login?username='+encodeURIComponent(account.username)+'">Sign in to view profile</a></div><div id="member-profile-boxes" class="member-profile-grid" hidden></div></section>';
 const title=memorial?.title||account.display_name||account.username;
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | DuneRealms</title>'+SHARED_HEAD+'<link rel="stylesheet" href="/memorial.css?v=people-awards-v3"></head><body>'+SHARED_HEADER+'<main class="memorial-main '+(!memorial?'people-main':'')+'"><header class="memorial-box memorial-hero"><p class="memorial-kicker">'+(memorial?'IN MEMORY · COMMUNITY MEMORIAL':'THE IMPERIAL REGISTER · COMMUNITY PROFILE')+'</p><h1>'+esc(title)+'</h1><p>'+esc(memorial?.summary||'DuneRealms community member')+'</p>'+(memorial?'<aside class="memorial-disclaimer"><strong>Community memorial — not the person’s personal or official account.</strong><br>Independently maintained by DuneRealms. Not affiliated with the person’s family, representatives or estate. This account cannot sign in or act as this person.</aside>':'')+'</header>'+honourMarkup(honours)+content+'</main><script src="/memorial.js?v=people-awards-v3" defer></script></body></html>';
 return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
};}

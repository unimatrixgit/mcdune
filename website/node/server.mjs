import {startForumNewsWorker} from './forum-news.mjs';
import{firstLoginGate}from './first-login.mjs';
import {startDiscordNewsWorker} from './discord-news.mjs';
import {createMemorials,memorialPortalBlock} from './memorials.mjs';
import {earnedMemberSeal} from './member-profiles.mjs';
import {createPublicKitMarket} from './kit-catalogue.mjs';
import {retiredTicketResponse} from './retired-tickets.mjs';
import {startNativeSyncRetryWorker} from './native-sync-outbox.mjs';
import {initializeMailIdentities} from './mail-identity.mjs';
import {startStaffMailSync} from './staff-mail.mjs';
import {createGitIdentityRoute,initializeGitIdentities,startGitIdentitySync,gitProxyIdentity} from './git-identity.mjs';
import {createStaffRoster} from './staff-roster.mjs';
import {createSearchVisibility} from './search-visibility.mjs';
import {initializeBadges} from './community-badges.mjs';
import {initializeRanks,can} from './permissions.mjs';
import {controlPanelRedirect} from './cp-redirects.mjs';
import {sharedErrorResponse} from './shared-errors.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../dist/server/index.js';
import {openDatabase} from './mysql.mjs';
import {createAuth,identity,safeReturn} from './auth.mjs';
import {createWorldStatus} from './world-status.mjs';
import {createForgejoProxy} from './forgejo-proxy.mjs';
import {createContact} from './contact.mjs';
import {createGameLink} from './game-link.mjs';
import {createCommunityRewards} from './community-rewards.mjs';
import {createPublicNews,initializeNews} from './news.mjs';
import {publicBanCards,publicBanList,publicAppealCards,publicAccountBans} from './public-bans.mjs';
const root=new URL('./public/',import.meta.url);
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; frame-src 'self' https://cp.dunerealms.com; img-src 'self' data: https://www.dunerealms.com https://cp.dunerealms.com; style-src 'self' https://www.dunerealms.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' https://www.dunerealms.com; connect-src 'self' https://cp.dunerealms.com https://www.dunerealms.com; base-uri 'self'; object-src 'none'; frame-ancestors 'self'"};
export function createApplication(db,settings={}) {
  const origin=new URL(settings.PUBLIC_ORIGIN||'https://dunerealms.com').origin;
  const auth=createAuth(db,origin,settings);const gitIdentity=createGitIdentityRoute(db,settings,origin);
  const worldStatus=createWorldStatus(settings),publicKitMarket=createPublicKitMarket(settings);
  const contact=createContact(settings);
  const memorials=createMemorials(db,settings);
  const gameLink=createGameLink(db,settings,origin);
  const rewards=createCommunityRewards(db,settings,origin);
  const news=createPublicNews(db);const search=createSearchVisibility(db);const staffRoster=createStaffRoster(db);
  return async function handle(request) {
    const onboarding=await firstLoginGate(request,db);if(onboarding)return onboarding;
    const url=new URL(request.url);const retiredTickets=retiredTicketResponse(request);if(retiredTickets)return retiredTickets;
    const earnedSeal=earnedMemberSeal(request);if(earnedSeal)return earnedSeal;
    if(url.pathname.startsWith('/memorial/')||url.pathname.startsWith('/people/')||url.pathname.startsWith('/api/memorials/')||['/memorial.css','/memorial.js'].includes(url.pathname))return memorials(request);
    if(['/staff.html','/staff-roster.css'].includes(url.pathname))return staffRoster(request);
    const searchRoute=await search.route(request);if(searchRoute)return searchRoute;
    const sharedError=await sharedErrorResponse(request);if(sharedError)return sharedError;
    const redirect=controlPanelRedirect(request,settings);if(redirect)return redirect;
    if(url.pathname==='/api/kits/catalogue')return publicKitMarket(request);
    if(url.pathname==='/api/git/me'||url.pathname.startsWith('/git/sso/'))return gitIdentity(request);
    if(url.pathname==='/api/news'||url.pathname.startsWith('/api/news/')||url.pathname==='/api/home/forum')return news(request);
    if(url.pathname==='/api/exchange/listings'){const setting=await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind('exchange_public_enabled').first();if(setting?.setting_value==='false')return Response.json({error:'market_paused'},{status:503,headers:{'Cache-Control':'no-store'}});}
    if(url.pathname.startsWith('/api/community/'))return rewards(request);
    if(url.pathname==='/api/game-link'||url.pathname.startsWith('/api/game-link/'))return gameLink(request);
    if(url.pathname.startsWith('/api/contact/'))return contact(request);
    if(url.pathname==='/api/public/account-bans'&&request.method==='GET')return publicAccountBans(db);
    if(url.pathname==='/api/public/appeals'&&request.method==='GET')return publicAppealCards(db,request);
    if(url.pathname==='/api/public/ban-list'&&request.method==='GET')return publicBanList(db,request);
    if(url.pathname==='/api/public/bans'&&request.method==='GET')return publicBanCards(db);
    if(url.pathname==='/api/worlds')return request.method==='GET'?worldStatus().then(r=>{const h=new Headers(r.headers);h.set('Access-Control-Allow-Origin','*');return new Response(r.body,{status:r.status,headers:h});}):new Response('Method not allowed',{status:405});
    if(url.pathname==='/signin-with-chatgpt')return Response.redirect(origin+'/login.html?return_to='+encodeURIComponent(safeReturn(url.searchParams.get('return_to'))),302);
    if(url.pathname==='/healthz'){await db.prepare('SELECT 1 AS ok').first();return Response.json({status:'ok',database:'connected'},{headers:{'Cache-Control':'no-store'}});}
    if(url.pathname.startsWith('/api/auth/'))return auth(request);
    if(['/corrino-group.html','/corrino-group.js','/corrino-group.css','/forums.html','/login.html','/login.js','/login.css'].includes(url.pathname)){
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
      return new Response(request.method==='HEAD'?null:await readFile(new URL(url.pathname.slice(1),root)),{headers:{...security,'Cache-Control':'no-store','Content-Type':type+'; charset=utf-8'}});
    }
    // These identity headers are trusted by Sites, but are untrusted input on a public Node server.
    const headers=new Headers(request.headers);
    for(const key of [...headers.keys()])if(key.startsWith('oai-')||key.startsWith('x-internal-'))headers.delete(key);
    const user=await identity(request,db);
    if(user){headers.set('oai-authenticated-user-id',user.id);if(await can(db,user,'web.accounts.view'))headers.set('oai-authenticated-user-email','verified-staff@dunerealms.internal');}
    const forwarded=new Request(request.url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half'});
    const response=await worker.fetch(forwarded,{...settings,DB:db,FORUM_ADMIN_EMAILS:'verified-staff@dunerealms.internal',SUPPORT_STAFF_EMAILS:'verified-staff@dunerealms.internal'});
    const type=response.headers.get('Content-Type')||'';
    if(request.method!=='HEAD'&&(type.includes('text/html')||type.includes('javascript'))){
      let body=(await response.text()).replaceAll('Sign in with ChatGPT','Sign in to DuneRealms');if(url.pathname==='/exchange-market.js')body=body.replaceAll('/assets/spicepost-logo-v2.svg','https://cp.dunerealms.com/assets/spost-company-v1.png').replaceAll('/assets/corrino-group-logo.svg','https://cp.dunerealms.com/assets/corrino-group-v4.png').replaceAll("'SpicePost'","'Spost'");if(url.pathname==='/exchange-market.js')body=body.replace('parent.append(part,group);',"const groupLink=document.createElement('a');groupLink.href='/corrino-group.html';groupLink.setAttribute('aria-label','About Corrino Group');groupLink.append(group);parent.append(part,groupLink);");if(type.includes('text/html')&&response.status===200)body=await search.html(request,body);if(response.status===200&&type.includes('text/html')&&['/','/index.html','/portal.html'].includes(url.pathname)){const memorials=await memorialPortalBlock(db);if(memorials)body=body.replace('</head>','<link rel="stylesheet" href="/memorial.css"></head>').replace('</main>',memorials+'</main>');}
      const out=new Headers(response.headers);out.delete('Content-Length');out.set('Content-Security-Policy',security['Content-Security-Policy']);
      return new Response(body,{status:response.status,headers:out});
    }
    return response;
  };
}
export async function start(settings=process.env) {
  const db=await openDatabase(settings);await initializeGitIdentities(db);await initializeMailIdentities(db);await initializeRanks(db);await initializeBadges(db);await initializeNews(db);const handle=createApplication(db,settings),origin=new URL(settings.PUBLIC_ORIGIN||'https://dunerealms.com').origin;
  const stopDiscordNews=await startDiscordNewsWorker(db,settings);
  const stopForumNews=await startForumNewsWorker(db);
  const stopGitSync=startGitIdentitySync(db,settings),stopMailSync=startStaffMailSync(db),stopNativeSync=startNativeSyncRetryWorker(db);
  const forgejo=createForgejoProxy(settings,gitProxyIdentity(db,settings));
  const server=createServer(async(req,res)=>{
    try{
      if(forgejo(req,res))return;
      req.setTimeout(15000);
      let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const path=req.url||'/';if(!path.startsWith('/')||path.startsWith('//')){res.writeHead(400);res.end('Bad request');return;}
      const request=new Request(origin+path,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
      const result=await handle(request),outgoing=new Headers(security);for(const [key,value]of result.headers)outgoing.set(key,value);outgoing.set('Content-Security-Policy',security['Content-Security-Policy']);res.writeHead(result.status,Object.fromEntries(outgoing));res.end(Buffer.from(await result.arrayBuffer()));
    }catch(error){console.error('Request failed:',error.code||error.name);if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message:'The website is temporarily unavailable.'}));}
  });
  server.requestTimeout=300000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(settings.PORT||3000),'127.0.0.1',resolve);});
  console.log('DuneRealms website running on localhost:'+Number(settings.PORT||3000)+'; MySQL connected.');
  const shutdown=()=>{stopForumNews();stopDiscordNews();stopGitSync();stopMailSync();stopNativeSync();server.close(async()=>{await db.close();process.exit(0);});};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await start();

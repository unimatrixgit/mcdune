import {createManagedTransfers} from './managed-bank-transfer.mjs';
import {createOfficialBank} from './official-bank.mjs';
import {createBankBeneficiaries} from './bank-beneficiaries.mjs';
import {createBankTransfers} from './bank-transfers.mjs';
import {createHosting} from '../node/hosting.mjs';
import {initializeOfficeLedger,startOfficeLedger} from './election-office-ledger.mjs';
import {createMailAccounts} from '../node/mail-accounts.mjs';
import {createElectionVoting,startElectionClock} from './election-voting.mjs';
import {initializeBallots} from './election-ballots.mjs';
import {initializeRounds} from './election-rounds.mjs';
import {createImperialCharters,initializeCharters} from './imperial-charters.mjs';
import {createProclamations,initializeProclamations} from './proclamations.mjs';
import {createElectoralRoll} from '../node/electoral-roll.mjs';
import {createElectionApplications} from './election-application-route.mjs';
import {initializeApplications} from './election-applications.mjs';
import {createInternalMail,startInternalMailSync,initializeInternalMailAccess,syncClanMailRegistry} from '../node/internal-mail.mjs';
import {createPoliticsPreview} from './politics-preview.mjs';
import{createAdminRegistration}from '../node/admin-registration.mjs';
import{firstLoginGate}from '../node/first-login.mjs';
import {createContactEmail,initializeContactEmails} from '../node/contact-email.mjs';
import {isOwnerRank} from '../node/permissions.mjs';
import {createBanEvidence,initializeBanEvidence} from './ban-evidence.mjs';
import {createUpgradeTokens} from './upgrade-tokens.mjs';
import {createKitCatalogueBridge} from '../node/kit-catalogue.mjs';
import {createKitStudio} from './kit-studio.mjs';
import {startModerationSync} from './moderation.mjs';
import {createKitMarket} from './kit-market.mjs';
import {createImperialAtelier} from './imperial-atelier.mjs';
import {createGameRanks,initializeGameRanks} from '../node/game-ranks.mjs';
import {createBanking} from './banking.mjs';
import {createClanShop,initializeClanShop} from './clan-shop.mjs';
import {createQuests} from './quests.mjs';
import {createClans,initializeClans} from './clans.mjs';
import {createGameTickets} from './game-tickets.mjs';
import {createQuestRewards} from './quest-rewards.mjs';
import {openGameMysqlPool} from '../node/game-mysql-pool.mjs';
import {retiredTicketResponse} from '../node/retired-tickets.mjs';
import {createGitIdentityRoute,initializeGitIdentities,startGitIdentitySync,gitProxyIdentity} from '../node/git-identity.mjs';
import {createMailIdentityRoute,initializeMailIdentities} from '../node/mail-identity.mjs';
import {createProfile} from '../node/profile.mjs';
import {createMemorials} from '../node/memorials.mjs';
import {createMemberProfiles} from '../node/member-profiles.mjs';
import {createAvatars} from '../node/avatar.mjs';
import {createTailorAppearance} from '../node/tailor-appearance.mjs';
import {createBadgeAdmin} from '../node/badge-admin.mjs';
import {initializeBadges} from '../node/community-badges.mjs';
import {createBanRegister} from './ban-register.mjs';
import {createRankAdmin} from '../node/rank-admin.mjs';
import {createOverview} from './overview.mjs';
import {createStaffManual} from './staff-manual.mjs';
import {createLuckPerms} from './luckperms.mjs';
import {createCommunityAdmin} from './community-admin.mjs';
import {createExchange} from './exchange.mjs';
import {createIntegrationSSO} from '../node/integration-sso.mjs';
import {createBanBridge} from './ban-bridge.mjs';
import {sharedErrorResponse} from '../node/shared-errors.mjs';
import {initializeNews} from '../node/news.mjs';
import {initializeRanks,initializeCommunityAccess,initializeQuestAccess,initializeBankAccess,can,accessFor} from '../node/permissions.mjs';
import {createServer} from 'node:http';
import {createV1PersonalBank} from './api-v1-personal-bank.mjs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {accountSchema} from './imperial-accounts.mjs';
import {openDatabase} from '../node/mysql.mjs';
import {createAuth} from '../node/auth.mjs';
import {identity} from '../node/auth.mjs';
import {createInventoryHandler,createSalesHistoryHandler} from './inventory/inventory-api.mjs';
import {createMarketBridge} from './inventory/market-bridge.mjs';
import {createGameLink,json} from '../node/game-link.mjs';
import {createCommunityRewards} from '../node/community-rewards.mjs';
import {createAccountAdmin} from '../node/account-admin.mjs';
import {createServerControl} from './server-control.mjs';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const sharedAssets=new Set(['postbank-transfer-hall-v1.png','corrino-group-v4.png','corrino-group-v3.svg','corrino-charter-v2.png','corrino-founding-marks-v1.png','consortium-corrini-v1.png','corrino-charter-v1.png','corrino-founder-v1.png','imperial-postbank-v2.png','spost-company-v1.png','vaerkring-company-v1.png','imperial-postbank-v1.png','corrino-group-logo.svg','spicepost-logo-v2.svg','spicepost-logo.svg','imperial-post-seal-v2.png','imperial-post-seal.svg','imperial-post-office-v1.png','mail-stamp-imperial.svg','mail-stamp-faction.svg','mail-stamp-staff.svg','mail-stamp-clan.svg','mail-stamp-personal.svg','imperial-post-logo.svg','ornament.webp','guild.webp','minecraft-hero.webp','menu-0.webp','reward-gold-ingot-transparent-v1.png','menu-5.webp','menu-6.webp','menu-9.webp','menu-12.webp','item-23.webp','dunemark-icon-64.png','arrakis-lore-frieze.svg']);
export function createPanel(db,settings={},dependencies={}){
 const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 const contactEmail=createContactEmail(db,{origin,...dependencies.contactEmail});
 const internalMail=createInternalMail(db,{origin,settings,...dependencies.internalMail});
 const auth=createAuth(db,origin,settings),links=createGameLink(db,settings,origin),rewards=createCommunityRewards(db,settings,origin);
 const hosting=createHosting(db,{origin});const mailAccounts=createMailAccounts(db);const mailIdentity=createMailIdentityRoute(db,{origin}),gitIdentity=createGitIdentityRoute(db,settings,origin);
 const adminRegistration=createAdminRegistration(db,origin);const admin=createAccountAdmin(db,origin),profile=createProfile(db,settings,origin),avatars=createAvatars(db,settings);
 const tailorAppearance=createTailorAppearance(db,dependencies.tailorAppearance);
 const memorials=createMemorials(db,{...settings,PUBLIC_ORIGIN:'https://www.dunerealms.com'});
 const memberProfiles=createMemberProfiles(db,settings);
 const ranks=createRankAdmin(db,settings,origin);const badges=createBadgeAdmin(db,origin);
 const manual=createStaffManual(db);
 const luckperms=createLuckPerms(db,settings,dependencies.luckperms);
 const servers=createServerControl(db,settings,dependencies.serverControl);
 const pool=dependencies.inventoryPool||{async query(){throw Error('Inventory database is not configured');}};
 const community=createCommunityAdmin(db,settings,{pool});
 const exchange=createExchange(db,pool);
 const clans=createClans(db,{origin,onClanCreated:()=>syncClanMailRegistry(db),onClanDeleted:()=>syncClanMailRegistry(db)}),gameTickets=createGameTickets(db,settings);
 const questRewards=createQuestRewards(db,settings,pool);
 const gameRanks=createGameRanks(db,settings);
 const kitStudio=createKitStudio(db,settings,dependencies.kitStudio);
 const upgradeTokens=createUpgradeTokens(db,settings,dependencies.upgradeTokens);
 const publicKitCatalogue=createKitCatalogueBridge(settings,{db});
 const kitMarket=createKitMarket(db,settings,dependencies.kitMarket);
 const imperialAtelier=createImperialAtelier(db,settings,dependencies.imperialAtelier);
 const bankBeneficiaries=createBankBeneficiaries(db,dependencies.bankBeneficiaries);
 const officialBank=createOfficialBank(db,settings,dependencies.officialBank);
 const managedTransfers=createManagedTransfers(db,settings,dependencies.managedTransfers);
 const bankTransfers=createBankTransfers(db,settings,dependencies.bankTransfers);
 const banking=createBanking(db,settings,dependencies.banking);
 const v1PersonalBank=createV1PersonalBank(banking,{enabled:process.env.DUNE_API_V1_BANK_STAGING==='true'});
 const quests=createQuests(db,settings,dependencies.quests),clanShop=createClanShop(db,settings,dependencies.clanShop);
 const sso=createIntegrationSSO(db,settings);
 const overview=createOverview(db);
 const banBridge=createBanBridge(db,settings,dependencies.bans);
 const banRegister=createBanRegister(db,settings,dependencies.bans);
 const electionVoting=createElectionVoting(db,settings,dependencies.electionVoting);
 const imperialCharters=createImperialCharters(db,settings);
 const proclamations=createProclamations(db,settings);
 const electoralRoll=createElectoralRoll(db);
 const electionApplications=createElectionApplications(db,settings,dependencies.electionApplications);
 const politicsPreview=createPoliticsPreview(db,settings,dependencies.politicsPreview);
 const banEvidence=createBanEvidence(db,settings,dependencies.banEvidence);
 const inventoryOptions={authenticate:request=>identity(request,db),verifiedMinecraftUuid:async accountId=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(accountId).first())?.minecraft_uuid||null,pool,logger:dependencies.logger||console};
 const inventory=createInventoryHandler(inventoryOptions),sales=createSalesHistoryHandler(inventoryOptions);
 const market=(settings.EXCHANGE_READ_TOKEN||'').length>=32?createMarketBridge({pool,readToken:settings.EXCHANGE_READ_TOKEN}):null;
 return async request=>{const retiredTickets=retiredTicketResponse(request);if(retiredTickets)return retiredTickets;
  const path=new URL(request.url).pathname;
  const onboarding=await firstLoginGate(request,db);if(onboarding)return onboarding;
  if(['/api/politics/ballot/house','/api/politics/ballot/imperial'].includes(path))return electionVoting(request);
  if(path==='/api/politics/charters')return imperialCharters(request);
  if(path==='/api/politics/proclamations')return proclamations(request);
  if(path==='/api/politics/electoral-roll')return electoralRoll(request);
  if(path==='/api/politics/applications')return electionApplications(request);
  if(path==='/api/politics/preview')return politicsPreview(request);
  if(path==='/api/admin/register-user')return adminRegistration(request);
  if(path==='/api/account/email')return contactEmail(request);
  if(path.startsWith('/api/people/'))return memberProfiles(request);
  if(path==='/profile-login'&&request.method==='GET'){
   const username=new URL(request.url).searchParams.get('username');if(!/^[a-z0-9_]{3,32}$/.test(username||'')||!await db.prepare("SELECT id FROM site_accounts WHERE username=? AND password_hash NOT LIKE '!%'").bind(username).first())return new Response('Profile not found',{status:404});
   return Response.redirect(await identity(request,db)?'https://www.dunerealms.com/people/'+username:origin+'/?return_to='+encodeURIComponent('/profile-login?username='+username),302);
  }
  if(path==='/memorial-login'&&request.method==='GET'){
   const slug=new URL(request.url).searchParams.get('slug');if(!/^[a-z0-9-]{3,64}$/.test(slug||'')||!await db.prepare('SELECT slug FROM site_memorials WHERE slug=?').bind(slug).first())return new Response('Memorial not found',{status:404});
   return Response.redirect(await identity(request,db)?'https://www.dunerealms.com/memorial/'+slug:origin+'/?return_to='+encodeURIComponent('/memorial-login?slug='+slug),302);
  }
  if(path.startsWith('/api/memorials/')){
   const from=request.headers.get('origin'),allowed='https://www.dunerealms.com';if(from&&from!==allowed)return new Response(null,{status:403});
   const headers={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   const result=await memorials(request),out=new Headers(result.headers);for(const[k,v]of Object.entries(headers))out.set(k,v);return new Response(result.body,{status:result.status,headers:out});
  }
  if(path==='/api/game/tickets')return gameTickets(request);
  if(['/api/game/quest/discover','/api/quest/rewards','/api/quest/rewards/claim'].includes(path))return questRewards(request);
  if(path==='/api/imperial-atelier')return imperialAtelier(request);
  if(path==='/internal/kits/catalogue')return publicKitCatalogue(request);
  if(['/api/kits/studio','/api/kits/server-studio'].includes(path))return kitStudio(request);
  if(path==='/api/kits/upgrade-tokens')return upgradeTokens(request);
  if(path.startsWith('/api/kits/'))return kitMarket(request);
  if(path==='/api/ranks/game')return gameRanks(request);
  if(path==='/api/bank/beneficiaries')return bankBeneficiaries(request);
  if(path==='/api/bank/official')return officialBank(request);
  if(path==='/api/bank/managed-transfer')return managedTransfers(request);
  if(path==='/api/bank/transfer-own'||path==='/api/bank/remittance')return bankTransfers(request);
  if(path==='/api/bank/personal'||path==='/api/bank/staff'||path==='/api/bank/faction')return banking(request);
  if(path==='/api/v1/me/bank')return v1PersonalBank(request);
  if(path==='/api/quests'||path.startsWith('/api/quests/'))return quests(request);
  if(['/api/clans/shop','/api/clans/shop/price','/api/clans/game-context'].includes(path))return clanShop(request);
  if(path==='/api/clans'||path.startsWith('/api/clans/'))return clans(request);
  if(path.startsWith('/api/hosting/'))return hosting(request);
  if(path==='/api/mail/accounts')return mailAccounts(request);
  if(path.startsWith('/api/internal-mail/'))return internalMail(request);
  if(path==='/api/git/me')return gitIdentity(request);
  if(['/api/mail/me','/api/mail/password','/api/mail/signature','/api/mail/template'].includes(path))return mailIdentity(request);
  if(['/api/account/profile','/api/account/avatar','/api/account/avatar/remove'].includes(path))return profile(request);
  if(path.startsWith('/api/avatars/'))return avatars(request);
  if(path==='/api/tailor/appearance'||path==='/api/tailor/skin')return tailorAppearance(request);
  if(path==='/api/badges')return badges(request);
  if(path==='/api/ban-register')return banRegister(request);
  if(path==='/api/ban-evidence'||path==='/api/ban-evidence/file')return banEvidence(request);
  if(path==='/api/public/bans'&&request.method==='GET')return banBridge.publicBans();
  if(path==='/api/overview'||path==='/api/overview/staff')return overview(request);
  const sharedError=await sharedErrorResponse(request);if(sharedError)return sharedError;
  if(path==='/internal/integrations/ban')return banBridge.handle(request);
  if(path==='/sso/authorize'||path.startsWith('/internal/integrations/'))return sso(request);
  if(path==='/api/exchange/listings')return exchange(request);
  if(path.startsWith('/api/cp/'))return community(request);
  if(path.startsWith('/luckperms-editor/')){
   const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
   if(!isOwnerRank((await accessFor(db,user)).rank)||!await can(db,user,'web.menu.luckperms')||!await can(db,user,'web.luckperms.edit'))return json({message:'LuckPerms editor access is restricted to Owners with web.luckperms.edit.'},403);
   if(!['GET','HEAD'].includes(request.method))return json({message:'Method not allowed'},405);
   let file=path.slice('/luckperms-editor/'.length);
   if(!file||/^editor(?:\/[A-Za-z0-9_-]{3,200})?\/?$/.test(file))file='index.html';
   if(!/^[A-Za-z0-9_./-]+$/.test(file)||file.includes('..'))return json({message:'Not found'},404);
   const extension=file.slice(file.lastIndexOf('.')),mime={...types,'.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}[extension];
   if(!mime)return json({message:'Not found'},404);
   try{return new Response(request.method==='HEAD'?null:await readFile(new URL('./native-editor/'+file,import.meta.url)),{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://usercontent.luckperms.net https://metadata.luckperms.net wss://usersockets.luckperms.net; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://www.dunerealms.com https://dunerealms.com https://clans.dunerealms.com"}});}catch{return json({message:'Native LuckPerms editor build is unavailable.'},404);}
  }
  if(path.startsWith('/api/luckperms/'))return luckperms(request);
  if(path==='/api/staff/manual')return manual(request);
  if(path==='/api/game/permissions'||path==='/api/ranks'||path.startsWith('/api/ranks/'))return ranks(request);
  const menu=path==='/api/inventory'||path==='/api/exchange/sales-history'?'web.menu.inventory':(path==='/api/game-link'||path.startsWith('/api/game-link/')&&path!=='/api/game-link/consume')?'web.menu.game':path==='/api/community/rewards'?'web.menu.rewards':null;
  if(menu){const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);if(!await can(db,user,menu))return json({message:'Permission required: '+menu},403);}
  if(path==='/api/servers'||path.startsWith('/api/servers/'))return servers(request);
  if(path==='/api/inventory')return inventory(request);
  if(path==='/api/exchange/sales-history')return sales(request);
  if(path==='/internal/exchange/listings')return market?market(request):new Response('Not configured',{status:503,headers:{'Cache-Control':'no-store'}});
  if(path.startsWith('/api/admin/'))return admin(request);
  if(path==='/healthz'){await db.prepare('SELECT 1 AS ok').first();return json({status:'ok'});}
  if(path==='/api/welcome'&&request.method==='GET'){const allowed=new Set(['https://www.dunerealms.com','https://dunerealms.com','https://forums.dunerealms.com','https://support.dunerealms.com','https://clans.dunerealms.com','https://wiki.dunerealms.com','https://cp.dunerealms.com']);const origin=request.headers.get('origin');if(origin&&!allowed.has(origin))return new Response(null,{status:403});const user=await identity(request,db);return new Response(JSON.stringify({username:user?.username||null}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'}:{})}});}
  if(path.startsWith('/api/auth/'))return auth(request);
  if(path==='/api/game-link'||path.startsWith('/api/game-link/'))return links(request);
  if(path.startsWith('/api/community/'))return rewards(request);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(path.startsWith('/assets/')&&sharedAssets.has(path.slice(8))){const file=path.slice(8);return new Response(request.method==='HEAD'?null:await readFile(new URL('../web/assets/'+file,import.meta.url)),{headers:{'Content-Type':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/webp','Cache-Control':'public, max-age=3600'}});}
  const file=path==='/'?'index.html':path==='/servers'?'servers.html':path.slice(1);
  if(!['bank-transfer-view.mjs','bank-dashboard.mjs','mail-service-ui.mjs','mail-workspace.css','hosting-control.mjs','internal-mail.mjs','internal-mail.css','election-voting-view.mjs','imperial-charters-view.mjs','proclamations-view.mjs','electoral-roll-view.mjs','election-applications-view.mjs','election-rules.mjs','menu-ribbons.mjs','council-preview.mjs','politics.mjs','crysknife.mjs','x-news-draft.mjs','terms.html','admin-registration.mjs','mail-signature.mjs','webmail.mjs','git-control.mjs','git-control.css','site-profile.mjs','site-profile.css','index.html','panel.js','panel.css','servers.html','servers.js','servers.css','pages.mjs','user-page-hero.mjs','commerce-settings.mjs','shop-management.mjs','center-portals.mjs','panel-layout.mjs','embed-size.mjs','dev-request-access.mjs','center-portals.css','overview.mjs','overview.css','page-groups.mjs','ban-register.mjs','moderation-form-response.mjs','ban-record-cards.css','ban-evidence.mjs','ban-evidence.css','ranks.mjs','ranks.css','staff-manual.mjs','luckperms.mjs','community-admin.mjs','native-community.mjs','exchange.mjs','exchange.css','clans.mjs','clan-shop.mjs','house-tailor.mjs','banking.mjs','banking.css','game-ranks.mjs','upgrade-shop.mjs','kit-generator.mjs','kit-generator.css','kit-market.mjs','kit-market.css','kit-cart.mjs','imperial-atelier.mjs','quests.mjs','quests.css','clans.css','clan-request-gate.mjs','quest-rewards.mjs','quest-rewards.css','inventory/inventory-view.mjs','inventory/inventory-mount.mjs','inventory/inventory.css'].includes(file))return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:await readFile(new URL('./public/'+file,import.meta.url)),{headers:{'Content-Type':types[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-store'}});
 };
}
export async function startPanel(settings=process.env){
 let inventoryPool=null;
 if(settings.DUNE_INVENTORY_DATABASE_URL){
  if(settings.DUNE_INVENTORY_DATABASE_URL.startsWith('mysql:'))inventoryPool=await openGameMysqlPool(settings.DUNE_INVENTORY_DATABASE_URL);
  else{const {Pool}=await import('pg');inventoryPool=new Pool({connectionString:settings.DUNE_INVENTORY_DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});}
  inventoryPool.on('error',()=>console.error('Inventory database connection unavailable.'));
 }
 const db=await openDatabase(settings);await db.prepare(accountSchema).run();await initializeProclamations(db);await initializeCharters(db);await initializeApplications(db);await initializeRounds(db);await initializeBallots(db);await initializeOfficeLedger(db);await initializeContactEmails(db);await initializeBanEvidence(db);await initializeClans(db);await initializeClanShop(db);await initializeMailIdentities(db);await initializeGitIdentities(db);await initializeRanks(db);await initializeBadges(db);await initializeNews(db);await initializeCommunityAccess(db);await initializeQuestAccess(db);await initializeBankAccess(db);await initializeGameRanks(db);const handle=createPanel(db,settings,{inventoryPool}),origin=settings.CP_ORIGIN||'https://cp.dunerealms.com';
 await initializeInternalMailAccess(db);const stopElectionClock=startElectionClock(db);const stopOfficeLedger=startOfficeLedger(db);
 const stopBanSync=startModerationSync(db,settings),stopInternalMail=startInternalMailSync(db);
 const security={'X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' https://www.dunerealms.com; style-src 'self' https://www.dunerealms.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.dunerealms.com; img-src 'self' data: https://www.dunerealms.com https://support.dunerealms.com; frame-src 'self' https://luckperms.net https://www.dunerealms.com https://support.dunerealms.com https://forums.dunerealms.com https://clans.dunerealms.com https://wiki.dunerealms.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://www.dunerealms.com https://dunerealms.com https://clans.dunerealms.com"};
 const server=createServer(async(req,res)=>{try{
  req.setTimeout(req.url==='/api/internal-mail/messages/send'?120000:30000);const bodyLimit=req.method==='POST'&&req.url==='/api/internal-mail/messages/send'?32*1024*1024:req.method==='POST'&&req.url==='/api/ban-evidence'?7*1024*1024:65536;let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>bodyLimit){res.writeHead(413,{...security,'Content-Type':'application/json'});res.end(JSON.stringify({message:'The upload exceeds the permitted request size.'}));return;}chunks.push(chunk);}
  if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400,security);res.end();return;}
  const result=await handle(new Request(origin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}));
  const headers=new Headers(security);result.headers.forEach((value,key)=>headers.set(key,value));
  res.writeHead(result.status,Object.fromEntries(headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch(error){console.error('Panel request failed:',error.code||error.name);res.writeHead(503,security);res.end('{"message":"The account panel is temporarily unavailable."}');}});
 server.headersTimeout=10000;server.requestTimeout=30000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(settings.CP_PORT||3003),'127.0.0.1',resolve);});
 process.once('SIGTERM',()=>{stopOfficeLedger();stopElectionClock();stopBanSync();stopInternalMail();server.close(async()=>{await Promise.allSettled([db.close(),inventoryPool?.end()]);process.exit(0);});});console.log('Account panel listening on localhost');return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await startPanel();


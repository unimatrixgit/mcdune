import {isStaffMailAccess} from './staff-mail-policy.mjs';
import {communityBadgeVisible} from './community-badges.mjs';
import {badgesFor} from './community-badges.mjs';
export const NODES={
 'web.mail.imperial.view':'Imperial Council mailbox — verified Minecraft identity required *',
 'web.mail.faction.view':'Faction Council mailbox — current linked Minecraft faction required *',
 'web.mail.staff.view':'Access the shared staff mailbox (automatic for current staff)',
 'web.mail.internal.view':'Read and manage only your own internal mailbox',
 'web.tickets.dev':'Access private development tasks and Dev team department',
 'web.shop.support':'Read shop purchases and payment status; manage coupons and discounts',
 'web.bank.personal.view':'View your personal Dunemarks bank *','web.bank.staff.view':'View the shared server treasury *','web.bank.staff.deposit':'Deposit into the shared server treasury *','web.bank.staff.manage':'Manage the shared server treasury through authorised game controls *',
 'web.quests.view':'View your discovered quests','web.quests.manage':'Manage native quest definitions and encounter history',
 'web.git.admin':'Administer the DuneGit platform (network leadership)',
 'web.tickets.network':'Access private Network Staff department',
 'web.tickets.sales':'Access Sales department',
 'web.tickets.legal':'Access private Legal department',
 'web.tickets.support':'Access Player Support department','web.tickets.appeals':'Access Ban Appeals department','web.tickets.admin':'Administer support system','web.forum.admin':'Administer MyBB',
 'web.menu.bans':'Bans and appeals page','web.bans.view':'Read ban records','web.bans.manage':'Review and manage bans and appeals','web.bans.evidence':'Manage ban evidence',
 'web.menu.tickets':'Tickets page','web.tickets.view':'Read own tickets','web.tickets.create':'Open tickets and edit support profile','web.tickets.reply':'Reply to accessible tickets','web.tickets.staff':'Read the staff ticket queue','web.tickets.manage':'Triage ticket status',
 'web.menu.forum':'Forum administration page','web.forum.view':'Review discussions and reports','web.forum.moderate':'Moderate forum content',
 'web.menu.exchange':'Exchange administration page','web.exchange.view':'Monitor exchange listings','web.exchange.manage':'Pause or resume website listings',
 'web.menu.posts':'Website posts page','web.posts.view':'Read the post register','web.posts.edit':'Write news drafts','web.posts.publish':'Publish and archive news',
 'web.menu.luckperms':'LuckPerms page','web.luckperms.view':'View all live LuckPerms groups','web.luckperms.edit':'Use the unrestricted LuckPerms web editor (Owners only)',
 'web.menu.staffmanual':'Read the staff manual',
 'web.menu.items':'Custom item designer page','web.items.manage':'Design and publish custom items','dune.items.give':'Issue registered custom items',
 'web.menu.game':'Game identity page','web.menu.inventory':'Inventory & sales page','web.menu.rewards':'Reward codes page','web.menu.security':'Account security page','web.menu.administration':'Administration page','web.menu.servers':'Servers page','web.menu.permissions':'Website ranks page',
 'web.accounts.view':'View website accounts','web.accounts.revoke':'Revoke account sessions','web.accounts.assign':'Assign account ranks','web.community.manage':'Manage community funding goals','web.ranks.manage':'Create ranks and edit the permission matrix',
 'web.servers.view':'View server status','web.servers.logs':'Read server logs','web.servers.power':'Start, stop and restart servers','web.servers.console':'Send server console commands',
 'dune.admin':'DuneCore administration','dune.staff.open':'Open staff GUI','dune.staff.history':'View punishment history','dune.staff.kick':'Kick players','dune.staff.warn':'Warn players','dune.staff.mute':'Mute players','dune.staff.ban.local':'Ban from one server','dune.staff.ban.network':'Ban from the network',
 'duneess.basics':'Essentials player commands','duneess.travel':'Guild travel','duneess.tokens.buy':'Buy guild tokens','duneess.exchange':'Exchange shop','duneess.shops.use':'Use NPC shops',
 'duneess.chat.network':'Local / Proxy chat','duneess.chat.nearby':'Nearby chat · 50 blocks','duneess.chat.team':'Team chat','duneess.chat.faction':'House chat','duneess.chat.imperial':'Imperial chat','duneess.chat.colors':'Chat colours and gradients','duneess.chat.format':'Advanced chat formatting',
 'duneprotect.inspect':'Inspect block history','duneprotect.lookup':'Look up changes','duneprotect.rollback':'Roll back changes','duneprotect.restore':'Restore changes','duneprotect.regions':'Manage protected regions','duneprotect.worldedit':'Use WorldEdit tools',
 'dunelobby.visit':'Visit lobby','dunelobby.build':'Build in protected lobby','dunelobby.admin':'Lobby administration'
};
export const WEBSITE_NODES=Object.fromEntries(Object.entries(NODES).filter(([node])=>node.startsWith('web.')));
const basic=['web.mail.internal.view','web.bank.personal.view','web.quests.view','web.menu.game','web.menu.inventory','web.menu.rewards','web.menu.security','web.menu.tickets','web.tickets.view','web.tickets.create','web.tickets.reply'];
const staff=[...basic,'web.bank.staff.view','web.bank.staff.deposit','web.menu.staffmanual','web.menu.administration','web.accounts.view','web.accounts.revoke','web.community.manage','web.tickets.staff','web.tickets.manage','web.menu.forum','web.forum.view','web.forum.moderate','web.menu.exchange','web.exchange.view','web.menu.posts','web.posts.view','web.posts.edit'];
const core=[...staff,'web.bank.staff.manage','web.quests.manage','web.menu.items','web.items.manage','web.menu.servers','web.menu.permissions','web.accounts.assign','web.ranks.manage','web.servers.view','web.servers.logs','web.servers.power','web.servers.console','web.menu.luckperms','web.luckperms.view','web.exchange.manage','web.posts.publish'];
const support=[...basic,'web.menu.staffmanual','web.tickets.staff','web.tickets.manage','web.tickets.support'];
const appeals=[...basic,'web.menu.staffmanual','web.tickets.staff','web.tickets.manage','web.tickets.appeals','web.menu.bans','web.bans.view','web.bans.manage','web.bans.evidence'];
export const RANK_SECTIONS={players:'Players',website:'Website staff',game:'In-game staff',real_currency:'Real Currency (€)',game_currency:'Game Currency (Dunemarks)',appointed:'Appointed & Elected',legacy:'Other custom ranks'};
export const isOwnerRank=key=>['owners','official_account','web_net_admin','network_admin'].includes(key);
export const rankSection=key=>{
 if(['vip','patron_caravan','patron_guild','patron_grand','council_member','vanity_guild','vanity_concord'].includes(key))return 'real_currency';
 if(key.startsWith('vanity_dm_'))return 'game_currency';
 if(key.startsWith('office_')||['reverent_mother','mentat','concord_sister','guild_envoy'].includes(key))return 'appointed';
 if(key==='user')return 'players';
 if(key.startsWith('web_')||['official_account','network_admin'].includes(key))return 'website';
 return key.startsWith('game_')||['corestaff','owners'].includes(key)?'game':'legacy';
};export const DEFAULT_RANKS=[
 {key:'user',label:'User',level:10,kind:'access',nodes:basic},
 {key:'vip',label:'VIP',level:20,kind:'access',nodes:basic},
 {key:'council_member',label:'Council Member',level:20,kind:'access',nodes:[...basic]},
 {key:'patron_caravan',label:'Caravan Supporter',level:12,kind:'access',nodes:[...basic]},
 {key:'patron_guild',label:'Guild Patron',level:15,kind:'access',nodes:[...basic]},
 {key:'patron_grand',label:'Grand Benefactor',level:25,kind:'access',nodes:[...basic]},
 {key:'staff',label:'Staff',level:50,kind:'access',nodes:staff},
 {key:'web_streamer',label:'Streamer · News Team',level:40,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.menu.posts','web.posts.view','web.posts.edit','web.posts.publish']},
 {key:'web_news',label:'News Team',level:40,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.menu.posts','web.posts.view','web.posts.edit','web.posts.publish']},
 {key:'web_forum',label:'Forum Team',level:45,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.menu.forum','web.forum.view','web.forum.moderate']},
 {key:'web_support',label:'Support Team',level:45,kind:'access',nodes:support},
 {key:'official_account',label:'Official Account',level:100,kind:'access',nodes:Object.keys(WEBSITE_NODES)},
 {key:'network_admin',label:'Network Admin',level:90,kind:'access',nodes:Object.keys(WEBSITE_NODES)},
 {key:'web_net_admin',label:'Main Network Administrator',level:95,kind:'access',nodes:Object.keys(WEBSITE_NODES)},
 {key:'web_sales',label:'Sales Team',level:45,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.tickets.staff','web.tickets.manage','web.tickets.sales']},
 {key:'web_legal',label:'Legal Team',level:55,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.tickets.staff','web.tickets.manage','web.tickets.legal']},
 {key:'web_appeal',label:'Appeal Team',level:50,kind:'access',nodes:appeals},
 {key:'game_mod',label:'Moderator',level:50,kind:'access',nodes:appeals},
 {key:'game_admin',label:'Administrator',level:60,kind:'access',nodes:appeals},
 {key:'game_support',label:'Support Team',level:45,kind:'access',nodes:support},
 {key:'game_appeal',label:'Appeal Team',level:50,kind:'access',nodes:appeals},
 {key:'corestaff',label:'Corestaff',level:80,kind:'access',nodes:[...new Set([...core,...support,...appeals,'web.forum.admin','web.tickets.admin','web.tickets.legal','web.tickets.sales'])]},
 {key:'owners',label:'Owner',level:100,kind:'access',nodes:Object.keys(WEBSITE_NODES)}
];
DEFAULT_RANKS.push(...[['game_quests','Quest Team',45,['web.quests.manage']],['game_restoration','Restoration Team',60,[]]].map(([key,label,level,extra])=>({key,label,level,kind:'access',nodes:[...basic,'web.menu.staffmanual',...extra]})));
for(const rank of DEFAULT_RANKS)if(rank.nodes.includes('web.menu.staffmanual'))rank.nodes=[...new Set([...rank.nodes,'web.bank.staff.view','web.bank.staff.deposit'])];
for(const rank of DEFAULT_RANKS)if(rank.key.startsWith('web_'))rank.nodes=[...new Set([...rank.nodes,'web.menu.bans','web.bans.view','web.shop.support'])];
DEFAULT_RANKS.push({key:'web_dev',label:'Dev Team',level:55,kind:'access',nodes:[...basic,'web.menu.staffmanual','web.tickets.staff','web.tickets.manage','web.tickets.dev']});
// Membership does not grant account moderation, financial, console, OP or WorldEdit authority.
DEFAULT_RANKS.push({key:'game_builder',label:'Builder',level:40,kind:'access',nodes:[...basic,'web.menu.staffmanual']});
DEFAULT_RANKS.push({key:'memorial',label:'Memorial',level:1,kind:'access',nodes:[]});
for(const rank of DEFAULT_RANKS)if(['owners','corestaff','network_admin','web_net_admin'].includes(rank.key))rank.nodes=[...new Set([...rank.nodes,'web.tickets.dev'])];
export const rankKey=role=>role==='player'?'user':role;
export async function rankFor(db,key){
 const row=await db.prepare('SELECT rank_key,label,rank_level,kind,permissions_json,version FROM cp_ranks WHERE rank_key=?').bind(rankKey(key)).first();
 if(typeof row?.permissions_json==='string')return{key:row.rank_key,label:row.label,level:Number(row.rank_level),kind:row.kind,nodes:JSON.parse(row.permissions_json),version:Number(row.version)};
 return DEFAULT_RANKS.find(r=>r.key===rankKey(key))||{key:rankKey(key),label:'Unknown rank',level:0,kind:'access',nodes:[]};
}
export async function accessFor(db,user){
 if(!user)return null;
 const {results:extra}=user.id?await db.prepare('SELECT rank_key FROM cp_account_ranks WHERE user_id=?').bind(user.id).all():{results:[]};
 const keys=[...new Set([rankKey(user.role),...extra.map(r=>r.rank_key)])];
 const ranks=await Promise.all(keys.map(key=>rankFor(db,key)));
 const valid=ranks.filter(r=>r.kind==='access'&&r.level>0).sort((a,b)=>b.level-a.level);
 const rank=valid[0]||{key:'unknown',label:'Unknown rank',level:0};
 const nodes=valid.some(r=>isOwnerRank(r.key))?Object.keys(WEBSITE_NODES):[...new Set(valid.flatMap(r=>r.nodes.filter(n=>Object.hasOwn(WEBSITE_NODES,n))))];
 const access={rank:rank.key,label:valid.map(r=>r.label).join(' · '),level:rank.level,ranks:valid.map(r=>r.key),nodes};if(isStaffMailAccess(access)&&!nodes.includes('web.mail.staff.view'))nodes.push('web.mail.staff.view');return access;
}
export async function can(db,user,node){return !!user&&(await accessFor(db,user)).nodes.includes(node);}
export async function publicUser(db,user){if(!user)return null;const access=await accessFor(db,user);return{username:user.username,staff:access.nodes.includes('web.menu.administration'),rank:access.rank,ranks:access.ranks,rankLabel:access.label,rankLevel:access.level,communityBadges:(await badgesFor(db,user.id)).filter(k=>communityBadgeVisible(k,access.ranks)),permissions:access.nodes};}
export async function initializeRanks(db){
 for(const rank of DEFAULT_RANKS.filter(r=>r.kind==='access'))await db.prepare('INSERT INTO cp_ranks(rank_key,label,rank_level,kind,permissions_json,version) VALUES(?,?,?,?,?,1) ON CONFLICT(rank_key) DO UPDATE SET rank_key=excluded.rank_key').bind(rank.key,rank.label,rank.level,rank.kind,JSON.stringify(rank.nodes)).run();
 const {results:stored}=await db.prepare('SELECT rank_key,permissions_json,version FROM cp_ranks').all();
 for(const row of stored){
  const previous=JSON.parse(row.permissions_json);
  const nodes=[...new Set(previous.map(n=>n.startsWith('cp.')?'web.'+n.slice(3):n).filter(n=>Object.hasOwn(WEBSITE_NODES,n)))];
  if(JSON.stringify(nodes)!==JSON.stringify(previous))await db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify(nodes),row.rank_key,row.version).run();
 }
 await db.prepare("UPDATE site_accounts SET role='user' WHERE role='player'").run();
}
export async function initializeCommunityAccess(db){
 const key='community-access-v1';
 if(await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind(key).first())return;
 const statements=[];
 for(const rank of DEFAULT_RANKS){
  const stored=await rankFor(db,rank.key);
  const additions=rank.nodes.filter(node=>/^web\.(?:menu\.(?:tickets|forum|exchange|posts)|tickets\.|forum\.|exchange\.|posts\.)/.test(node));
  const nodes=[...new Set([...stored.nodes,...additions])];
  statements.push(db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=?').bind(JSON.stringify(nodes),rank.key));
 }
 statements.push(db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(key,'complete',Date.now()));
 await db.batch(statements);
}

export async function initializeQuestAccess(db){
 const key='quest-access-v1';if(await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind(key).first())return;
 const statements=[];
 for(const rank of DEFAULT_RANKS){const stored=await rankFor(db,rank.key);const additions=rank.nodes.filter(n=>n==='web.quests.view'||n==='web.quests.manage');const nodes=[...new Set([...stored.nodes,...additions])];statements.push(db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify(nodes),rank.key,stored.version));}
 statements.push(db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(key,'complete',Date.now()));await db.batch(statements);
}

export async function initializeBankAccess(db){const key='bank-access-v1';if(await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind(key).first())return;const statements=[];for(const rank of DEFAULT_RANKS){const stored=await rankFor(db,rank.key);const additions=['web.bank.personal.view',...(rank.nodes.includes('web.menu.staffmanual')?['web.bank.staff.view','web.bank.staff.deposit']:[]),...(['owners','corestaff','network_admin','web_net_admin'].includes(rank.key)?['web.bank.staff.manage']:[])];const nodes=[...new Set([...stored.nodes,...additions])];statements.push(db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify(nodes),rank.key,stored.version));}statements.push(db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(key,'complete',Date.now()));await db.batch(statements);}

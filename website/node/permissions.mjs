export const NODES={
 'cp.menu.staffmanual':'Read the staff manual',
 'cp.menu.items':'Custom item designer page','cp.items.manage':'Design and publish custom items','dune.items.give':'Issue registered custom items',
 'cp.menu.game':'Game identity page','cp.menu.inventory':'Inventory & sales page','cp.menu.rewards':'Reward codes page','cp.menu.security':'Account security page','cp.menu.administration':'Administration page','cp.menu.servers':'Servers page','cp.menu.permissions':'Ranks & permissions page',
 'cp.accounts.view':'View website accounts','cp.accounts.revoke':'Revoke account sessions','cp.accounts.assign':'Assign account ranks','cp.community.manage':'Manage community funding goals','cp.ranks.manage':'Create ranks and edit the permission matrix',
 'cp.servers.view':'View server status','cp.servers.logs':'Read server logs','cp.servers.power':'Start, stop and restart servers','cp.servers.console':'Send server console commands',
 'dune.admin':'DuneCore administration','dune.staff.open':'Open staff GUI','dune.staff.history':'View punishment history','dune.staff.kick':'Kick players','dune.staff.warn':'Warn players','dune.staff.mute':'Mute players','dune.staff.ban.local':'Ban from one server','dune.staff.ban.network':'Ban from the network',
 'duneess.basics':'Essentials player commands','duneess.travel':'Guild travel','duneess.tokens.buy':'Buy guild tokens','duneess.exchange':'Exchange shop','duneess.shops.use':'Use NPC shops',
 'duneess.chat.network':'Local / Proxy chat','duneess.chat.nearby':'Nearby chat · 50 blocks','duneess.chat.team':'Team chat','duneess.chat.faction':'House chat','duneess.chat.imperial':'Imperial chat','duneess.chat.colors':'Chat colours and gradients','duneess.chat.format':'Advanced chat formatting',
 'duneprotect.inspect':'Inspect block history','duneprotect.lookup':'Look up changes','duneprotect.rollback':'Roll back changes','duneprotect.restore':'Restore changes','duneprotect.regions':'Manage protected regions','duneprotect.worldedit':'Use WorldEdit tools',
 'dunelobby.visit':'Visit lobby','dunelobby.build':'Build in protected lobby','dunelobby.admin':'Lobby administration'
};
const basic=['cp.menu.game','cp.menu.inventory','cp.menu.rewards','cp.menu.security','duneess.basics','duneess.travel','duneess.tokens.buy','duneess.exchange','duneess.shops.use','duneess.chat.network','duneess.chat.nearby','duneess.chat.team','duneess.chat.faction','dunelobby.visit'];
const staff=[...basic,'cp.menu.staffmanual','cp.menu.administration','cp.accounts.view','cp.accounts.revoke','cp.community.manage','dune.staff.open','dune.staff.history','dune.staff.kick','dune.staff.warn','dune.staff.mute','duneprotect.inspect','duneprotect.lookup'];
const core=[...staff,'cp.menu.items','cp.items.manage','dune.items.give','cp.menu.servers','cp.menu.permissions','cp.accounts.assign','cp.ranks.manage','cp.servers.view','cp.servers.logs','cp.servers.power','cp.servers.console','dune.admin','dune.staff.ban.local','dune.staff.ban.network','duneess.chat.imperial','duneess.chat.colors','duneess.chat.format','duneprotect.rollback','duneprotect.restore','duneprotect.regions','duneprotect.worldedit','dunelobby.build','dunelobby.admin'];
export const DEFAULT_RANKS=[
 {key:'user',label:'User',level:10,kind:'access',nodes:basic},
 {key:'vip',label:'VIP',level:20,kind:'access',nodes:[...basic,'duneess.chat.colors']},
 {key:'staff',label:'Staff',level:50,kind:'access',nodes:staff},
 {key:'corestaff',label:'Corestaff',level:80,kind:'access',nodes:core},
 {key:'owners',label:'Owners',level:100,kind:'access',nodes:Object.keys(NODES)},
 ...['aerdrecht','harkveen','korenholt','oordwijk','vrijduin','vaerkring'].map(key=>({key:'house_'+key,label:key[0].toUpperCase()+key.slice(1),level:1,kind:'house',nodes:[]})),
 ...['spice_smuggler','water_smuggler'].map(key=>({key:'path_'+key,label:key.replaceAll('_',' '),level:1,kind:'path',nodes:[]})),
 ...['emperor','house_leader','specerhuis','welvaart','guild_staff','landsraad'].map(key=>({key:'office_'+key,label:key.replaceAll('_',' '),level:2,kind:'office',nodes:['duneess.chat.imperial']}))
];
export const rankKey=role=>role==='player'?'user':role;
export async function rankFor(db,key){
 const row=await db.prepare('SELECT rank_key,label,rank_level,kind,permissions_json,version FROM cp_ranks WHERE rank_key=?').bind(rankKey(key)).first();
 if(typeof row?.permissions_json==='string')return{key:row.rank_key,label:row.label,level:Number(row.rank_level),kind:row.kind,nodes:JSON.parse(row.permissions_json),version:Number(row.version)};
 return DEFAULT_RANKS.find(r=>r.key===rankKey(key))||{key:rankKey(key),label:'Unknown rank',level:0,kind:'access',nodes:[]};
}
export async function accessFor(db,user){
 if(!user)return null;
 const rank=await rankFor(db,user.role);
 const nodes=rank.key==='owners'?Object.keys(NODES):rank.nodes.filter(n=>Object.hasOwn(NODES,n));
 return{rank:rank.key,label:rank.label,level:rank.level,nodes};
}
export async function can(db,user,node){return !!user&&(await accessFor(db,user)).nodes.includes(node);}
export async function publicUser(db,user){if(!user)return null;const access=await accessFor(db,user);return{username:user.username,staff:access.nodes.includes('cp.menu.administration'),rank:access.rank,rankLabel:access.label,rankLevel:access.level,permissions:access.nodes};}
export async function initializeRanks(db){
 for(const rank of DEFAULT_RANKS)await db.prepare('INSERT INTO cp_ranks(rank_key,label,rank_level,kind,permissions_json,version) VALUES(?,?,?,?,?,1) ON CONFLICT(rank_key) DO UPDATE SET rank_key=excluded.rank_key').bind(rank.key,rank.label,rank.level,rank.kind,JSON.stringify(rank.nodes)).run();
 await db.prepare("UPDATE site_accounts SET role='user' WHERE role='player'").run();
}

export const isOwnerRank = rank =>
  ['owners', 'official_account', 'web_net_admin', 'network_admin']
    .includes(typeof rank === 'string' ? rank : rank?.key);

export async function initializeBankAccess(db){const key='bank-access-v1';if(await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind(key).first())return;const statements=[];for(const rank of DEFAULT_RANKS){const stored=await rankFor(db,rank.key);const additions=['web.bank.personal.view',...(rank.nodes.includes('web.menu.staffmanual')?['web.bank.staff.view','web.bank.staff.deposit']:[]),...(['owners','corestaff','network_admin','web_net_admin'].includes(rank.key)?['web.bank.staff.manage']:[])];const nodes=[...new Set([...stored.nodes,...additions])];statements.push(db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=? AND version=?').bind(JSON.stringify(nodes),rank.key,stored.version));}statements.push(db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(key,'complete',Date.now()));await db.batch(statements);}

import {protectedStaffRanks,managedRoleSeals,currentStaffRanks} from './game-staff-seals.mjs';
import{staffClosureStats,statsForAccount,departmentAwardEarned}from './staff-closure-stats.mjs';
import{spawn}from 'node:child_process';
import{existsSync,readFileSync}from 'node:fs';
import{accessFor}from './permissions.mjs';
import{badgesFor,BADGES,communityBadgeVisible}from './community-badges.mjs';
export function visibleCommunityBadges(keys,ranks){return keys.filter(key=>BADGES.includes(key)&&ranks.length>0&&communityBadgeVisible(key,ranks));}
export function staffSealFor(account,manifest){
 const ranks=Array.isArray(account.ranks)?account.ranks:[account.role];
 const role=ranks.includes('owners')?'OWNER':ranks.includes('web_net_admin')?'MAINNETWORKADMIN':ranks.includes('corestaff')?'CORESTAFF':(ranks.includes('network_admin')||ranks.includes('network_admin'))?'NETWORKSTAFF':'';
 const named=kind=>Object.values(manifest).find(asset=>asset.role===kind&&asset.label?.toLowerCase()===account.username.toLowerCase())?.footer150||null;
 if(role&&named(role))return named(role);
 if(protectedStaffRanks(ranks)&&named('OWNER'))return named('OWNER');
 if(currentStaffRanks(ranks)&&named('STAFF'))return named('STAFF');
 return role==='NETWORKSTAFF'?manifest['rank-network-staff']?.footer150||null:null;
}
export function departmentFor(nodes){
 if(!nodes.includes('web.tickets.staff'))return null;
 return [['web.tickets.support','support'],['web.tickets.appeals','ban-appeals'],['web.forum.moderate','forum-support'],['web.tickets.legal','legal'],['web.tickets.sales','sales'],['web.tickets.network','network-staff'],['web.tickets.dev','dev']].find(([node])=>nodes.includes(node))?.[1]||null;
}
export function departmentsFor(nodes,ranks=[],username=''){
 if(ranks.includes('corestaff')&&!protectedStaffRanks(ranks))return[...new Set([departmentFor(nodes),nodes.includes('web.tickets.dev')?'dev':null].filter(Boolean))];
 if(!nodes.includes('web.tickets.staff'))return[];
 return [['web.tickets.support','support'],['web.tickets.appeals','ban-appeals'],['web.forum.moderate','forum-support'],['web.tickets.legal','legal'],['web.tickets.sales','sales'],['web.tickets.network','network-staff'],['web.tickets.dev','dev']].filter(([node])=>nodes.includes(node)).map(([,department])=>department);
}
export async function syncNativeSeals(db,{sealsOnly=false}={}){
 const script='/home/dunerealms/apps/integrations/sync-staff-seals.php',manifestFile='/home/dunerealms/apps/integrations/seal-manifest.json';
 if(!existsSync(script)||!existsSync(manifestFile))return;
 const closureStats=await staffClosureStats(db);
 const manifest=JSON.parse(readFileSync(manifestFile,'utf8')),{results}=await db.prepare('SELECT id,username,role FROM site_accounts').all(),accounts=[];
 for(const user of results){const access=await accessFor(db,user),ranks=access.ranks||[user.role],departments=departmentsFor(access.nodes,ranks,user.username),communityBadges=visibleCommunityBadges(await badgesFor(db,user.id),ranks),forumGroup=access.nodes.includes('web.forum.admin')?4:access.nodes.includes('web.forum.moderate')?6:2,roleSeals=managedRoleSeals(ranks);accounts.push({id:user.id,username:user.username,rankLabel:access.label,personal:staffSealFor({...user,ranks},manifest),departments,teams:departments.filter(key=>departmentAwardEarned(statsForAccount(closureStats,user.id),key)),communityBadges,...(sealsOnly?{}:{forumGroup}),roleSeals});}
 await new Promise((resolve,reject)=>{const p=spawn('/usr/bin/php',[script],{stdio:['pipe','ignore','ignore']});const timer=setTimeout(()=>{p.kill();reject(Error('Native seal synchronization timed out'));},20000);p.once('error',error=>{clearTimeout(timer);reject(error);});p.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Native seal synchronization failed'));});p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(accounts));});
}

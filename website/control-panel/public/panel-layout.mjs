import {staffAreasFor} from './page-groups.mjs';
import {canSubmitDevRequest} from './dev-request-access.mjs';
const item=(label,page,node,art='nav-account-v2.webp',extra={})=>({label,page,node,art,...extra});
export const USER_GROUPS=[
 ['Profile',[
  item('Minecraft account','game','web.menu.game','nav-clan-v2.webp'),
  item('Personal information','site-profile','web.menu.security','nav-account-v2.webp',{aliases:['security','discord-link']}),
  item('Personal Bank','personal-bank','web.bank.personal.view','nav-exchange-v2.webp'),
  item('Support tickets','tickets','web.menu.tickets','nav-support-v2.webp'),
  item('Inventory','planetary-inventory','web.menu.inventory','nav-exchange-v2.webp')]],
 ['DuneRealms',[
  item('Imperial Tailor','kits-exchange','web.menu.inventory','clan-atelier-v1.webp'),
  item('Exchange settings','exchange-settings','web.menu.inventory','nav-exchange-v2.webp'),
  item('Shop settings','shop-settings','web.menu.inventory','nav-exchange-v2.webp'),
  item('Rewards & codes','rewards-codes','web.menu.rewards','seals/season-tavren-ii-150.png'),
  item('Transactions','transactions','web.menu.inventory','nav-exchange-v2.webp')]],
 ['Politics & Gameplay',[
  item('Quests','quests','web.quests.view','nav-clan-v2.webp',{aliases:['clan-quests','clan-quests-player','clan-quests-clan','clan-quests-guild']}),
  item('Landsraad','landsraad','web.menu.game','nav-clan-v2.webp',{placeholder:true})]],
 ['Services',[
  item('Github','git-control','web.menu.security','nav-manual-v2.webp'),
  item('Email','webmail','web.menu.security','nav-support-v2.webp',{staffOnly:true}),
  item('Hosting control','hosting-control','web.menu.security','seals/department-network-staff-150.png',{placeholder:true})]]
];
export const STAFF_GROUPS=[
 ['Website Tools',[
  item('News center','website-posts','web.menu.posts','nav-discord-v2.webp'),
  item('Shop management','shop-admin','web.shop.support','nav-exchange-v2.webp'),
  item('Support tickets','staff-tickets','web.tickets.staff','nav-support-v2.webp'),
  item('Bans & Appeals','bans','web.menu.bans','seals/department-ban-appeals-150.png',{aliases:['ban-evidence']}),
  item('Forum Moderation','forum-admin','web.menu.forum','seals/department-forum-support-150.png')]],
 ['Staff Tools',[
  item('User management','user-management','web.accounts.view','nav-account-v2.webp'),
  item('Website ranks','permissions','web.menu.permissions','nav-staff-v2.webp'),
  item('Minecraft LP','luckperms','web.menu.luckperms','nav-clan-v2.webp',{aliases:['game-permissions']}),
  item('Network','server-operations','web.menu.servers','seals/department-network-staff-150.png'),
  item('osTicket management','support-management','web.tickets.admin','nav-support-v2.webp'),
  item('Dev management','dev-approvals',null,'seals/team-dev-150.png',{reviewerOnly:true})]],
 ['Cosmetics & community',[
  item('Quest management','quests-admin','web.quests.manage','nav-clan-v2.webp'),
  item('Kit management','server-kits','web.ranks.manage','clan-atelier-v1.webp'),
  item('Exchange management','exchange-admin','web.menu.exchange','nav-exchange-v2.webp',{aliases:['exchange-settings-admin']}),
  item('Git management','git-admin','web.git.admin','nav-manual-v2.webp'),
  item('Community goals','community-goals','web.community.manage','nav-exchange-v2.webp'),
  item('Server bank','staff-bank','web.bank.staff.view','nav-exchange-v2.webp'),
  item('Item management','items','web.menu.items','nav-clan-v2.webp')]]
];
// Mirrors native Dev review policy; ordinary Dev/staff membership is not approval authority.
export function canReviewDev(user){const ranks=new Set(user?.ranks||[]),name=user?.username?.toLowerCase();return name==='unimatrix999'&&ranks.has('owners')||name==='grmacken'&&ranks.has('web_net_admin');}
export const hasStaffPanel=user=>!!user&&staffAreasFor(user).length>0;
export const hasDevPanel=canSubmitDevRequest;
export function menuGroupsFor(user,panel){
 if(!user||panel==='staff'&&!hasStaffPanel(user))return[];
 const nodes=new Set(user.permissions||[]);
 return(panel==='staff'?STAFF_GROUPS:USER_GROUPS).map(([label,items])=>[label,items.filter(i=>(!i.node||nodes.has(i.node))&&(!i.staffOnly||hasStaffPanel(user))&&(!i.reviewerOnly||canReviewDev(user)))]).filter(([,items])=>items.length);
}
export function menuItemFor(page){return[...USER_GROUPS,...STAFF_GROUPS].flatMap(([,items])=>items).find(i=>i.page===page||i.aliases?.includes(page));}
export function splitMenuGroups(groups){
 const midpoint=Math.ceil(groups.reduce((n,[,items])=>n+items.length,0)/2),left=[],right=[];let used=0;
 for(const[label,items]of groups){const take=Math.max(0,Math.min(items.length,midpoint-used));if(take)left.push([label,items.slice(0,take)]);if(take<items.length)right.push([take?label+' · continued':label,items.slice(take)]);used+=items.length;}
 return[left,right];
}

export const DEV_ITEMS=[['Overview','dev-panel','overview'],['Development Queue','dev-queue','queue'],['Approvals','dev-approvals','approvals'],['New Request','dev-new','new'],['Archive','dev-archive','archive']].map(([label,page,view])=>({label,page,view,art:'seals/team-dev-150.png'}));

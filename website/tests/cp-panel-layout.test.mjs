import test from 'node:test';
import assert from 'node:assert/strict';
import {USER_GROUPS,STAFF_GROUPS,menuGroupsFor,canReviewDev,hasStaffPanel,hasDevPanel,menuItemFor,splitMenuGroups} from '../control-panel/public/panel-layout.mjs';
const user=(username,ranks,permissions)=>({username,ranks,permissions,rank:ranks[0]});
const basic=['web.menu.game','web.menu.security','web.menu.inventory','web.menu.rewards','web.menu.tickets','web.bank.personal.view','web.quests.view'];
const flat=groups=>groups.flatMap(([,items])=>items.map(i=>i.label));
test('Owner-defined category and item order is preserved independently of legacy navigation',()=>{
 assert.deepEqual(USER_GROUPS.map(([name])=>name),['Profile','DuneRealms','Politics & Gameplay','Services']);
 assert.deepEqual(flat(USER_GROUPS),['Minecraft account','Personal information','Personal Bank','Support tickets','Inventory','Imperial Tailor','Exchange settings','Shop settings','Rewards & codes','Transactions','Quests','Landsraad','Github','Email','Hosting control']);
 assert.deepEqual(flat(STAFF_GROUPS),['News center','Shop management','Support tickets','Bans & Appeals','Forum Moderation','User management','Website ranks','Minecraft LP','Network','osTicket management','Dev management','Quest management','Kit management','Exchange management','Git management','Community goals','Server bank','Item management']);
});
test('ordinary member never receives staff/dev or previously staff-only email tools',()=>{
 const u=user('member',['user'],basic);assert(!hasStaffPanel(u));assert(!hasDevPanel(u));assert.deepEqual(menuGroupsFor(u,'staff'),[]);assert.equal(flat(menuGroupsFor(u,'user')).length,14);assert(!flat(menuGroupsFor(u,'user')).includes('Email'));assert.equal(menuGroupsFor(null,'user').length,0);
});
test('department staff only receive their authorised systems',()=>{
 const u=user('supporter',['web_support'],[...basic,'web.tickets.staff','web.menu.staffmanual']);assert(hasStaffPanel(u));assert(hasDevPanel(u));assert.deepEqual(flat(menuGroupsFor(u,'staff')),['Support tickets']);assert(flat(menuGroupsFor(u,'user')).includes('Email'));
});
test('Official Dev has Owner node access without gaining human Dev approval authority',()=>{
 const nodes=[...new Set([...USER_GROUPS,...STAFF_GROUPS].flatMap(([,items])=>items.map(i=>i.node)).filter(Boolean))];const u=user('dev',['web_dev','official_account'],nodes);assert(hasStaffPanel(u));assert(hasDevPanel(u));assert(!canReviewDev(u));assert.equal(flat(menuGroupsFor(u,'staff')).length,17);assert(!flat(menuGroupsFor(u,'staff')).includes('Dev management'));
 for(const name of ['unimatrix999','grmacken']){const owner=user(name,[name==='grmacken'?'web_net_admin':'owners'],nodes);assert(canReviewDev(owner));assert.equal(flat(menuGroupsFor(owner,'staff')).length,18);}
 assert(!canReviewDev(user('someone',['owners'],nodes)));assert(!canReviewDev(user('unimatrix999',['user'],nodes)));
});
test('revoked permissions remove menus; aliases retain parent selection and placeholders are inert',()=>{
 const u=user('news',['web_news'],[...basic,'web.menu.posts','web.posts.edit']);assert(flat(menuGroupsFor(u,'staff')).includes('News center'));u.permissions=basic;assert(!flat(menuGroupsFor(u,'staff')).includes('News center'));
 for(const [alias,parent]of [['security','site-profile'],['ban-evidence','bans'],['game-permissions','luckperms'],['clan-quests','quests']])assert.equal(menuItemFor(alias).page,parent);
 assert(menuItemFor('landsraad').placeholder);assert(menuItemFor('hosting-control').placeholder);
});

test('sidebars keep whole categories, original order, and closest possible item balance',()=>{
 for(const groups of [USER_GROUPS,STAFF_GROUPS,menuGroupsFor(user('member',['user'],basic),'user')]){
  const [left,right]=splitMenuGroups(groups);
  assert.deepEqual([...left,...right],groups);
  assert.deepEqual([...flat(left),...flat(right)],flat(groups));
  assert(![...left,...right].some(([label])=>label.includes('continued')));
  const total=flat(groups).length;
  const best=Math.min(...Array.from({length:groups.length-1},(_,i)=>Math.abs(total-2*flat(groups.slice(0,i+1)).length)));
  assert.equal(Math.abs(flat(left).length-flat(right).length),best);
 }
 assert.deepEqual(splitMenuGroups([]),[[],[]]);
 assert.deepEqual(splitMenuGroups([USER_GROUPS[0]]),[[USER_GROUPS[0]],[]]);
 assert.equal(splitMenuGroups(USER_GROUPS)[1][0][0],'Politics & Gameplay');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {accessFor,WEBSITE_NODES} from '../node/permissions.mjs';
import {menuGroupsFor,hasDevPanel,hasStaffPanel} from '../control-panel/public/panel-layout.mjs';
import {staffAreasFor} from '../control-panel/public/page-groups.mjs';
import {createBanking} from '../control-panel/banking.mjs';

const playerUuid='00000000-0000-0000-0009-01f09764757f';
const bank={playerUuid,currency:'dunemarks',balanceDunemarks:'12.30',walletDunemarks:'45.67',ledger:[]};
function database(role='owners'){
 return {prepare(sql){
  return {bind(...args){
   return {
    async all(){if(sql.includes('cp_account_ranks'))return {results:[]};throw Error('Unexpected query: '+sql);},
    async first(){if(sql.includes('cp_ranks'))return {rank_key:args[0],label:args[0]==='owners'?'Owner':'User',rank_level:role==='user'?10:100,kind:'access',permissions_json:JSON.stringify(role==='user'?['web.bank.personal.view']:[]),version:1};throw Error('Unexpected query: '+sql);}
   };
  }};
 }};
}
test('owner access survives empty stored permission JSON and exposes bank + dev navigation',async()=>{
 const db=database('owners'),user={id:'owner-id',role:'owners',username:'unimatrix999'};
 const access=await accessFor(db,user);
 assert.equal(access.rank,'owners');
 for(const node of ['web.bank.personal.view','web.bank.staff.view','web.bank.staff.manage','web.menu.administration','web.menu.permissions']){
  assert(access.nodes.includes(node),node);
  assert(Object.hasOwn(WEBSITE_NODES,node));
 }
 const session={...user,rank:access.rank,ranks:access.ranks,permissions:access.nodes};
 assert(hasDevPanel(session));
 assert(hasStaffPanel(session));
 assert(menuGroupsFor(session,'user').some(([,items])=>items.some(i=>i.page==='personal-bank')));
 assert(menuGroupsFor(session,'staff').some(([,items])=>items.some(i=>i.page==='staff-bank')));
});
test('network owner retains staff areas and Dev access',()=>{
 const user={rank:'web_net_owner',ranks:['web_net_owner'],permissions:['web.bank.staff.view']};
 assert(staffAreasFor(user).includes('network-staff'));
 assert(hasDevPanel(user));
});
test('normal player cannot see server treasury or Dev panel',async()=>{
 const db=database('user'),user={id:'player-id',role:'user',username:'player'};
 const access=await accessFor(db,user);
 const session={...user,rank:access.rank,ranks:access.ranks,permissions:access.nodes};
 assert(!hasDevPanel(session));
 assert(!hasStaffPanel(session));
 assert(!menuGroupsFor(session,'staff').some(([,items])=>items.some(i=>i.page==='staff-bank')));
});
test('owner personal bank is authorised by resolved session permissions',async()=>{
 const db=database('owners'),user={id:'owner-id',role:'owners',username:'unimatrix999'};
 const app=createBanking(db,{SERVER_CONTROL_TOKEN:'s'.repeat(64)},{
  authenticate:async()=>user,
  access:u=>accessFor(db,u),
  linked:async()=>playerUuid,
  fetcher:async()=>Response.json(bank)
 });
 const response=await app(new Request('https://cp.dunerealms.com/api/bank/personal'));
 assert.equal(response.status,200);
 assert.equal((await response.json()).bank.balanceDunemarks,'12.30');
});

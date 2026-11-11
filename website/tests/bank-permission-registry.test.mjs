import test from 'node:test';
import assert from 'node:assert/strict';
import {NODES,DEFAULT_RANKS} from '../node/permissions.mjs';

test('Bank permissions are registered for API and menu authorization',()=>{
 for(const node of ['web.bank.personal.view','web.bank.staff.view','web.bank.staff.deposit','web.bank.staff.manage'])
  assert.ok(Object.hasOwn(NODES,node),`Missing bank permission: ${node}`);
});

test('ordinary players can view their bank but cannot manage treasury',()=>{
 const user=DEFAULT_RANKS.find(rank=>rank.key==='user');
 assert.ok(user.nodes.includes('web.bank.personal.view'));
 assert.ok(!user.nodes.includes('web.bank.staff.manage'));
});

test('owner role retains registered Bank permissions',()=>{
 const owner=DEFAULT_RANKS.find(rank=>rank.key==='owners');
 assert.ok(owner);
 for(const node of ['web.bank.personal.view','web.bank.staff.view','web.bank.staff.manage'])
  assert.ok(owner.nodes.includes(node),`Owner missing ${node}`);
});

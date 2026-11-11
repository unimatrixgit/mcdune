import test from 'node:test';
import assert from 'node:assert/strict';
import {canSubmitDevRequest} from '../control-panel/public/dev-request-access.mjs';

test('owner Dev access works with legacy session exposing rank only',()=>{
 assert.equal(canSubmitDevRequest({rank:'owners',permissions:[]}),true);
});
test('Dev access works with modern ranks array',()=>{
 assert.equal(canSubmitDevRequest({ranks:['web_dev'],permissions:[]}),true);
});
test('regular users cannot access Dev without eligible rank or permission',()=>{
 assert.equal(canSubmitDevRequest({rank:'user',permissions:[]}),false);
 assert.equal(canSubmitDevRequest(null),false);
});
test('eligible staff permissions grant Dev submission access',()=>{
 assert.equal(canSubmitDevRequest({rank:'user',permissions:['web.tickets.staff']}),true);
});

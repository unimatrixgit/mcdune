import test from 'node:test';
import assert from 'node:assert/strict';
import {createKitMarket} from '../control-panel/kit-market.mjs';

const origin = 'https://cp.dunerealms.com';
const player = '11111111-1111-1111-1111-111111111111';
function setup({token = 's'.repeat(64), response = {listings: [], currency: 'dunemarks'}, upstreamStatus = 200} = {}) {
  let calls = 0;
  const db = {prepare() {return {bind() {return this;}, async first() {return {minecraft_uuid: player};}};}};
  const route = createKitMarket(db, {SERVER_CONTROL_TOKEN: token, CP_ORIGIN: origin}, {
    authenticate: async () => ({id: 'site'}),
    access: async () => ({nodes: ['web.menu.inventory']}),
    fetcher: async () => {calls++; return Response.json(response, {status: upstreamStatus});}
  });
  return {route, calls: () => calls};
}
test('catalogue rejects invalid upstream currency without exposing payload', async () => {
  const f = setup({response: {listings: [{secret: 'untrusted'}], currency: 'solari'}});
  const r = await f.route(new Request(origin + '/api/kits/catalogue'));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).listings, undefined);
  assert.equal(f.calls(), 1);
});
test('kit service refuses requests when server authentication is not configured', async () => {
  const f = setup({token: ''});
  const r = await f.route(new Request(origin + '/api/kits/catalogue'));
  assert.equal(r.status, 503);
  assert.equal(f.calls(), 0);
});
test('upstream failures are mapped to safe errors and never return upstream details', async () => {
  const f = setup({upstreamStatus: 500, response: {message: 'internal database connection string'}});
  const r = await f.route(new Request(origin + '/api/kits/catalogue'));
  assert.equal(r.status, 503);
  assert.doesNotMatch(JSON.stringify(await r.json()), /connection string/);
});
test('unknown kit routes do not contact native service', async () => {
  const f = setup();
  const r = await f.route(new Request(origin + '/api/kits/unknown'));
  assert.equal(r.status, 405);
  assert.equal(f.calls(), 0);
});

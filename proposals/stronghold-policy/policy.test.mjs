import test from 'node:test';
import assert from 'node:assert/strict';
import {claimStronghold, releaseStronghold, transferStronghold, markDisputed, resolveConflict, importLegacyClaims, bonusEligible, validateState} from './policy.mjs';
const empty = () => ({revision: 0, claims: []});
const auth = {authorizedAllianceIds: ['a', 'b']}, staff = {admin: true};
const row = (id, allianceId, galaxy, assetRefs = []) => ({id, allianceId, galaxy, assetRefs, roundId: 'r', status: 'active'});
const claim = (state, fields = {}, context = auth) => claimStronghold(state, {expectedRevision: state.revision, id: 'c', allianceId: 'a', galaxy: '01:01', roundId: 'r', ...fields}, context);
const error = code => e => e.code === code;
test('claim canonicalises coordinates and leaves frozen input untouched', () => {
  const state = Object.freeze({revision: 0, claims: Object.freeze([])}), next = claim(state);
  assert.equal(next.claims[0].galaxy, '1:1'); assert.equal(next.revision, 1); assert.equal(state.claims.length, 0);
});
test('galaxy and alliance reservations are exclusive per round', () => {
  const state = claim(empty());
  assert.throws(() => claim(state, {id:'d', allianceId:'b', galaxy:'1:1'}), error('CONFLICT'));
  assert.throws(() => claim(state, {id:'d', galaxy:'2:2'}), error('CONFLICT'));
  assert.equal(claim(state, {id:'d', roundId:'other'}).claims.length, 2);
});
test('management authority is required, including both parties on transfer', () => {
  assert.throws(() => claim(empty(), {}, {}), error('FORBIDDEN'));
  const state = claim(empty());
  assert.throws(() => transferStronghold(state, {expectedRevision:1,claimId:'c',targetAllianceId:'b'}, {authorizedAllianceIds:['a']}), error('FORBIDDEN'));
});
test('stale revision rejects competing write and caller must persist with CAS', () => {
  const initial = empty(), first = claim(initial);
  const otherCandidate = claim(initial, {id:'d',allianceId:'b'});
  assert.equal(first.revision, otherCandidate.revision); // Pure functions alone cannot serialize a database.
  assert.throws(() => claimStronghold(first, {expectedRevision:0}), error('STALE'));
});
test('released IDs remain historical and cannot be reused', () => {
  const state = releaseStronghold(claim(empty()), {claimId:'c',expectedRevision:1}, auth);
  assert.equal(state.claims[0].status, 'released');
  assert.equal(claim(state, {id:'d'}).claims.length, 2);
  assert.throws(() => claim(state), error('DUPLICATE_ID'));
});
test('assets or construction reservations block release without deletion', () => {
  const state = importLegacyClaims([row('c','a','1:1',['structure-1','build-1'])]);
  assert.throws(() => releaseStronghold(state,{claimId:'c',expectedRevision:0},auth),error('ASSETS_REMAIN'));
  assert.deepEqual(state.claims[0].assetRefs,['structure-1','build-1']);
});
test('inactive claims still reserve ownership and provide no resident bonus', () => {
  const state=importLegacyClaims([{...row('c','a','1:1'),status:'inactive'}]);
  assert.throws(()=>claim(state,{id:'d',allianceId:'b'}),error('CONFLICT'));
  assert.equal(bonusEligible(state,'c',{roundId:'r',allianceId:'a',galaxy:'1:1',hasFunctionalStructure:true}),false);
});
test('transfer preserves claim identity, metadata and assets', () => {
  const state=importLegacyClaims([{...row('c','a','1:1',['s']),note:'retained'}]);
  const next=transferStronghold(state,{claimId:'c',expectedRevision:0,targetAllianceId:'b'},auth);
  assert.equal(next.claims[0].allianceId,'b'); assert.equal(next.claims[0].id,'c');
  assert.deepEqual(next.claims[0].assetRefs,['s']); assert.equal(next.claims[0].note,'retained'); assert.equal(state.claims[0].allianceId,'a');
});
test('transfer rejects target alliance existing reservation',()=>{
  const state=importLegacyClaims([row('c','a','1:1'),row('d','b','2:2')]);
  assert.throws(()=>transferStronghold(state,{claimId:'c',expectedRevision:0,targetAllianceId:'b'},auth),error('CONFLICT'));
});
test('legacy import marks transitive conflicts, retaining every owner and asset',()=>{
  const rows=[row('c','a','01:01',['s']),row('d','b','1:1'),row('e','b','2:2'),row('f','x','3:3')];
  const state=importLegacyClaims(rows);
  assert.deepEqual(state.claims.map(c=>c.status),['disputed','disputed','disputed','active']);
  assert.equal(state.claims.length,rows.length); assert.equal(rows[0].status,'active');
  assert.equal(state.claims[0].allianceId,'a'); assert.deepEqual(state.claims[0].assetRefs,['s']);
});
test('disputes require staff and freeze release and transfer',()=>{
  const state=claim(empty()), command={claimIds:['c'],reason:'Review',expectedRevision:1};
  assert.throws(()=>markDisputed(state,command,auth),error('FORBIDDEN'));
  const disputed=markDisputed(state,command,staff);
  assert.throws(()=>releaseStronghold(disputed,{claimId:'c',expectedRevision:2},auth),error('DISPUTED'));
  assert.throws(()=>transferStronghold(disputed,{claimId:'c',expectedRevision:2,targetAllianceId:'b'},auth),error('DISPUTED'));
});
test('adjudication never discards competing assets; chooses explicit winner',()=>{
  const blocked=importLegacyClaims([row('c','a','1:1'),row('d','b','1:1',['s'])]);
  const command={winnerClaimId:'c',winnerStatus:'active',expectedRevision:0};
  assert.throws(()=>resolveConflict(blocked,command,staff),error('ASSETS_REMAIN'));
  const safe=importLegacyClaims([row('c','a','1:1'),row('d','b','1:1')]);
  assert.throws(()=>resolveConflict(safe,command,auth),error('FORBIDDEN'));
  const next=resolveConflict(safe,command,staff);
  assert.deepEqual(next.claims.map(c=>c.status),['active','released']); assert.equal(next.claims[1].resolutionWinnerId,'c');
});
test('local bonus requires current round, alliance, residence and functioning structure',()=>{
  const state=claim(empty()), member={roundId:'r',allianceId:'a',galaxy:'01:01',hasFunctionalStructure:true};
  assert.equal(bonusEligible(state,'c',member),true);
  for(const override of [{roundId:'old'},{allianceId:'b'},{galaxy:'2:2'},{hasFunctionalStructure:false}]) assert.equal(bonusEligible(state,'c',{...member,...override}),false);
});
test('invalid state, duplicate IDs, missing claims and forged statuses fail',()=>{
  assert.throws(()=>claim(empty(),{galaxy:'1:0'}),error('INVALID'));
  assert.throws(()=>importLegacyClaims([row('c','a','1:1'),row('c','b','2:2')]),error('INVALID'));
  assert.throws(()=>validateState({revision:0,claims:[{...row('c','a','1:1'),status:'unknown'}]}),error('INVALID'));
  assert.throws(()=>releaseStronghold(empty(),{claimId:'absent',expectedRevision:0},auth),error('NOT_FOUND'));
});

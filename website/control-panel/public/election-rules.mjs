// Owner-confirmed schedule, 8 November 2026. GMT is UTC, not local summer time.
export const ELECTION_RULES = Object.freeze({
  house: Object.freeze({first:'2026-11-15T09:00:00.000Z',weeks:2}),
  imperial: Object.freeze({first:'2026-11-15T15:00:00.000Z',weeks:4}),
});
export function electionDates(kind, now=Date.now(), count=4) {
  const rule=ELECTION_RULES[kind];
  if(!rule || !Number.isFinite(now) || !Number.isInteger(count) || count<1 || count>12) throw new Error('Invalid calendar request');
  const first=Date.parse(rule.first),period=rule.weeks*7*86400000;
  const offset=Math.max(0,Math.ceil((now-first)/period));
  return Array.from({length:count},(_,i)=>new Date(first+(offset+i)*period).toISOString());
}
// Only a verified server-side faction and current office may establish eligibility.
export function imperialVoteAllowance({linked=false,faction=null,houseLeader=false}={}) {
  return linked && faction ? houseLeader===true ? 5 : 1 : 0;
}
export function electionWindow(kind,start,now=Date.now()) {
  const rule=ELECTION_RULES[kind],timestamp=Date.parse(start);
  if(!rule||!Number.isFinite(timestamp)||!Number.isFinite(now))throw Error('Invalid election window');
  const first=Date.parse(rule.first),period=rule.weeks*7*86400000;
  if(timestamp<first||(timestamp-first)%period!==0)throw Error('Election is outside the confirmed calendar');
  const closes=timestamp+3*3600000;
  return {applicationsClose:new Date(timestamp).toISOString(),votingOpens:new Date(timestamp).toISOString(),votingCloses:new Date(closes).toISOString(),phase:now<timestamp?'applications':now<closes?'voting':'closed'};
}
export function validateCandidature(input,context,now=Date.now()) {
  if(!input||!['house','imperial'].includes(input.kind)||input.accepted!==true)throw Error('Choose an election and accept your candidature');
  if(!context?.linked)throw Error('A verified Minecraft account is required');
  if(input.kind==='house'&&!context.faction)throw Error('A verified faction membership is required');
  const window=electionWindow(input.kind,input.start,now);
  if(window.phase!=='applications')throw Error('Applications for this election are closed');
  if(window.votingOpens!==electionDates(input.kind,now,1)[0])throw Error('Only the next scheduled election accepts applications');
  const motivation=typeof input.motivation==='string'?input.motivation.trim():'';
  if(motivation.length<20||motivation.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(motivation))throw Error('Motivation must contain 20–4000 readable characters');
  // Never take faction or office authority from the submitted form.
  return {kind:input.kind,start:window.votingOpens,faction:input.kind==='house'?context.faction:'imperium',motivation};
}

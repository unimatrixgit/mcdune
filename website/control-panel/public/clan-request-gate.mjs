/** UI-only freshness gate: a response can render only in its original actor/session and request lane. */
export function createClanRequestGate(){
 let actor=null,generation=0;const lanes=new Map();
 return {
  setActor(next){actor=typeof next==='string'&&next?next:null;generation++;lanes.clear();},
  snapshot(){return {actor,generation};},
  sameSession(token){return !!token&&token.actor===actor&&token.generation===generation;},
  begin(lane){if(!actor)return null;const sequence=(lanes.get(lane)||0)+1;lanes.set(lane,sequence);return {actor,generation,lane,sequence};},
  current(token){return !!actor&&!!token&&token.actor===actor&&token.generation===generation&&lanes.get(token.lane)===token.sequence;},
  invalidate(lane){lanes.set(lane,(lanes.get(lane)||0)+1);}
 };
}

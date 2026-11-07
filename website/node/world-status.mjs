const names=[['spacing-guild','Spacing Guild'],['arrakis','Arrakis'],['caladan','Caladan'],['giedi-prime','Giedi Prime'],['kaitain','Kaitain'],['sigma-draconis-iv','Sigma Draconis IV'],['velocity','Velocity']];
export function createWorldStatus(settings,fetcher=fetch){
 let cached,inflight,expires=0;
 async function check(){
  if(!settings.WORLD_STATUS_URL)return {checkedAt:null,available:false,servers:names.map(([id,name])=>({id,name,state:'unknown'}))};
  try{
   const response=await fetcher(settings.WORLD_STATUS_URL,{signal:AbortSignal.timeout(4500)});
   if(!response.ok)throw Error('unavailable');
   const data=await response.json();
   if(!Number.isSafeInteger(data.checkedAt)||Math.abs(Date.now()-data.checkedAt)>60000||!data.servers)throw Error('stale');
   const servers=names.map(([id,name])=>{const row=data.servers[id];if(typeof row?.online!=='boolean'||typeof row?.configured!=='boolean')throw Error('invalid');return {id,name,state:row.online?'online':'offline',configured:row.configured,...(row.online&&Number.isSafeInteger(row.players)&&row.players>=0?{players:row.players}:{})};});
   return {checkedAt:data.checkedAt,available:true,servers};
  }catch{return {checkedAt:null,available:false,servers:names.map(([id,name])=>({id,name,state:'unknown'}))};}
 }
 return async()=>{
  if(!cached||Date.now()>=expires){inflight||=(async()=>{try{cached=await check();expires=Date.now()+15000;}finally{inflight=null;}})();await inflight;}
  return Response.json(cached,{headers:{'Cache-Control':'no-store'}});
 };
}

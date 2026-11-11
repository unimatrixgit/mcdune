import {timingSafeEqual} from 'node:crypto';
/** Private server-to-server bridge for the existing website exchange gateway. */
export function createMarketBridge({pool,readToken}){
 if(typeof readToken!=='string'||readToken.length<32)throw new TypeError('A private exchange read token of at least 32 characters is required.');
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/internal/exchange/listings')return null;
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
  const received=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from('Bearer '+readToken);
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return reply({error:'unauthorized'},401);
  if(url.search)return reply({error:'invalid_request'},400);
  try{
   const result=await pool.query({text:'SELECT id::text AS id,material,category,origin,seller_name AS seller,quantity,price::text AS price FROM dune_exchange_listings ORDER BY id DESC LIMIT 500',query_timeout:5000});
   return reply({listings:result.rows});
  }catch{return reply({error:'market_unavailable'},503);}
 };
}

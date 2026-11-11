/**
 * Drop-in route adapter for the CURRENT DuneHub control-panel/server.mjs.
 * Reuses the deployed createBanking(db,settings,deps) handler, which already
 * checks session, permission, Minecraft link, and rechecks after bank I/O.
 * Does not import or use a second authentication or bank client.
 *
 * Usage from DuneHub server.mjs:
 *   import {createV1PersonalBank} from './api-v1-personal-bank.mjs';
 *   const v1PersonalBank=createV1PersonalBank(banking);
 *   // In the same existing request router, before its 404:
 *   if(path==='/api/v1/me/bank')return v1PersonalBank(request);
 */
export function createV1PersonalBank(existingBanking,{enabled=false}={}){
 if(typeof existingBanking!=='function')throw new TypeError('Existing banking handler required');
 return async function v1PersonalBank(request){
  const url=new URL(request.url);
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
  const fail=(status,code)=>Response.json({error:{code}},{status,headers});
  if(url.pathname!=='/api/v1/me/bank')return fail(404,'not_found');
  if(!enabled)return fail(404,'not_found');
  if(request.method!=='GET')return fail(405,'method_not_allowed');
  if(url.search)return fail(400,'unexpected_query');
  if(request.headers.has('authorization')||request.headers.get('sec-fetch-site')==='cross-site')
   return fail(403,'forbidden');
  if(request.headers.has('origin')&&request.headers.get('origin')!==url.origin)
   return fail(403,'forbidden');
  try{
   const original=new Request(new URL('/api/bank/personal',url),request);
   const result=await existingBanking(original);
   if(!result.ok)return fail(result.status,result.status===401?'unauthenticated':result.status===403?'permission_denied':result.status===409?'account_link_changed':'bank_unavailable');
   const body=await result.json();
   if(body?.linked===false)return Response.json({data:{linked:false}},{headers});
   if(body?.linked!==true||!body.bank||typeof body.bank!=='object')return fail(503,'bank_unavailable');
   // The existing DuneHub banking handler owns all account numbers and ledger projections.
   return Response.json({data:{linked:true,bank:body.bank}},{headers});
  }catch{return fail(503,'bank_unavailable');}
 };
}

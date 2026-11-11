import {identity} from '../node/auth.mjs';
import {accountNumber,validAccountNumber} from './imperial-accounts.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export function createOfficialBank(db,settings={},deps={}){
 const auth=deps.authenticate||(r=>identity(r,db));
 const assigned=deps.assigned||(async u=>db.prepare("SELECT b.id,b.owner_key FROM imperial_bank_accounts b JOIN imperial_bank_account_admins a ON a.account_id=b.id WHERE b.bank_type='server' AND a.user_id=?").bind(u.id).all());
 return async request=>{
  if(request.method!=='GET'||new URL(request.url).search)return reply({message:'Read-only account; account overrides are not accepted.'},400);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const normalize=result=>Array.isArray(result?.results)?result.results:result?[result]:[];
  const grants=normalize(await assigned(user));if(!grants.length)return reply({accounts:[]});
  try{const accounts=[];for(const grant of grants){const owner=grant.owner_key||'mcserver',key=owner==='mcserver'?'mcserver':owner.replace('staff:','staff_');if(!['mcserver','staff_unimatrix999','staff_grmacken','staff_mr_blueray','staff_richwjr'].includes(key))continue;
   const r=await(deps.fetcher||fetch)('http://127.0.0.1:15433/bank/official?key='+encodeURIComponent(key),{headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const bank=await r.json();
   if(bank.accountNumber!==accountNumber('server',grant.id)||typeof bank.balanceDunemarks!=='string'||!/^\d+\.\d{2}$/.test(bank.balanceDunemarks)||!Array.isArray(bank.ledger)||bank.ledger.length>100)throw Error();
   accounts.push({name:typeof bank.name==='string'?bank.name:'Official account',bank:{accountNumber:bank.accountNumber,balanceDunemarks:bank.balanceDunemarks,ledger:bank.ledger.map(r=>({id:r.id,action:r.action,amountDunemarks:r.amountDunemarks,balanceDunemarks:r.balanceDunemarks,createdAt:r.createdAt,...(validAccountNumber(r.fromAccount)?{fromAccount:r.fromAccount}:{}),...(validAccountNumber(r.toAccount)?{toAccount:r.toAccount}:{}),fromName:typeof r.fromName==='string'?r.fromName.slice(0,80):null,toName:typeof r.toName==='string'?r.toName.slice(0,80):null,memo:typeof r.memo==='string'?r.memo.slice(0,140):''}))},canManage:true});
  }
   const current=await auth(request);if(!current||current.id!==user.id)return reply({message:'Account access changed.'},403);const fresh=normalize(await assigned(current));if(grants.some(g=>!fresh.some(f=>Number(f.id)===Number(g.id))))return reply({message:'Account access changed.'},403);
   return reply({accounts});
  }catch{return reply({message:'Official accounts are temporarily unavailable.'},503);}

 };
}

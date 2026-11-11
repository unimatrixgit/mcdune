import {identity} from '../node/auth.mjs';
import {validAccountNumber,accountNumber} from './imperial-accounts.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export function createManagedTransfers(db,settings={},deps={}){
 const auth=deps.authenticate||(r=>identity(r,db));const origin=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com').origin;
 return async request=>{
  if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
  if(request.headers.get('origin')!==origin||new URL(request.url).search)return reply({message:'Invalid request origin or account override.'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply({message:'JSON required.'},415);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  const raw=await request.text();if(raw.length>2000)return reply({message:'Request too large.'},413);let d;try{d=JSON.parse(raw);}catch{return reply({message:'Invalid transfer.'},400);}
  if(!d||Object.keys(d).some(k=>!['sourceAccount','targetAccount','amount','memo','requestId','confirmed'].includes(k))||d.confirmed!==true||!validAccountNumber(d.sourceAccount)||!validAccountNumber(d.targetAccount)||!d.sourceAccount.startsWith('DRSV')||!d.targetAccount.startsWith('DRSV')||d.sourceAccount===d.targetAccount||!/^\d+(?:\.\d{1,2})?$/.test(d.amount||'')||Number(d.amount)<=0||Number(d.amount)>1000000||typeof d.memo!=='string'||d.memo.length>140||/[\x00-\x1f]/.test(d.memo)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(d.requestId||''))return reply({message:'Check both accounts, amount and confirmation.'},400);
  const current=await auth(request);if(!current||current.id!==user.id)return reply({message:'Sign in again.'},401);
  try{const [result]=await db.batch([{async run(c){
   const grants=[];for(const id of [...new Set([d.sourceAccount,d.targetAccount].map(n=>Number(n.replaceAll(' ','').slice(7,14))))].sort((a,b)=>a-b)){
    const [[r]]=await c.execute("SELECT b.id,b.owner_key FROM imperial_bank_accounts b JOIN imperial_bank_account_admins a ON a.account_id=b.id WHERE b.id=? AND b.bank_type='server' AND a.user_id=? FOR UPDATE",[id,user.id]);if(!r)throw Error('Access denied');grants.push(r);
   }
   const key=n=>{const r=grants.find(g=>accountNumber('server',g.id)===n);if(!r)throw Error('Account changed');const k=r.owner_key==='mcserver'?'mcserver':r.owner_key.replace('staff:','staff_');if(!['mcserver','staff_unimatrix999','staff_grmacken','staff_mr_blueray','staff_richwjr'].includes(k))throw Error('Unsupported account');return k;};
   const r=await(deps.fetcher||fetch)('http://127.0.0.1:15433/bank/managed-transfer',{method:'POST',headers:{Authorization:'Bearer '+settings.SERVER_CONTROL_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({actor:user.id,source:key(d.sourceAccount),target:key(d.targetAccount),amount:d.amount,request_id:d.requestId,memo:d.memo,from_number:d.sourceAccount,to_number:d.targetAccount}),signal:AbortSignal.timeout(12000)});if(!r.ok){const error=Error('Transfer unavailable');error.status=r.status===409?409:503;throw error;}const body=await r.json();if(body.reference!==d.requestId)throw Error('Unexpected receipt');return body;
  }}]);return reply({transfer:result});}catch(error){return reply({message:'Payment was not confirmed. Retry the same request; check access and funds before creating a replacement.'},error.status||503);}
 };
}

import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {accountNumber,validAccountNumber} from './imperial-accounts.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export function createBankBeneficiaries(db,deps={}){
 const auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u));
 const search=deps.search||(async(q,number)=>{
  const condition=number?'b.id=? AND b.bank_type=?':"a.username LIKE ? ESCAPE '='";
  const compact=q.replaceAll(' ','');const args=number?[Number(compact.slice(7,14)),compact.startsWith('DRCA')?'current':'player']:[ '%'+q.replaceAll('=','==').replaceAll('%','=%').replaceAll('_','=_')+'%' ];
  return(await db.prepare("SELECT b.id,b.bank_type,a.username FROM imperial_bank_accounts b JOIN site_game_links l ON l.minecraft_uuid=b.owner_key JOIN site_accounts a ON a.id=l.user_id WHERE b.bank_type IN ('player','current') AND a.role NOT IN ('official_account','memorial') AND a.password_hash NOT LIKE '!%' AND NOT EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=a.id AND p.game_link_exempt=1) AND "+condition+' ORDER BY a.username,b.bank_type LIMIT 10').bind(...args).all()).results;
 });
 return async request=>{
  if(request.method!=='GET')return reply({message:'Method not allowed.'},405);
  const params=new URL(request.url).searchParams,q=(params.get('q')||'').trim();
  if([...params.keys()].some(k=>k!=='q')||params.getAll('q').length!==1||q.length<3||q.length>80)return reply({message:'Enter an player name or account number.'},400);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  if(!(await access(user))?.nodes?.includes('web.bank.personal.view'))return reply({message:'Bank access required.'},403);
  const number=/^DR[A-Z]{2}/.test(q);if(number&&(!validAccountNumber(q)||!/^DR(?:PL|CA)/.test(q)))return reply({message:'Enter a valid personal account number.'},400);
  const rows=await search(q,number),current=await auth(request);
  if(!current||current.id!==user.id||!(await access(current))?.nodes?.includes('web.bank.personal.view'))return reply({message:'Access changed. Sign in again.'},403);
  return reply({beneficiaries:rows.filter(r=>['player','current'].includes(r.bank_type)&&typeof r.username==='string').map(r=>({name:r.username,type:r.bank_type==='current'?'Current account':'Savings account',accountNumber:accountNumber(r.bank_type,r.id)}))});
 };
}

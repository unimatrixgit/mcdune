import {identity} from '../node/auth.mjs';
import {accessFor} from '../node/permissions.mjs';
import {accountNumber,validAccountNumber} from './imperial-accounts.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export function createBankBeneficiaries(db,deps={}){
 const auth=deps.authenticate||(r=>identity(r,db)),access=deps.access||(u=>accessFor(db,u));
 const linked=deps.linked||(async u=>(await db.prepare('SELECT minecraft_uuid FROM site_game_links WHERE user_id=?').bind(u.id).first())?.minecraft_uuid);
 const excluded=deps.excluded||(async u=>!!await db.prepare("SELECT id FROM site_accounts WHERE id=? AND (role IN ('official_account','memorial') OR password_hash LIKE '!%' OR EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=site_accounts.id AND p.game_link_exempt=1))").bind(u.id).first());
 const eligible=async u=>(await access(u))?.nodes?.includes('web.bank.personal.view')&&!await excluded(u)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test((await linked(u))||'');
 const search=deps.search||(async(q,number)=>{
  const condition=number?'b.id=? AND b.bank_type=?':"a.username LIKE ? ESCAPE '='";
  const compact=q.replaceAll(' ','');const args=number?[Number(compact.slice(7,16)),compact.slice(4,7)==='102'?'current':'player']:[ '%'+q.replaceAll('=','==').replaceAll('%','=%').replaceAll('_','=_')+'%' ];
  return(await db.prepare("SELECT b.id,b.bank_type,a.username FROM imperial_bank_accounts b JOIN site_game_links l ON l.minecraft_uuid=b.owner_key JOIN site_accounts a ON a.id=l.user_id WHERE b.bank_type IN ('player','current') AND a.role NOT IN ('official_account','memorial') AND a.password_hash NOT LIKE '!%' AND NOT EXISTS(SELECT 1 FROM site_account_policies p WHERE p.user_id=a.id AND p.game_link_exempt=1) AND "+condition+' ORDER BY a.username,b.bank_type LIMIT 10').bind(...args).all()).results;
 });
 return async request=>{
  if(request.method!=='GET')return reply({message:'Method not allowed.'},405);
  const params=new URL(request.url).searchParams,q=(params.get('q')||'').trim();
  if([...params.keys()].some(k=>k!=='q')||params.getAll('q').length!==1||q.length<3||q.length>80)return reply({message:'Enter an player name or account number.'},400);
  const user=await auth(request);if(!user)return reply({message:'Sign in first.'},401);
  if(!await eligible(user))return reply({message:'Bank access required.'},403);
  const number=/^DR/i.test(q);if(number&&(!validAccountNumber(q)||!/^DR\d{2}(?:101|102)/.test(q.replaceAll(' ',''))))return reply({message:'Enter a valid personal account number.'},400);
  const rows=await search(q,number),current=await auth(request);
  if(!current||current.id!==user.id||!await eligible(current)||(await linked(current))?.toLowerCase()!==(await linked(user))?.toLowerCase())return reply({message:'Access changed. Sign in again.'},403);
  return reply({beneficiaries:rows.filter(r=>['player','current'].includes(r.bank_type)&&typeof r.username==='string').map(r=>({name:r.username,type:r.bank_type==='current'?'Current account':'Savings account',accountNumber:accountNumber(r.bank_type,r.id)}))});
 };
}

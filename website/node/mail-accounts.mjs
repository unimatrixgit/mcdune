import {identity} from './auth.mjs';
import {callMailBroker} from './mail-broker.mjs';
const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function createMailAccounts(db,{getIdentity=identity,broker=callMailBroker}={}){return async request=>{
 if(new URL(request.url).pathname!=='/api/mail/accounts')return response({message:'Not found'},404);
 if(request.method!=='GET')return response({message:'Method not allowed'},405);
 const user=await getIdentity(request,db);if(!user)return response({message:'Sign in first.'},401);
 const row=await db.prepare('SELECT mailbox_address,verified_at FROM site_mail_identities WHERE user_id=? AND active=1').bind(user.id).first();
 if(!row||Number(row.verified_at)<=0||row.mailbox_address.toLowerCase().endsWith('.internal@dunerealms.com'))return response({accounts:[],purchasedMailboxManagement:false});
 let provider=null;try{provider=await broker({action:'status',userId:user.id});}catch{}
 const matched=provider?.configured&&provider.address===row.mailbox_address;
 return response({accounts:[{address:row.mailbox_address,type:'DuneRealms staff mailbox',status:matched?(provider.active?'active':'inactive'):'unavailable',storageBytes:null,quotaBytes:null,webmailUrl:'https://www.lgbbenelux.org/webmail/',capabilities:{openWebmail:!!matched&&provider.active,changePassword:!!matched&&provider.active,purchasedPasswordReset:false}}],purchasedMailboxManagement:false});
};}

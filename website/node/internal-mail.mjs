import {runPoliticalNotifications} from './political-notifications.mjs';
import {runTicketMail} from './internal-mail-tickets.mjs';
import {spawn} from 'node:child_process';
import {scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {identity} from './auth.mjs';
import {accessFor} from './permissions.mjs';
import {ownClanMailbox,ensureClanMailbox,initializeClanMail,reconcileClanMail} from './internal-mail-clans.mjs';
import {canUseStaffMail,ensureStaffMailbox} from './internal-mail-staff.mjs';
import {politicalMailContext,ensureGovernmentMailbox,initializePoliticalMailRanks} from './internal-mail-government.mjs';
import {reportInternalMail,convertReportedMail,initializeMailReports} from './internal-mail-reports.mjs';
const scrypt=promisify(rawScrypt);
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data,status=200)=>Response.json(data,{status,headers});
export const eligibilitySql=`SELECT a.id,a.username,a.role FROM site_accounts a WHERE a.password_hash REGEXP '^[0-9a-fA-F]{128}$' AND a.role<>'memorial' AND NOT EXISTS(SELECT 1 FROM cp_account_ranks r WHERE r.user_id=a.id AND r.rank_key='memorial')`;
export async function internalMailEligible(db,user){return !!await db.prepare(eligibilitySql+' AND a.id=?').bind(user.id).first()&&(await accessFor(db,user)).nodes.includes('web.mail.internal.view');}
export async function initializeInternalMailAccess(db){
 const key='internal-mail-own-access-v1';if(await db.prepare('SELECT setting_value FROM website_settings WHERE setting_key=?').bind(key).first())return;
 const {results}=await db.prepare("SELECT rank_key,permissions_json FROM cp_ranks WHERE kind='access' AND rank_level>0").all();
 for(const row of results){const nodes=JSON.parse(row.permissions_json);if(!nodes.includes('web.mail.internal.view'))await db.prepare('UPDATE cp_ranks SET permissions_json=?,version=version+1 WHERE rank_key=?').bind(JSON.stringify([...nodes,'web.mail.internal.view']),row.rank_key).run();}
 await db.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,?)').bind(key,'complete',Date.now()).run();
}
export function internalMailBroker(payload){return new Promise((resolve,reject)=>{
 const dir='/home/dunerealms/.config/';let output=[],bytes=0,done=false;
 const child=spawn('/usr/bin/ssh',['-T','-i',dir+'staff-mail-broker-key','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=7','-o','UserKnownHostsFile='+dir+'staff-mail-broker-known-hosts','root@2.28.33.142'],{stdio:['pipe','pipe','ignore']});
 const fail=(message='Internal Mail is temporarily unavailable.',code=503)=>{if(done)return;done=true;clearTimeout(timer);child.kill();reject(Object.assign(Error(message),{status:code}));};
 const timer=setTimeout(()=>fail('Mail operation timed out. Refresh before retrying a send.'),90000);child.on('error',()=>fail());child.stdin.on('error',()=>fail());
 child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>32*1024*1024)return fail('Mail response exceeds limit.',413);output.push(chunk);});
 child.on('close',code=>{if(done)return;try{const value=JSON.parse(Buffer.concat(output).toString('utf8'));if(code||value.error)return fail(value.error||'Internal Mail is temporarily unavailable.',[400,403,404,409,410,413,429,503].includes(value.code)?value.code:503);if(value.ok!==true)return fail();done=true;clearTimeout(timer);resolve(value);}catch{fail();}});
 const encoded=JSON.stringify(payload)+'\n';if(Buffer.byteLength(encoded)>32*1024*1024)return fail('Mail request exceeds limit.',413);child.stdin.end(encoded);
});}
export async function ensureInternalMailbox(db,user,broker=internalMailBroker){if(!await internalMailEligible(db,user))return null;return broker({action:'internal_ensure',userId:user.id,eligible:true});}
export async function syncClanMailRegistry(db,broker=internalMailBroker){await initializeClanMail(db);await reconcileClanMail(db,broker);}
export async function resolveMailRecipients(db,values,{eligible=internalMailEligible,broker=internalMailBroker,recipientAllowed=async()=>true,accountsOnly=false}={}){
 if(!Array.isArray(values)||values.length>20)throw Object.assign(Error('Use up to 20 recipients per field.'),{status:400});
 const resolved=[];
 for(const raw of values){
  if(typeof raw!=='string'||raw.length>254)throw Object.assign(Error('Invalid recipient.'),{status:400});
  const value=raw.trim(),internal=value.match(/^([a-f0-9-]{36})\.internal@dunerealms\.com$/i);
  if(accountsOnly&&(/ \(internal\)$/i.test(value)||value.includes('@')&&!value.startsWith('@')&&!internal))throw Object.assign(Error('Choose an authorised account from this mailbox’s recipient search.'),{status:403});
  if(value.toLowerCase()==='staff (internal)'){resolved.push((await ensureStaffMailbox(broker)).address);continue;}
  if(/ \(internal\)$/i.test(value)){
   const clan=await db.prepare('SELECT id,name,tag FROM site_clans WHERE active=1 AND LOWER(name)=?').bind(value.replace(/ \(internal\)$/i,'').toLowerCase()).first();
   if(!clan)throw Object.assign(Error('Clan recipient is unavailable.'),{status:400});
   resolved.push((await ensureClanMailbox(db,clan,broker)).address);continue;
  }
  if(!internal&&value.includes('@')&&!value.startsWith('@')){
   if(!/^[a-z0-9][a-z0-9-]*\.internal@dunerealms\.com$/i.test(value))throw Object.assign(Error('Internal Mail can only send to DuneRealms internal accounts and shared mailboxes.'),{status:403});
   resolved.push(value.toLowerCase());continue;
  }
  const account=await db.prepare(eligibilitySql+(internal?' AND a.id=?':' AND LOWER(a.username)=?')).bind(internal?internal[1].toLowerCase():value.replace(/^@/,'').toLowerCase()).first();
  if(!account||!await eligible(db,account)||!await recipientAllowed(db,account))throw Object.assign(Error('This recipient is not available for the selected mailbox.'),{status:403});
  await broker({action:'internal_ensure',userId:account.id,eligible:true});resolved.push(account.id+'.internal@dunerealms.com');
 }
 return [...new Set(resolved)];
}
export function startInternalMailSync(db,{broker=internalMailBroker}={}){let busy=false,closed=false;const sync=async()=>{if(busy||closed)return;busy=true;try{await initializePoliticalMailRanks(db);await initializeMailReports(db);await ensureStaffMailbox(broker);await initializeClanMail(db);await reconcileClanMail(db,broker);const{results}=await db.prepare(eligibilitySql).all();for(const user of results){if(closed)break;await ensureInternalMailbox(db,user,broker).catch(()=>{});}await runTicketMail(db,{broker,eligible:internalMailEligible,staffAccess:canUseStaffMail});await runPoliticalNotifications(db,{broker,eligible:internalMailEligible});}catch{console.error('Internal mailbox reconciliation pending');}finally{busy=false;}};void sync();const timer=setInterval(sync,60000);timer.unref();return()=>{closed=true;clearInterval(timer);};}
const routes={
 '/api/internal-mail/messages/list':['internal_list',['folder','offset','limit','unread','tag','sort']],
 '/api/internal-mail/messages/move':['internal_move',['folder','uid','uidValidity','destination']],
 '/api/internal-mail/folders/create':['internal_create_folder',['name']],
 '/api/internal-mail/folders/rename':['internal_rename_folder',['name','newName']],
 '/api/internal-mail/folders/delete':['internal_delete_folder',['name']],
 '/api/internal-mail/messages/get':['internal_get',['folder','uid','uidValidity']],
 '/api/internal-mail/attachments/get':['internal_attachment',['folder','uid','uidValidity','partId']],
 '/api/internal-mail/messages/send':['internal_send',['requestId','to','cc','bcc','subject','text','html','attachments','forward']],
 '/api/internal-mail/messages/read':['internal_mark_read',['folder','uid','uidValidity','seen']],
 '/api/internal-mail/messages/delete':['internal_delete',['folder','uid','uidValidity']],
 '/api/internal-mail/messages/tags':['internal_tags',['folder','uid','uidValidity','tags']]
};
export function createInternalMail(db,{origin='https://cp.dunerealms.com',broker=internalMailBroker,getIdentity=identity,eligible=internalMailEligible,staffAccess=canUseStaffMail,settings=process.env,governmentAccess=(db,user)=>politicalMailContext(db,user,settings),now=Date.now}={}){
 const attempts=new Map();
 return async request=>{
  const path=new URL(request.url).pathname;
  if(!routes[path]&&!['/api/internal-mail/me','/api/internal-mail/summary','/api/internal-mail/password','/api/internal-mail/password/reveal','/api/internal-mail/forwarding','/api/internal-mail/recipients/search','/api/internal-mail/messages/report','/api/internal-mail/reports/convert'].includes(path))return reply({message:'Not found'},404);
  if(request.method!==(['/api/internal-mail/me','/api/internal-mail/summary'].includes(path)?'GET':'POST'))return reply({message:'Method not allowed'},405);
  const user=await getIdentity(request,db);if(!user)return reply({message:'Sign in first.'},401);
  if(!await eligible(db,user))return reply({eligible:false,message:'This account does not have an internal mailbox.'},403);
  if(request.method==='POST'&&request.headers.get('Origin')!==origin)return reply({message:'Request origin rejected'},403);
  try{
   if(path==='/api/internal-mail/summary'){const v=await broker({action:'internal_list',userId:user.id,folder:'INBOX',offset:0,limit:1,unread:true});return reply({ok:true,unreadCount:v.total,scope:'personal'});}
   if(path==='/api/internal-mail/me'){
    let value=await broker({action:'internal_status',userId:user.id});
    if(!value.configured&&value.capabilities?.provision)value=await broker({action:'internal_ensure',userId:user.id,eligible:true});
    const clan=await ownClanMailbox(db,user);if(clan)await ensureClanMailbox(db,clan,broker);
    const staff=await staffAccess(db,user);if(staff)await ensureStaffMailbox(broker);
    const political=await governmentAccess(db,user);
    if(political?.canFactionMail)await ensureGovernmentMailbox('faction',political.factionId,broker);
    if(political?.canImperialMail)await ensureGovernmentMailbox('imperial',null,broker);
    return reply({...value,eligible:true,staff,faction:political?.canFactionMail?{name:political.factionName}:null,imperial:!!political?.canImperialMail,clan:clan?{name:clan.name,role:clan.clan_role}:null});
   }
   let body;try{body=await request.json();}catch{return reply({message:'Send valid JSON'},400);}
   if(!body||typeof body!=='object'||Array.isArray(body))return reply({message:'Invalid request'},400);
   let mailboxUserId=user.id,mailboxName=user.username,political=null;
   if(body.scope==='clan'){
    if(path.startsWith('/api/internal-mail/password')||path==='/api/internal-mail/forwarding')return reply({message:'Shared clan credentials and forwarding cannot be changed here.'},403);
    const clan=await ownClanMailbox(db,user);if(!clan)return reply({message:'Only the current clan owner and officers can open CLAN mail.'},403);
    mailboxUserId=(await ensureClanMailbox(db,clan,broker)).userId;
    mailboxName=clan.name+' (internal)';
   }else if(body.scope==='staff'){
    if(!await staffAccess(db,user))return reply({message:'Current staff access is required for this mailbox.'},403);
    if(path.startsWith('/api/internal-mail/password')||path==='/api/internal-mail/forwarding')return reply({message:'Shared staff credentials and forwarding are managed internally.'},403);
    mailboxUserId=(await ensureStaffMailbox(broker)).userId;mailboxName='Staff (internal)';
   }else if(['faction','imperial'].includes(body.scope)){
    political=await governmentAccess(db,user);
    if(!political||!(body.scope==='faction'?political.canFactionMail:political.canImperialMail))return reply({message:'A verified current political role is required for this mailbox.'},403);
    if(path.startsWith('/api/internal-mail/password')||path==='/api/internal-mail/forwarding')return reply({message:'Shared political credentials and forwarding are managed internally.'},403);
    mailboxUserId=(await ensureGovernmentMailbox(body.scope,political.factionId,broker)).userId;mailboxName=body.scope==='faction'?political.factionName:'Imperial';
   }else if(body.scope&&body.scope!=='personal')return reply({message:'Unknown mailbox.'},400);
   const restricted=['staff','faction','imperial'].includes(body.scope);
   const recipientAllowed=async(db,target)=>{if(body.scope==='staff')return staffAccess(db,target);if(['faction','imperial'].includes(body.scope)){const context=await governmentAccess(db,target);return body.scope==='faction'?!!context?.canFactionMail&&context.factionId===political.factionId:!!context?.canImperialMail;}return true;};
   if(path==='/api/internal-mail/messages/report')return reply(await reportInternalMail(db,{user,sourceId:mailboxUserId,scope:body.scope||'personal',body,broker}));
   if(path==='/api/internal-mail/reports/convert'){
    if(body.scope!=='staff'||!await staffAccess(db,user))return reply({message:'Open a report in the shared staff mailbox first.'},403);
    return reply(await convertReportedMail(db,{body,broker}));
   }
   if(path==='/api/internal-mail/recipients/search'){
    const query=typeof body.query==='string'?body.query.trim().replace(/^@/,'').toLowerCase():'';
    if(!query||query.length>40||/[\x00-\x1f]/.test(query))return reply({users:[],clans:[]});
    const {results}=await db.prepare(eligibilitySql+' AND LEFT(LOWER(a.username),CHAR_LENGTH(?))=? ORDER BY a.username LIMIT 10').bind(query,query).all();
    const users=[];for(const account of results)if((!restricted||account.id!==user.id)&&await eligible(db,account)&&await recipientAllowed(db,account))users.push({username:account.username});
    if(restricted)return reply({users,clans:[],mailboxes:[]});
    const {results:clans}=await db.prepare('SELECT name FROM site_clans WHERE active=1 AND LEFT(LOWER(name),CHAR_LENGTH(?))=? ORDER BY name LIMIT 10').bind(query,query).all();
    return reply({users,clans:clans.map(clan=>({name:clan.name,label:clan.name+' (internal)'})),mailboxes:'staff'.startsWith(query)?[{label:'Staff (internal)'}]:[]});
   }
   if(path==='/api/internal-mail/forwarding'){
    const address=body.address===null||body.address===''?null:typeof body.address==='string'?body.address.trim().toLowerCase():undefined;
    if(address===undefined)return reply({message:'Enter a forwarding address or disable forwarding.'},400);
    if(address){const contact=await db.prepare('SELECT address,verified_at FROM site_contact_emails WHERE user_id=?').bind(user.id).first();if(!contact?.verified_at||contact.address?.toLowerCase()!==address)return reply({message:'Verify this address in Support notification email first, then save forwarding.'},403);}
    return reply(await broker({action:'internal_forwarding',userId:user.id,address,verified:!!address}));
   }
   if(path.startsWith('/api/internal-mail/password')){
    const time=now();for(const[k,v]of attempts)if(v.until<time)attempts.delete(k);if(attempts.size>5000)return reply({message:'Please try again later.'},429);
    let a=attempts.get(user.id);if(!a){a={count:0,until:time+900000};attempts.set(user.id,a);}if(++a.count>5)return reply({message:'Too many password attempts. Try again in 15 minutes.'},429);
    if(typeof body.currentPassword!=='string'||body.currentPassword.length>256)return reply({message:'Enter your current website password.'},400);
    const account=await db.prepare('SELECT password_salt,password_hash FROM site_accounts WHERE id=?').bind(user.id).first();
    if(!/^[a-fA-F0-9]{128}$/.test(account?.password_hash||''))return reply({message:'Password verification unavailable.'},403);
    const actual=await scrypt(body.currentPassword,account.password_salt,64),expected=Buffer.from(account.password_hash,'hex');if(!timingSafeEqual(actual,expected))return reply({message:'Incorrect website password.'},403);
    const payload={userId:user.id,reauthenticatedAt:Math.floor(time/1000)};
    if(path.endsWith('/reveal'))return reply(await broker({...payload,action:'internal_reveal_password'}));
    if(body.generate!==true&&(typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>256||/[\r\n\0]/.test(body.newPassword)))return reply({message:'Use 12–256 characters without line breaks.'},400);
    return reply(await broker({...payload,action:'internal_set_password',requestId:body.requestId,...(body.generate===true?{generate:true}:{password:body.newPassword})}));
   }
   const[action,fields]=routes[path],payload={action,userId:mailboxUserId};for(const field of fields)if(Object.hasOwn(body,field))payload[field]=body[field];
   if(action==='internal_send'){for(const field of ['to','cc','bcc'])payload[field]=await resolveMailRecipients(db,body[field]||[],{eligible,broker,recipientAllowed,accountsOnly:restricted});payload.senderName=mailboxName;}
   const value=await broker(payload);
   if(path==='/api/internal-mail/attachments/get'){
    const data=Buffer.from(value.dataBase64||'','base64');if(data.length>10*1024*1024)return reply({message:'Attachment exceeds limit.'},413);
    return new Response(data,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(String(value.filename||'attachment').replace(/[\r\n\0/\\]/g,'_')),'Content-Security-Policy':"default-src 'none'; sandbox"}});
   }
   return reply(value);
  }catch(error){const known=[400,403,404,409,410,413,429,503].includes(error.status);return reply({message:known?error.message:'Internal Mail is temporarily unavailable.'},known?error.status:503);}
 };
}

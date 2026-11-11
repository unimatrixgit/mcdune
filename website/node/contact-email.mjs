import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {identity} from './auth.mjs';
import {json} from './game-link.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const contactSchema=`CREATE TABLE IF NOT EXISTS site_contact_emails (
 user_id CHAR(36) PRIMARY KEY,address VARCHAR(254),verified_at BIGINT,
 pending_address VARCHAR(254),code_hash CHAR(64),expires_at BIGINT,attempts INTEGER NOT NULL DEFAULT 0,
 requested_at BIGINT NOT NULL DEFAULT 0,window_started_at BIGINT NOT NULL DEFAULT 0,send_count INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 0,sync_pending INTEGER NOT NULL DEFAULT 0
)`;
export async function initializeContactEmails(db){await db.prepare(contactSchema).run();}
export function normalizeContactEmail(value){
 if(typeof value!=='string')throw Error('Enter a valid email address.');
 const address=value.trim().toLowerCase();
 // A deliberately conservative mailbox format; never accept headers or internal aliases.
 if(address.length>254||!address.match(/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/)||address.split('@')[0].length>64||address.endsWith('.invalid'))throw Error('Enter a valid email address.');
 return address;
}
export function contactBroker(payload){return new Promise((resolve,reject)=>{
 const p=spawn('/usr/bin/php',['/home/dunerealms/apps/integrations/contact-email.php'],{stdio:['pipe','pipe','ignore']});let output='',done=false;
 const fail=()=>{if(done)return;done=true;clearTimeout(timer);p.kill();reject(Error('Contact email service unavailable.'));};
 const timer=setTimeout(fail,20000);p.on('error',fail);p.stdin.on('error',fail);p.stdout.on('data',b=>{output+=b;if(output.length>1024)fail();});
 p.on('close',code=>{if(done)return;done=true;clearTimeout(timer);try{const result=JSON.parse(output);if(code||result.ok!==true)throw Error();resolve(result);}catch{reject(Error('Contact email service unavailable.'));}});p.stdin.end(JSON.stringify(payload));
});}
export function createContactEmail(db,{origin='https://cp.dunerealms.com',broker=contactBroker,now=Date.now,makeCode=()=>randomBytes(18).toString('hex')}={}){
 const passwordAttempts=new Map();
 return async request=>{
  const user=await identity(request,db);if(!user)return json({message:'Sign in first.'},401);
  if(request.method==='GET'){
   const row=await db.prepare('SELECT * FROM site_contact_emails WHERE user_id=?').bind(user.id).first();
   return json({email:row?.address||null,verified:!!row?.verified_at,pendingEmail:row?.expires_at>now()?row.pending_address:null,syncPending:!!row?.sync_pending});
  }
  if(request.method!=='POST')return json({message:'Method not allowed.'},405);
  if(request.headers.get('origin')!==origin)return json({message:'Origin rejected.'},403);
  let body;try{body=await request.json();}catch{return json({message:'Invalid request.'},400);}
  if(!body||!['request','confirm','remove','sync'].includes(body.action))return json({message:'Invalid request.'},400);
  if(['request','remove'].includes(body.action)){
   const time=now();if(passwordAttempts.size>5000)for(const [id,r]of passwordAttempts)if(r.until<time)passwordAttempts.delete(id);
   let limit=passwordAttempts.get(user.id);if(!limit||limit.until<time)passwordAttempts.set(user.id,limit={until:time+900000,count:0});
   if(passwordAttempts.size>5000||++limit.count>5)return json({message:'Too many attempts. Try again in 15 minutes.'},429);
   if(body.confirmed!==true)return json({message:'Confirm this change before continuing.'},400);
  }
  await db.prepare('INSERT INTO site_contact_emails(user_id) VALUES(?) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id').bind(user.id).run();
  const row=await db.prepare('SELECT * FROM site_contact_emails WHERE user_id=?').bind(user.id).first(),time=now();
  if(body.action==='sync'){
   if(!row.sync_pending)return json({message:'Support notification settings are up to date.',syncPending:false});
   const key=user.id+':sync';let limit=passwordAttempts.get(key);if(!limit||limit.until<time)passwordAttempts.set(key,limit={until:time+60000,count:0});
   if(++limit.count>3)return json({message:'Please wait a minute before retrying Support sync.'},429);
  }
  if(body.action==='request'){
   let address;try{address=normalizeContactEmail(body.email);}catch(e){return json({message:e.message},400);}
   if(address===row.address&&row.verified_at&&!row.sync_pending)return json({message:'This email is already verified.'});
   if(time-row.requested_at<60000||time-row.window_started_at<3600000&&row.send_count>=5)return json({message:'Please wait before requesting another verification email.'},429);
   const code=makeCode(),version=row.version+1,windowStart=time-row.window_started_at>=3600000?time:row.window_started_at,count=windowStart===time?1:row.send_count+1;
   const updated=await db.prepare('UPDATE site_contact_emails SET pending_address=?,code_hash=?,expires_at=?,attempts=0,requested_at=?,window_started_at=?,send_count=?,version=? WHERE user_id=? AND version=?').bind(address,hash(code),time+900000,time,windowStart,count,version,user.id,row.version).run();
   if(!updated.meta.changes)return json({message:'Email settings changed. Refresh and retry.'},409);
   try{await broker({action:'verify',userId:user.id,email:address,code});}
   catch{await db.prepare('UPDATE site_contact_emails SET code_hash=NULL,pending_address=NULL,expires_at=NULL WHERE user_id=? AND version=?').bind(user.id,version).run();return json({message:'Verification email could not be sent. Your existing contact address is unchanged. Try again later.'},503);}
   return json({message:'Verification email sent. Paste its code below within 15 minutes.'});
  }
  if(body.action==='confirm'){
   if(!/^[a-f0-9]{36}$/.test(body.code||'')||!row.code_hash||row.expires_at<=time||row.attempts>=5)return json({message:'Invalid or expired code. Request a new verification email.'},400);
   if(!timingSafeEqual(Buffer.from(hash(body.code)),Buffer.from(row.code_hash))){await db.prepare('UPDATE site_contact_emails SET attempts=attempts+1 WHERE user_id=? AND version=? AND code_hash=?').bind(user.id,row.version,row.code_hash).run();return json({message:'Invalid or expired code.'},400);}
   const saved=await db.prepare('UPDATE site_contact_emails SET address=pending_address,verified_at=?,pending_address=NULL,code_hash=NULL,expires_at=NULL,version=version+1,sync_pending=1 WHERE user_id=? AND version=? AND code_hash=? AND attempts<5 AND expires_at>?').bind(time,user.id,row.version,row.code_hash,time).run();
   if(!saved.meta.changes)return json({message:'This verification is no longer current. Refresh and retry.'},409);
  }else if(body.action==='remove'){
   const saved=await db.prepare('UPDATE site_contact_emails SET address=NULL,verified_at=NULL,pending_address=NULL,code_hash=NULL,expires_at=NULL,version=version+1,sync_pending=1 WHERE user_id=? AND version=?').bind(user.id,row.version).run();
   if(!saved.meta.changes)return json({message:'Email settings changed. Refresh and retry.'},409);
  }
  const current=await db.prepare('SELECT * FROM site_contact_emails WHERE user_id=?').bind(user.id).first();
  try{await broker({action:'sync',userId:user.id,username:user.username,email:current.address,version:current.version});await db.prepare('UPDATE site_contact_emails SET sync_pending=0 WHERE user_id=? AND version=?').bind(user.id,current.version).run();}
  catch{return json({message:'Saved, but Support could not update its notification address. Use Retry Support sync before relying on email notifications.',syncPending:true},202);}
  return json({message:current.address?'Email verified. Support ticket notifications will use this address.':'Contact email removed. Read ticket updates on the Support website.',syncPending:false});
 };
}


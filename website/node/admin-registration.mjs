import {randomBytes,randomUUID,scrypt as rawScrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {identity} from './auth.mjs';
import {accessFor,rankFor,isOwnerRank,DEFAULT_RANKS} from './permissions.mjs';
import {normalizeContactEmail} from './contact-email.mjs';
const scrypt=promisify(rawScrypt),reply=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export function createAdminRegistration(db,origin){return async request=>{
 const actor=await identity(request,db);if(!actor)return reply({message:'Sign in first.'},401);
 if(!(await accessFor(db,actor)).ranks.some(isOwnerRank))return reply({message:'Network account administrator access required.'},403);
 if(request.method==='GET'){const{results:stored}=await db.prepare('SELECT rank_key FROM cp_ranks').all();const keys=[...new Set([...DEFAULT_RANKS.map(r=>r.key),...stored.map(r=>r.rank_key)])];const ranks=await Promise.all(keys.map(k=>rankFor(db,k)));return reply({ranks:ranks.filter(r=>r.kind==='access'&&r.level>0&&!['memorial','crysknife'].includes(r.key)).map(r=>({key:r.key,label:r.label}))});}
 if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
 if(request.headers.get('origin')!==origin)return reply({message:'Origin rejected.'},403);
 let b;try{b=await request.json();}catch{return reply({message:'Invalid request.'},400);}
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';let email;
 try{email=normalizeContactEmail(b.email==='no_reply'?'no_reply@dunerealms.com':b.email);}catch(e){return reply({message:e.message},400);}
 if(!/^[a-z0-9_]{3,32}$/.test(username)||!Array.isArray(b.ranks)||!b.ranks.length||b.ranks.length>20||!['15plus','under15'].includes(b.ageBand))return reply({message:'Complete username, email, ranks and age declaration.'},400);
 const ranks=[...new Set(b.ranks)];for(const k of ranks){const r=await rankFor(db,k);if(r.kind!=='access'||r.level<=0||['memorial','crysknife'].includes(k))return reply({message:'Invalid rank.'},400);}
 const id=randomUUID(),password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex'),now=Date.now();
 try{await db.batch([{async run(c){const q=async(sql,v=[])=>(await c.execute(sql,v))[0];const a=await q('SELECT role FROM site_accounts WHERE id=? FOR UPDATE',[actor.id]);const extra=await q('SELECT rank_key FROM cp_account_ranks WHERE user_id=? FOR SHARE',[actor.id]);if(![a[0]?.role,...extra.map(r=>r.rank_key)].some(isOwnerRank))throw Error('permission-changed');await q('INSERT INTO site_accounts(id,username,display_name,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)',[id,username,username,salt,hash,ranks[0],now]);for(const k of ranks.slice(1))await q('INSERT INTO cp_account_ranks(user_id,rank_key) VALUES(?,?)',[id,k]);await q('INSERT INTO player_profiles(user_id,display_name,minecraft_name,discord_name,created_at,updated_at) VALUES(?,?,?,?,?,?)',[id,username,'','',now,now]);await q('INSERT INTO site_age_declarations(user_id,age_band,declared_at) VALUES(?,?,?)',[id,b.ageBand,now]);await q('INSERT INTO site_contact_emails(user_id,address,version) VALUES(?,?,0)',[id,email]);await q('INSERT INTO site_first_login(user_id,created_at) VALUES(?,?)',[id,now]);await q('INSERT INTO account_audit(id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)',[randomUUID(),actor.id,'admin-register',JSON.stringify({username,ranks,firstLoginRequired:true}),now]);return{meta:{changes:1}};}}]);}catch(e){if(e.code==='ER_DUP_ENTRY'||String(e.message).includes('UNIQUE constraint'))return reply({message:'Username unavailable.'},409);if(e.message==='permission-changed')return reply({message:'Your account authority changed.'},403);throw e;}
 return reply({username,credentials:'DuneRealms account: '+username+'\nWebsite: https://cp.dunerealms.com/\nPassword: '+password+'\n\nAt your first sign-in, change your password and verify your own email address:\nhttps://cp.dunerealms.com/#security\n',firstLoginRequired:true},201);
 };}

import {randomBytes} from 'node:crypto';
import {createChallenge,randomInt,verifySolution} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/pbkdf2';

export function createContact(settings={},options={}){
  const secret=randomBytes(32).toString('hex'),keySecret=randomBytes(32).toString('hex');
  const issued=new Map(),now=options.now||Date.now;
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async request=>{
    const url=new URL(request.url);
    for(const [signature,item] of issued)if(item.expires<=now())issued.delete(signature);
    if(url.pathname==='/api/contact/challenge'){
      if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
      if(issued.size>=256)return reply({error:'Please try again shortly.'},429);
      const expires=now()+120000;
      const challenge=await createChallenge({algorithm:'PBKDF2/SHA-256',cost:options.cost||1000,counter:options.counter??randomInt(1000,2000),deriveKey,expiresAt:new Date(expires),hmacSignatureSecret:secret,hmacKeySignatureSecret:keySecret,data:{purpose:'operator-contact'}});
      issued.set(challenge.signature,{challenge,expires});
      return reply(challenge);
    }
    if(url.pathname!=='/api/contact/reveal')return reply({error:'not_found'},404);
    if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
    if(![url.origin,'https://wiki.dunerealms.com'].includes(request.headers.get('Origin')))return reply({error:'origin_required'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'json_required'},415);
    try{
      const text=await request.text();if(text.length>8192)return reply({error:'payload_too_large'},413);
      const {payload}=JSON.parse(text);if(typeof payload!=='string'||payload.length>7000)return reply({error:'verification_required'},400);
      const decoded=JSON.parse(Buffer.from(payload,'base64').toString('utf8'));
      const signature=decoded?.challenge?.signature,item=issued.get(signature);
      if(!item||item.expires<=now())return reply({error:'Verification expired. Please try again.'},403);
      const solution=decoded.solution;
      if(!Number.isSafeInteger(solution?.counter)||solution.counter<0||solution.counter>0xffffffff||!/^[a-f0-9]{64}$/i.test(solution?.derivedKey||''))return reply({error:'verification_failed'},403);
      // Consume before awaiting verification: the same proof cannot be replayed concurrently.
      issued.delete(signature);
      const result=await verifySolution({challenge:item.challenge,solution,deriveKey,hmacSignatureSecret:secret,hmacKeySignatureSecret:keySecret});
      if(!result.verified)return reply({error:'Verification failed. Please try again.'},403);
      return reply({email:settings.CONTACT_EMAIL||'unimatrix@dunerealms.com'});
    }catch{return reply({error:'verification_required'},400);}
  };
}

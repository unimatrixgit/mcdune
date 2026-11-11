import {spawn} from 'node:child_process';

const directory='/home/dunerealms/.config/';
// The remote key is bound to one source IP and a forced JSON-only root command.
// It cannot open a shell, forward a port or select an arbitrary mailbox address.
export async function callMailBroker(payload){
 if(!payload||!['ensure','status','set_password'].includes(payload.action)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(payload.userId||''))throw Error('Invalid mailbox request');
 const request={action:payload.action,userId:payload.userId};
 if(payload.action==='ensure'){
  if(!/^[a-z0-9_]{3,32}$/.test(payload.username||''))throw Error('Invalid staff username');
  request.username=payload.username;
 }
 if(payload.action==='set_password'){
  if(typeof payload.password!=='string'||payload.password.length<12||payload.password.length>256||/[\r\n\0]/.test(payload.password))throw Error('Use a password of 12–256 characters without line breaks');
  request.password=payload.password;
 }
 return new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/ssh',['-T','-i',directory+'staff-mail-broker-key','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=7','-o','UserKnownHostsFile='+directory+'staff-mail-broker-known-hosts','root@2.28.33.142'],{stdio:['pipe','pipe','ignore']});
  let output='',finished=false;
  const fail=message=>{if(finished)return;finished=true;clearTimeout(timer);child.kill();reject(Error(message));};
  const timer=setTimeout(()=>fail('Mailbox service temporarily unavailable'),15000);
  child.on('error',()=>fail('Mailbox service temporarily unavailable'));
  child.stdin.on('error',()=>fail('Mailbox service temporarily unavailable'));
  child.stdout.on('data',data=>{output+=data;if(output.length>8192)fail('Invalid mailbox service response');});
  child.on('close',code=>{
   if(finished)return;
   finished=true;clearTimeout(timer);
   try{
    const result=JSON.parse(output);
    if(code!==0||result.error)throw Error(result.error||'Mailbox service temporarily unavailable');
    if(typeof result.active!=='boolean'||typeof result.needsPasswordSetup!=='boolean'||(result.configured&&!/^[a-z0-9_]+@dunerealms\.com$/.test(result.address||'')))throw Error('Invalid mailbox service response');
    resolve(result);
   }catch(error){reject(Error(error.message==='Unexpected end of JSON input'?'Mailbox service temporarily unavailable':error.message));}
  });
  child.stdin.end(JSON.stringify(request)+'\n');
 });
}

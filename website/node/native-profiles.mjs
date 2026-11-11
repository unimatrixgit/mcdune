import{existsSync}from'node:fs';
import{spawn}from'node:child_process';
export async function syncNativeProfile(account){
 const script='/home/dunerealms/apps/integrations/sync-public-profile.php';if(!existsSync(script))return;
 await new Promise((resolve,reject)=>{const p=spawn('/usr/bin/php',[script],{stdio:['pipe','ignore','ignore']});const timer=setTimeout(()=>{p.kill();reject(Error('Public profile synchronization timed out'));},10000);p.once('error',error=>{clearTimeout(timer);reject(error)});p.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Public profile synchronization failed'))});p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(account));});
}

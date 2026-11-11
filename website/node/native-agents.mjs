import {syncGamePermissions} from './game-permission-sync.mjs';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {accessFor} from './permissions.mjs';
import {syncNativeSeals} from './native-seals.mjs';
const native='/home/dunerealms/apps/integrations/osticket/sync-agents.php';
export async function syncNativeAgents(db){
 if(!existsSync(native))return;
 const {results}=await db.prepare('SELECT id,username,role FROM site_accounts').all();
 const accounts=[];for(const user of results){const access=await accessFor(db,user);accounts.push({...user,role:access.rank,ranks:access.ranks,permissions:access.nodes});}
 await new Promise((resolve,reject)=>{const child=spawn('/usr/bin/php',[native],{stdio:['pipe','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=chunk.toString().slice(0,1000)});const timer=setTimeout(()=>{child.kill();reject(Error('Native staff sync timed out'));},20000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Native staff sync failed'));});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(accounts));});
 await syncNativeSeals(db);
 await syncGamePermissions(db);
}


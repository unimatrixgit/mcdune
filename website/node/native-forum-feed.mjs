import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);let cached=null,expires=0,pending=null;
export async function nativeForumFeed(page){
 if(!cached||Date.now()>=expires){
  pending??=run('/usr/bin/php',['/home/dunerealms/apps/integrations/portal-feed.php'],{timeout:8000,maxBuffer:262144}).then(({stdout})=>{const data=JSON.parse(stdout);if(!Array.isArray(data.posts))throw Error('Invalid forum feed');cached=data.posts.slice(0,9);expires=Date.now()+30000;}).finally(()=>{pending=null;});
  await pending;
 }
 return {posts:cached.slice((page-1)*3,page*3),page,pages:Math.ceil(cached.length/3)};
}

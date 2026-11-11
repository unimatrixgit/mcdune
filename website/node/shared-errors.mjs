import {readFile} from 'node:fs/promises';
const files={'/error.html':['error.html','text/html; charset=utf-8'],'/account-required.html':['error.html','text/html; charset=utf-8'],'/shared-error.css':['error.css','text/css; charset=utf-8'],'/shared-error.js':['error.js','text/javascript; charset=utf-8'],'/shared-error-art.png':['account-clerk.png','image/png']};
export async function sharedErrorResponse(request){
 const path=new URL(request.url).pathname,entry=files[path];if(!entry)return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 return new Response(request.method==='HEAD'?null:await readFile(new URL('../shared/'+entry[0],import.meta.url)),{status:path==='/account-required.html'?403:200,headers:{'Content-Type':entry[1],'Cache-Control':entry[1].startsWith('image/')?'public, max-age=86400':'no-store','X-Content-Type-Options':'nosniff'}});
}

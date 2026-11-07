import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../dist/server/index.js';
import {openDatabase} from './mysql.mjs';
import {createAuth,identity,safeReturn} from './auth.mjs';
import {createWorldStatus} from './world-status.mjs';
const root=new URL('./public/',import.meta.url);
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'"};
export function createApplication(db,settings={}) {
  const origin=new URL(settings.PUBLIC_ORIGIN||'https://dunerealms.com').origin;
  const auth=createAuth(db,origin);
  const worldStatus=createWorldStatus(settings);
  return async function handle(request) {
    const url=new URL(request.url);
    if(url.pathname==='/api/worlds')return request.method==='GET'?worldStatus():new Response('Method not allowed',{status:405});
    if(url.pathname==='/signin-with-chatgpt')return Response.redirect(origin+'/login.html?return_to='+encodeURIComponent(safeReturn(url.searchParams.get('return_to'))),302);
    if(url.pathname==='/healthz'){await db.prepare('SELECT 1 AS ok').first();return Response.json({status:'ok',database:'connected'},{headers:{'Cache-Control':'no-store'}});}
    if(url.pathname.startsWith('/api/auth/'))return auth(request);
    if(['/login.html','/login.js','/login.css'].includes(url.pathname)){
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
      return new Response(request.method==='HEAD'?null:await readFile(new URL(url.pathname.slice(1),root)),{headers:{...security,'Cache-Control':'no-store','Content-Type':type+'; charset=utf-8'}});
    }
    // These identity headers are trusted by Sites, but are untrusted input on a public Node server.
    const headers=new Headers(request.headers);
    for(const key of [...headers.keys()])if(key.startsWith('oai-')||key.startsWith('x-internal-'))headers.delete(key);
    const user=await identity(request,db);
    if(user){headers.set('oai-authenticated-user-id',user.id);if(user.role==='staff')headers.set('oai-authenticated-user-email','verified-staff@dunerealms.internal');}
    const forwarded=new Request(request.url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half'});
    const response=await worker.fetch(forwarded,{...settings,DB:db,FORUM_ADMIN_EMAILS:'verified-staff@dunerealms.internal',SUPPORT_STAFF_EMAILS:'verified-staff@dunerealms.internal'});
    const type=response.headers.get('Content-Type')||'';
    if(request.method!=='HEAD'&&(type.includes('text/html')||type.includes('javascript'))){
      const body=(await response.text()).replaceAll('Sign in with ChatGPT','Sign in to DuneRealms');
      const out=new Headers(response.headers);out.delete('Content-Length');out.set('Content-Security-Policy',security['Content-Security-Policy']);
      return new Response(body,{status:response.status,headers:out});
    }
    return response;
  };
}
export async function start(settings=process.env) {
  const db=await openDatabase(settings),handle=createApplication(db,settings),origin=new URL(settings.PUBLIC_ORIGIN||'https://dunerealms.com').origin;
  const server=createServer(async(req,res)=>{
    try{
      let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const path=req.url||'/';if(!path.startsWith('/')||path.startsWith('//')){res.writeHead(400);res.end('Bad request');return;}
      const request=new Request(origin+path,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
      const result=await handle(request);res.writeHead(result.status,{...security,...Object.fromEntries(result.headers)});res.end(Buffer.from(await result.arrayBuffer()));
    }catch(error){console.error('Request failed:',error.code||error.name);if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message:'The website is temporarily unavailable.'}));}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(settings.PORT||3000),'127.0.0.1',resolve);});
  console.log('DuneRealms website running on localhost:'+Number(settings.PORT||3000)+'; MySQL connected.');
  const shutdown=()=>server.close(async()=>{await db.close();process.exit(0);});process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await start();

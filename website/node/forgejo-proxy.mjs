import {request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
export function createForgejoProxy(settings,authenticate){
 if(!settings.FORGEJO_URL)return ()=>false;
 const upstream=new URL(settings.FORGEJO_URL),origin=new URL(settings.PUBLIC_ORIGIN||'https://dunerealms.com');
 const authHeader=authenticate?(settings.FORGEJO_AUTH_HEADER||readFileSync('/home/dunerealms/.config/dunegit-proxy-header','utf8').trim()).toLowerCase():null;
 if(authHeader&&!/^x-dunegit-user-[a-z0-9-]+$/.test(authHeader))throw Error('Invalid private Git identity header');
 if(upstream.protocol!=='http:'||!['127.0.0.1','localhost'].includes(upstream.hostname))throw Error('Forgejo must bind to localhost');
 return (req,res)=>{
  if(req.url==='/git'||req.url?.startsWith('/git?')){res.writeHead(308,{Location:'/git/'+(req.url.slice(4)||''),'Cache-Control':'no-store'});res.end();return true;}
  if(!req.url?.startsWith('/git/'))return false;
  if(req.url.startsWith('/git/sso/'))return false;
  void (async()=>{
  const headers={...req.headers,host:origin.host,'x-forwarded-proto':origin.protocol.slice(0,-1),'x-forwarded-host':origin.host,'x-forwarded-for':req.socket.remoteAddress};
  for(const key of Object.keys(headers))if(key.startsWith('oai-')||key.startsWith('x-internal-')||key.startsWith('x-webauth-')||key.startsWith('x-dunegit-')||['connection','upgrade','proxy-authorization'].includes(key))delete headers[key];
  if(authenticate&&!headers.authorization&&!req.url.startsWith('/git/api/')){const login=await authenticate(req);if(login)headers[authHeader]=login;}
  if(headers.cookie)headers.cookie=headers.cookie.split(';').filter(c=>!/^__Host-dune(?:_|-)/.test(c.trim())).join(';');
  req.setTimeout(300000);
  const request=httpRequest({hostname:upstream.hostname,port:upstream.port,method:req.method,path:req.url.slice(4),headers},response=>{
   const out={...response.headers};delete out.connection;
   // Only the trusted control-panel origin may embed the existing Git surface.
   delete out['x-frame-options'];const ancestors="frame-ancestors 'self' https://cp.dunerealms.com";
   out['content-security-policy']=out['content-security-policy']?String(out['content-security-policy']).replace(/frame-ancestors[^;]*(;|$)/gi,'').trim()+'; '+ancestors:ancestors;
   res.writeHead(response.statusCode||502,out);response.pipe(res);response.on('error',()=>res.destroy());
  });
  request.setTimeout(300000,()=>request.destroy());
  request.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('The code forge is temporarily unavailable.');});
  res.on('close',()=>{if(!res.writableEnded)request.destroy();});req.on('aborted',()=>request.destroy());req.pipe(request);
  })().catch(()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('DuneGit sign-in is temporarily unavailable.');});
  return true;
 };
}

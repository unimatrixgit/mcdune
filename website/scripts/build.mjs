import{withCanonicalMenu,MAIN_MENU}from'./main-menu.mjs';
import{recordPageUpdates,patchMenuBadges}from'./menu-updates.mjs';
import{updatePortalNavigation}from'./portal-navigation.mjs';
// Package the authored web and worker sources without rewriting their content.
import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync,existsSync,rmSync,cpSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),web=path.join(root,'web'),dist=path.join(root,'dist');
// Fail before packaging if a public menu destination or illustration is missing.
for(const [label,href,icon] of MAIN_MENU){
 const url=new URL(href);
 if(url.hostname==='www.dunerealms.com'){
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  if(!existsSync(path.join(web,relative)))throw Error('Broken public menu link: '+label+' -> '+relative);
 }
 if(!existsSync(path.join(web,'assets',icon)))throw Error('Missing menu artwork: '+label+' -> '+icon);
}
for(const [page,dependencies] of [['shop.html',['shop-landing.css','shop-embed.js']],['kits.html',['kits.css','kits.js']]]){
 for(const file of dependencies)if(!existsSync(path.join(web,file)))throw Error('Missing '+page+' dependency: '+file);
}
recordPageUpdates({root});patchMenuBadges(root);writeFileSync(path.join(web,'portal-navigation.js'),withCanonicalMenu(readFileSync(path.join(web,'portal-navigation.js'),'utf8')));
const homepage=readFileSync(path.join(web,'index.html'),'utf8');
const legalNotice=homepage.match(/<aside class="legal-notice"[\s\S]*?<\/aside>/)?.[0];
if(!legalNotice)throw Error('Homepage legal notice is missing');
function preparePublicHtml(html){
 let result=updatePortalNavigation(html);
 if(!result.includes('class="legal-notice"')){
  if(!result.includes('</body>'))throw Error('Public HTML page missing closing body');
  result=result.replace('</body>',legalNotice+'</body>');
 }
 return result;
}
const assets={};const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4','.zip':'application/zip','.svg':'image/svg+xml'};
function collect(directory){for(const entry of readdirSync(directory).sort()){const p=path.join(directory,entry);if(statSync(p).isDirectory())collect(p);else{const relative=path.relative(web,p).split(path.sep).join('/');if(/^assets\/seals\/[^/]+-provenance\.txt$/.test(relative))continue;const type=types[path.extname(entry)];if(!type)throw Error('Unexpected asset: '+entry);const bytes=readFileSync(p);const payload=relative.endsWith('.html')?Buffer.from(preparePublicHtml(bytes.toString('utf8'))):bytes;assets['/'+relative]=[type,payload.toString('base64')]}}}collect(web);
let api=['feed-api.mjs','exchange-api.mjs','forum-api.mjs','community-api.mjs','portal-api.mjs'].map(file=>readFileSync(path.join(root,'worker',file),'utf8').replace(/export /g,'')).join('\n');let runtime=readFileSync(path.join(root,'worker/runtime.mjs'),'utf8').replace(/^import .*;$/gm,'');
if(existsSync(dist)){const resolved=path.resolve(dist);if(resolved!==path.join(root,'dist'))throw Error('Invalid dist directory');rmSync(resolved,{recursive:true,force:true})}
mkdirSync(path.join(dist,'server'),{recursive:true});mkdirSync(path.join(dist,'.openai'),{recursive:true});writeFileSync(path.join(dist,'server/index.js'),'const ASSET_DATA='+JSON.stringify(assets)+';\n'+api+'\n'+runtime);cpSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));console.log('Built Worker with',Object.keys(assets).length,'embedded website assets');
if(existsSync(path.join(root,'drizzle')))cpSync(path.join(root,'drizzle'),path.join(dist,'.openai/drizzle'),{recursive:true});

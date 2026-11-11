// Apply only the menu to an already-built release, leaving all other assets and APIs intact.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {updatePortalNavigation,PORTAL_CSS,PORTAL_SCRIPT,SHARED_HEADER,SHARED_HEAD,CONTEXT_SCRIPT,CONTEXT_CSS} from './portal-navigation.mjs';
const release=process.argv[2];if(!release)throw Error('Provide the target release path');
const withContext=process.argv.includes('--with-context');
const worker=release+'/dist/server/index.js',text=readFileSync(worker,'utf8'),prefix='const ASSET_DATA=';
if(!text.startsWith(prefix))throw Error('Unrecognized website build');
const end=text.indexOf(';\n');if(end<0)throw Error('Missing asset boundary');
const assets=JSON.parse(text.slice(prefix.length,end));let changed=0;
for(const entry of Object.values(assets)){if(!entry[0].startsWith('text/html'))continue;const html=Buffer.from(entry[1],'base64').toString(),updated=updatePortalNavigation(html);if(html!==updated){entry[1]=Buffer.from(updated).toString('base64');changed++;}}
if(!Object.values(assets).some(a=>a[0].startsWith('text/html')&&Buffer.from(a[1],'base64').toString().includes('Main navigation')))throw Error('No menus found');
assets['/portal-navigation.css']=['text/css; charset=utf-8',Buffer.from(PORTAL_CSS+'header.dune-site-header[hidden]{display:none!important}'+(withContext?CONTEXT_CSS:'')).toString('base64')];
assets['/portal-navigation.js']=['text/javascript; charset=utf-8',Buffer.from(PORTAL_SCRIPT+(withContext?CONTEXT_SCRIPT:'')).toString('base64')];
for(const [name,,icon]of (await import('./portal-navigation.mjs')).PORTAL_LINKS)for(const asset of [icon,icon.replace('-v2.webp','-full-v2.webp')]){const file=release+'/web/assets/'+asset;if(!existsSync(file))throw Error('Missing navigation artwork: '+name);assets['/assets/'+asset]=['image/webp',readFileSync(file).toString('base64')];}
assets['/assets/vaerkring-network-title-v1.webp']=['image/webp',readFileSync(release+'/web/assets/vaerkring-network-title-v1.webp').toString('base64')];
for(const asset of ['dunerealms-season-logo-v2.png','dunerealms-season-logo-v2.webp','seals/master-imperial-300.png']){const path=release+'/web/assets/'+asset;if(existsSync(path))assets['/assets/'+asset]=[asset.endsWith('.webp')?'image/webp':'image/png',readFileSync(path).toString('base64')];}
for(const name of (await import('node:fs')).readdirSync(release+'/web/assets/seals').filter(n=>/\.(png|json)$/.test(n))){assets['/assets/seals/'+name]=[name.endsWith('.json')?'application/json':'image/png',readFileSync(release+'/web/assets/seals/'+name).toString('base64')];}
writeFileSync(worker,prefix+JSON.stringify(assets)+text.slice(end));
for(const file of ['node/public/forums.html']){const path=release+'/'+file;if(existsSync(path))writeFileSync(path,updatePortalNavigation(readFileSync(path,'utf8')));}
console.log('Published navigation in '+changed+' embedded pages');

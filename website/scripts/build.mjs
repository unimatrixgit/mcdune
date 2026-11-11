import {updatePortalNavigation,PORTAL_CSS,PORTAL_SCRIPT,CONTEXT_CSS,CONTEXT_SCRIPT} from './portal-navigation.mjs';
import './build-contact.mjs';
import './build-staff.mjs';
import './build-patchnotes.mjs';
import './build-wiki.mjs';
import './build-dunemarks.mjs';
import './build-donations.mjs';
import './build-account.mjs';
import './build-planet-glyphs.mjs';
import './build-appointments.mjs';
import './build-notice.mjs';
import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync,existsSync,rmSync,cpSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),web=path.join(root,'web'),dist=path.join(root,'dist');
const assets={};const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.zip':'application/zip','.svg':'image/svg+xml'};
function collect(directory){for(const entry of readdirSync(directory)){const p=path.join(directory,entry);if(statSync(p).isDirectory())collect(p);else{const type=types[path.extname(entry)];if(!type&&path.extname(entry)==='.mcpack')continue;if(!type)throw Error('Unexpected asset: '+entry);assets['/'+path.relative(web,p).split(path.sep).join('/')]=[type,readFileSync(p).toString('base64')]}}}
collect(web);

// Apply the shared DuneRealms navigation to all bundled HTML pages.
for (const [name, asset] of Object.entries(assets)) {
  if (!name.endsWith('.html')) continue;
  const html = Buffer.from(asset[1], 'base64').toString('utf8');
  const updated = updatePortalNavigation(html);
  asset[1] = Buffer.from(updated, 'utf8').toString('base64');
}

// Publish the navigation stylesheet and script.
assets['/portal-navigation.css'] = [
  'text/css; charset=utf-8',
  Buffer.from(PORTAL_CSS + CONTEXT_CSS, 'utf8').toString('base64')
];
assets['/portal-navigation.js'] = [
  'text/javascript; charset=utf-8',
  Buffer.from(PORTAL_SCRIPT + CONTEXT_SCRIPT, 'utf8').toString('base64')
];

let api=['feed-api.mjs','exchange-api.mjs','forum-api.mjs','community-api.mjs','portal-api.mjs'].map(file=>readFileSync(path.join(root,'worker',file),'utf8').replace(/export /g,'')).join('\n');let runtime=readFileSync(path.join(root,'worker/runtime.mjs'),'utf8').replace(/^import .*;$/gm,'');
if(existsSync(dist)){const resolved=path.resolve(dist);if(resolved!==path.join(root,'dist'))throw Error('Invalid dist directory');rmSync(resolved,{recursive:true,force:true})}
mkdirSync(path.join(dist,'server'),{recursive:true});mkdirSync(path.join(dist,'.openai'),{recursive:true});writeFileSync(path.join(dist,'server/index.js'),'const ASSET_DATA='+JSON.stringify(assets)+';\n'+api+'\n'+runtime);cpSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));console.log('Built Worker with',Object.keys(assets).length,'embedded website assets');
if(existsSync(path.join(root,'drizzle')))cpSync(path.join(root,'drizzle'),path.join(dist,'.openai/drizzle'),{recursive:true});

import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {RELEASE_SCRIPT,RELEASE_CSS,RELEASE_VERSION} from './release-branding.mjs';
const root=process.argv[2];if(!root)throw Error('Release directory required');
const file=root+'/dist/server/index.js',before=readFileSync(file,'utf8'),prefix='const ASSET_DATA=',end=before.indexOf(';\n');if(!before.startsWith(prefix)||end<0)throw Error('Unknown asset bundle');const assets=JSON.parse(before.slice(prefix.length,end));
for(const[key,extra]of [['/portal-navigation.js',RELEASE_SCRIPT],['/portal-navigation.css',RELEASE_CSS]]){if(!assets[key])throw Error('Shared header asset missing');const text=Buffer.from(assets[key][1],'base64').toString();assets[key][1]=Buffer.from(text.includes('.dune-release-badge')?text:text+extra).toString('base64');}
const bump=s=>s.replace(/portal-navigation\.(js|css)\?v=hosting-9(?:-release-1002)?/g,'portal-navigation.$1?v=hosting-9-release-1002');
for(const asset of Object.values(assets))if(asset[0].startsWith('text/html'))asset[1]=Buffer.from(bump(Buffer.from(asset[1],'base64').toString())).toString('base64');
assets['/release.json']=['application/json; charset=utf-8',Buffer.from(JSON.stringify({version:RELEASE_VERSION,stage:'alpha',updatedAt:new Date().toISOString()})).toString('base64')];writeFileSync(file,prefix+JSON.stringify(assets)+before.slice(end));
for(const path of [root+'/control-panel/public/index.html','/home/dunerealms/htdocs/clans.dunerealms.com/index.html','/home/dunerealms/apps/integrations/shared-header.php'])if(existsSync(path))writeFileSync(path,bump(readFileSync(path,'utf8')));
console.log('Alpha '+RELEASE_VERSION+' shared badge published; logo and runtime preserved');

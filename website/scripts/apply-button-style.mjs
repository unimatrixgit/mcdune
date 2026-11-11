// Surgical public-asset update. Never replaces application routes or database settings.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {BUTTON_CSS,BUTTON_SCRIPT} from './dune-buttons.mjs';
const release=process.argv[2];if(!release)throw Error('Release directory required');
const add=(html,local=false)=>{if(html.includes('/dune-actions.css'))return html;const base=local?'':'https://www.dunerealms.com';return html.replace('</head>','<link rel="stylesheet" href="'+base+'/dune-actions.css?v=1"><script src="'+base+'/dune-actions.js?v=1" defer></script></head>');};
mkdirSync(release+'/web',{recursive:true});writeFileSync(release+'/web/dune-actions.css',BUTTON_CSS);writeFileSync(release+'/web/dune-actions.js',BUTTON_SCRIPT);
const cp=release+'/control-panel/public/index.html';if(existsSync(cp))writeFileSync(cp,add(readFileSync(cp,'utf8')));
if(!process.argv.includes('--source-only')){
 const worker=release+'/dist/server/index.js',text=readFileSync(worker,'utf8'),prefix='const ASSET_DATA=',end=text.indexOf(';\n');if(!text.startsWith(prefix)||end<0)throw Error('Unrecognised public asset bundle');
 const assets=JSON.parse(text.slice(prefix.length,end));assets['/dune-actions.css']=['text/css; charset=utf-8',Buffer.from(BUTTON_CSS).toString('base64')];assets['/dune-actions.js']=['text/javascript; charset=utf-8',Buffer.from(BUTTON_SCRIPT).toString('base64')];
 for(const entry of Object.values(assets))if(entry[0].startsWith('text/html'))entry[1]=Buffer.from(add(Buffer.from(entry[1],'base64').toString())).toString('base64');
 writeFileSync(worker,prefix+JSON.stringify(assets)+text.slice(end));
}
const integrations=process.argv.find(arg=>arg.startsWith('--integrations='))?.slice(15);
if(integrations){
 for(const app of ['osticket','mybb']){const path=integrations+'/'+app;if(existsSync(path)){writeFileSync(path+'/dune-actions.css',BUTTON_CSS);writeFileSync(path+'/dune-actions.js',BUTTON_SCRIPT);}}
 const helper=integrations+'/shared-header.php';let php=readFileSync(helper,'utf8');if(!php.includes('/dune-actions.css'))php=php.replace("if(stripos($html,'<html')===false)return $html;","if(stripos($html,'<html')===false)return $html;\n if(!str_contains($html,'/dune-actions.css'))$html=str_ireplace('</head>','<link rel=\"stylesheet\" href=\"/dune-actions.css?v=1\"><script src=\"/dune-actions.js?v=1\" defer></script></head>',$html);");php=php.replace(/dune-ticket-compose\.(css|js)\?v=\d+/g,'dune-ticket-compose.$1?v=4');writeFileSync(helper,php);
}
const git=process.argv.find(arg=>arg.startsWith('--forgejo='))?.slice(10);if(git){const file=git+'/templates/custom/header.tmpl';let html=readFileSync(file,'utf8');if(!html.includes('/dune-actions.css'))html+='\n<link rel="stylesheet" href="https://www.dunerealms.com/dune-actions.css?v=1"><script src="https://www.dunerealms.com/dune-actions.js?v=1" defer></script>\n';writeFileSync(file,html);}
console.log('Public button assets updated; application and database code preserved');

import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {SHARED_HEADER,SHARED_HEAD} from './portal-navigation.mjs';
const release=process.argv[2],integrations=process.argv[3];
if(!release||!integrations)throw Error('Provide release and integration directories');
const cp=release+'/control-panel/public/index.html';let html=readFileSync(cp,'utf8');
html=html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/,SHARED_HEADER);
if(!html.includes('https://www.dunerealms.com/portal-navigation.js'))html=html.replace('</head>',SHARED_HEAD+'</head>');
writeFileSync(cp,html);
writeFileSync(integrations+'/shared-header.html',SHARED_HEADER);
writeFileSync(integrations+'/shared-header-head.html',SHARED_HEAD);
copyFileSync(release+'/integrations/common/shared-header.php',integrations+'/shared-header.php');
let server=readFileSync(release+'/control-panel/server.mjs','utf8');
server=server.replace("script-src 'self'; style-src 'self' https://fonts.googleapis.com;", "script-src 'self' https://www.dunerealms.com; style-src 'self' https://www.dunerealms.com https://fonts.googleapis.com;");
server=server.replace("img-src 'self' data:; frame-src", "img-src 'self' data: https://www.dunerealms.com; frame-src");
writeFileSync(release+'/control-panel/server.mjs',server);
console.log('Shared header installed in CP and native integration templates');



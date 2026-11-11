// Apply the DuneRealms palette to the native MIT-licensed LuckPermsWeb editor.
// Run against a clean checkout of the pinned upstream revision, then npm ci && npm run build.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]||'.');
export const revision='5e99c720b7c795c7af17cbfc2fd6829a23f19189';
if(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision)throw Error('Unexpected LuckPermsWeb revision');
const file=name=>resolve(root,name);
const config=JSON.parse(await readFile(file('config.json'),'utf8'));
config.base='/luckperms-editor/';config.selfHosted=true;
await writeFile(file('config.json'),JSON.stringify(config,null,2));
await writeFile(file('src/scss/variables.scss'),`$brand-color: #d5ab63;
$navy: #0e1c1a;
$grey: #213c30;
$red: #dc8571;
$bg-gradient: linear-gradient(0deg, #142a25, #142a25);
$bg-gradient-dark: linear-gradient(0deg, #0e211a, #0e211a);
`);
let app=await readFile(file('src/App.vue'),'utf8');
app=app.replace('<span>LuckPerms</span>','<span>LuckPerms · DuneRealms</span>').replace('background-color: #141422;','background-color: #142a25;');
await writeFile(file('src/App.vue'),app);
let index=await readFile(file('public/index.html'),'utf8');
index=index.replace(/\s*<script[\s\S]*?<\/script>/g,'').replace('<title>LuckPerms</title>','<title>LuckPerms · dunerealms.com</title>').replace('#94df03','#d5ab63');
await writeFile(file('public/index.html'),index);
await writeFile(file('public/dunerealms-theme.css'),`html{color-scheme:dark}#app{background:#142a25;color:#eee8d9}#nav{background:#12251f;border-bottom:1px solid #52664c;box-shadow:none!important}#nav .logo span{font-size:16px}#nav .logo img{height:26px}#app>footer{background:#12251f;border-top:1px solid #355045;box-shadow:none}button,input,select{border-radius:5px!important}a{color:#d5ab63}#editor-menu{background:#142a25!important;border-right:1px solid #355045}input{background:#0e211a!important;color:#eee8d9!important}input:focus{outline-color:#d5ab63}::-webkit-scrollbar-track{background:#0e1c1a}::-webkit-scrollbar-thumb{background:#52664c}`);
// A separate stylesheet loads after compiled upstream styles and keeps the theme reproducible.
index=await readFile(file('public/index.html'),'utf8');
await writeFile(file('public/index.html'),index.replace('</head>','<link rel="stylesheet" href="<%= BASE_URL %>dunerealms-theme.css"></head>'));
console.log('Prepared pinned native LuckPerms editor with the DuneRealms theme.');

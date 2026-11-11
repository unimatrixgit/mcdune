const newsEl=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const newsDate=n=>new Date(Number(n)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
async function newsFetch(path){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('Updates are temporarily unavailable. Please try again later.');return response.json();}
function newsCard(post,forum=false){const card=newsEl('article');card.className='dispatch-card';const image=newsEl('img');image.src=forum?'assets/nav-boards-full-v2.webp':'assets/nav-discord-full-v2.webp';image.alt='';image.loading='lazy';image.width=1672;image.height=941;const content=newsEl('div');content.className='dispatch-copy';content.append(newsEl('span',forum?'COMMUNITY':post.label),newsEl('small',newsDate(forum?post.last_activity_at:post.published_at)));const title=newsEl('h3'),link=newsEl('a',post.title);link.title=post.title;link.href=forum?post.url:'news-archive.html?post='+post.id;title.append(link);content.append(title,newsEl('p',forum?post.excerpt:post.body.split(/\n\s*\n/)[0]));const more=newsEl('a',forum?'Read discussion →':'Read more →');more.className='dispatch-read-more';more.href=link.href;content.append(more);card.append(image,content);return card;}
function newsModule(root,kind){let page=1,generation=0;const archive=root.dataset.archive==='true',grid=newsEl('div');grid.className='dispatch-grid';grid.setAttribute('aria-live','polite');const controls=newsEl('nav');controls.className='dispatch-pagination';controls.setAttribute('aria-label',kind==='forum'?'Latest forum posts pages':'News pages');const prev=newsEl('button','← Previous'),state=newsEl('span'),next=newsEl('button','Next →');prev.type=next.type='button';controls.append(prev,state,next);root.append(grid,controls);
 async function load(){const token=++generation;prev.disabled=next.disabled=true;state.textContent='Loading…';try{const data=await newsFetch(kind==='forum'?'/api/home/forum?page='+page:'/api/news?'+new URLSearchParams({page,surface:archive?'archive':'home'}));if(token!==generation)return;root.querySelector('[data-server-news]')?.remove();grid.replaceChildren();for(const post of data.posts)grid.append(newsCard(post,kind==='forum'));if(!data.posts.length)grid.append(newsEl('p',kind==='forum'?'No public discussions yet. Start one in the forums.':'No published news yet. Updates will appear here when released.'));state.textContent='Page '+page+' of '+Math.max(1,data.pages);prev.disabled=page<=1;next.disabled=page>=data.pages;}catch(error){if(token===generation){grid.replaceChildren(newsEl('p',error.message));state.textContent='Unavailable';}}}
 prev.onclick=()=>{page--;load();};next.onclick=()=>{page++;load();};root.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;if(event.key==='ArrowLeft'&&!prev.disabled){event.preventDefault();prev.click();}if(event.key==='ArrowRight'&&!next.disabled){event.preventDefault();next.click();}});load();
}
for(const root of document.querySelectorAll('[data-news-module]'))newsModule(root,root.dataset.newsModule);
const fullPost=document.getElementById('news-full-post'),postId=new URLSearchParams(location.search).get('post');
function formatNewsBody(root,value){
 let paragraph=[],list=null;
 const flush=()=>{if(paragraph.length){root.append(newsEl('p',paragraph.join(' ')));paragraph=[];}list=null;};
 const lines=String(value).replace(/\r/g,'').split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line){flush();continue;}
  const bullet=line.match(/^(?:[•*-]|\d+[.)])\s+(.+)$/);
  if(bullet){if(paragraph.length)flush();if(!list){list=newsEl('ul');root.append(list);}list.append(newsEl('li',bullet[1]));continue;}
  const heading=line.match(/^#{1,4}\s+(.+)$/),next=lines.slice(i+1).find(x=>x.trim());
  if(heading||(!paragraph.length&&line.length<80&&/^[•*-]\s/.test(next?.trim()||''))){flush();root.append(newsEl('h3',heading?heading[1]:line));continue;}
  if(list)flush();paragraph.push(line);
 }
 flush();
}
if(fullPost&&postId){
 document.body.classList.add('news-article-page');const archive=document.getElementById('archive-news');if(archive)archive.hidden=true;fullPost.hidden=false;
 newsFetch('/api/news/'+encodeURIComponent(postId)).then(({post})=>{
  fullPost.replaceChildren();document.title=post.title+' · dunerealms.com';
  const back=newsEl('a','← News archive');back.href='news-archive.html';back.className='article-back';
  const head=newsEl('div');head.className='article-heading';const copy=newsEl('div');
  const category=newsEl('span',post.label);category.className='article-category';const date=newsEl('time',newsDate(post.published_at));date.dateTime=new Date(Number(post.published_at)).toISOString();
  const meta=newsEl('div');meta.className='article-meta';meta.append(category,date);meta.append(newsEl('span','Written by '+(post.author_name||'DuneRealms')));copy.append(meta,newsEl('h1',post.title));
  const image=newsEl('img');const artKeys=['world','news','maintenance','changelogs','events','community'];image.src='assets/news-'+(artKeys.includes(post.category_key||post.category)?(post.category_key||post.category):'news')+'.webp';image.alt='Imperial dispatch artwork';image.width=360;image.height=240;head.append(copy,image);
  const body=newsEl('div');body.className='dispatch-full-body';formatNewsBody(body,post.body);
  const foot=newsEl('div');foot.className='article-actions';const all=newsEl('a','Browse all news →');all.href='news-archive.html';all.className='dispatch-read-more';foot.append(all);if(post.forum_url){const forum=newsEl('a','Go to forum post →');forum.href=post.forum_url;forum.className='dispatch-read-more';foot.append(forum);}
  fullPost.append(back,head,body,foot);
 }).catch(error=>fullPost.replaceChildren(newsEl('p',error.message)));
}
const banRoot=document.getElementById('portal-ban-cards');
if(banRoot)newsFetch('/api/public/bans').then(({bans})=>{
 banRoot.replaceChildren();
 for(const ban of bans){
  const card=newsEl('article');card.className='dispatch-card ban-card';
  const art=newsEl('div');art.className='ban-stockade';art.setAttribute('aria-label','Minecraft style player behind a wooden stockade');const head=newsEl('span');head.className='ban-demo-head';art.append(head,newsEl('span',ban.demo?'DEMONSTRATION RECORD':'MODERATION RECORD'));
  const body=newsEl('div');body.className='dispatch-copy';body.append(newsEl('span',ban.demo?'PREVIEW · NO PLAYER BANNED':'LATEST BAN'),(()=>{const h=newsEl('h3'),a=newsEl('a',ban.player_name);a.href='https://cp.dunerealms.com/?banId='+encodeURIComponent(ban.id)+'#bans';h.append(a);return h;})());
  const fields=newsEl('dl');for(const [label,value]of [['Reason',ban.reason],['Issued by',ban.banned_by],['Scope',ban.scope],['Duration',ban.expires_text],['Ban ID',ban.id]])fields.append(newsEl('dt',label),newsEl('dd',value));body.append(fields);
  if(ban.demo){const button=newsEl('button','Preview appeal details');button.className='dispatch-read-more';const details=newsEl('div');details.hidden=true;details.className='ban-preview';details.append(newsEl('strong','Appeal preview'),newsEl('p','This demonstration record previews the information attached to an appeal. It does not ban a player or create a support ticket.'),newsEl('p','Reference: '+ban.id));button.onclick=()=>{details.hidden=!details.hidden;button.setAttribute('aria-expanded',String(!details.hidden));};button.setAttribute('aria-expanded','false');body.append(button,details);}else{const appeal=newsEl('a','Appeal ban →');appeal.className='dispatch-read-more';appeal.href='https://support.dunerealms.com/appeal.php?ban_id='+encodeURIComponent(ban.id);body.append(appeal);}
  card.append(art,body);banRoot.append(card);
 }
 if(!bans.length)banRoot.append(newsEl('p','No current ban records to display.'));
}).catch(()=>banRoot.replaceChildren(newsEl('p','Ban records are temporarily unavailable.')));

const appealRoot=document.getElementById('portal-appeal-cards');
if(appealRoot){let sequence=0;async function loadAppeals(page=1){const serial=++sequence;try{const data=await newsFetch('/api/public/appeals?page='+page);if(serial!==sequence)return;appealRoot.replaceChildren();for(const b of data.bans){const card=newsEl('article');card.className='dispatch-card ban-card';const art=newsEl('div');art.className='ban-stockade';const head=newsEl('span');head.className='ban-demo-head';art.append(head);const seal=newsEl('strong',b.appealStatus.toUpperCase());seal.className='appeal-seal '+b.appealStatus;art.append(seal);const body=newsEl('div');body.className='dispatch-copy';body.append(newsEl('h3',b.player));const fields=newsEl('dl');for(const [k,v] of [['Status',b.status],['Reason',b.reason],['Issued by',b.issuedBy],['Scope',b.scope],['Duration',b.expires||'Permanent'],['Ban ID',b.id]])fields.append(newsEl('dt',k),newsEl('dd',v));body.append(fields);card.append(art,body);appealRoot.append(card);}if(!data.bans.length)appealRoot.append(newsEl('p','No appeal decisions to display.'));const pager=document.getElementById('appeal-pagination');pager.replaceChildren();const prev=newsEl('button','Previous'),next=newsEl('button','Next');prev.type=next.type='button';prev.disabled=data.page<=1;next.disabled=data.page>=data.pages;prev.onclick=()=>loadAppeals(data.page-1);next.onclick=()=>loadAppeals(data.page+1);const label=newsEl('span','Page '+data.page+' of '+data.pages);label.setAttribute('role','status');pager.append(prev,label,next);}catch{if(serial===sequence)appealRoot.replaceChildren(newsEl('p','Appeal decisions are temporarily unavailable.'));}}loadAppeals();}

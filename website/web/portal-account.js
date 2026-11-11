(()=>{
 const cp=location.hostname==='cp.dunerealms.com';
 if(!cp&&!['/','/index.html'].includes(location.pathname))return;
 let user=null,revision=0,mailRevision=0,mailBusy=false,mailState=null;
 const site='https://www.dunerealms.com';
 function render(){
  const panel=document.querySelector('.dune-page-marker'),worlds=panel?.querySelector('.world-status');
  if(!panel||!worlds)return;
  const side=cp?document.querySelector('.cp-panel-frame:not([hidden])>.cp-panel-sidebar'):null;
  const sideReady=side&&['user','staff'].includes(side.parentElement.dataset.panel);
  const old=document.querySelector('.portal-account-card');
  if(cp&&!sideReady){old?.remove();return;}
  if(old?.dataset.identity===(user||''))return;
  old?.remove();panel.querySelector('.portal-welcome-card')?.remove();
  if(cp&&!user){panel.classList.remove('portal-account-welcome');return;}
  if(!cp)panel.classList.add('portal-account-welcome');
  const box=document.createElement('aside');box.className='portal-account-card';box.dataset.identity=user||'';box.setAttribute('aria-label',user?'Your Imperial Postbox':'Your DuneRealms account');
  const art=document.createElement('img');art.src=site+(user?'/assets/imperial-postbox-v1.png':'/assets/nav-account-full-v2.webp');art.alt=user?'Emerald and gold Minecraft imperial postbox with sealed letters':'';art.width=user?200:80;art.height=user?300:80;if(user)art.className='imperial-postbox-art';
  const heading=document.createElement('h2');heading.textContent=user?'Imperial Postbox':'Join the caravan';
  const text=document.createElement('p');text.textContent=user?'Your private correspondence.':'Create your account and begin your DuneRealms journey.';
  const actions=document.createElement('div');
  const links=user?[['Open Internal Mail','https://cp.dunerealms.com/#shared-inbox']]:[['Register','https://cp.dunerealms.com/?mode=register'],['Login','https://cp.dunerealms.com/']];
  for(const[label,url]of links){const a=document.createElement('a');a.textContent=label;a.href=url;actions.append(a);}
  box.append(art,heading,text,actions);
  if(user&&document.querySelector('.dune-release-badge')?.textContent.match(/\d+(?:\.\d+){3}/)?.[0]==='1.0.0.4'){const ribbon=document.createElement('span');ribbon.className='postbox-new-ribbon';ribbon.textContent='NEW';ribbon.setAttribute('aria-label','New this release');box.append(ribbon);}
  if(user){const status=document.createElement('p');status.className='postbox-status';status.setAttribute('role','status');status.textContent=mailLabel();box.append(status);}
  if(user&&!cp){
   const welcome=document.createElement('aside');welcome.className='portal-welcome-card';welcome.setAttribute('aria-label','Your DuneRealms account');
   const portrait=document.createElement('img');portrait.src=site+'/assets/nav-account-full-v2.webp';portrait.alt='';portrait.width=portrait.height=80;
   const title=document.createElement('h2');title.textContent='Welcome, '+user;
   const copy=document.createElement('p');copy.textContent='Your place in the imperial ledger.';
   const account=document.createElement('a');account.href='https://cp.dunerealms.com/';account.textContent='Account centre';
   welcome.append(portrait,title,copy,account);panel.insertBefore(welcome,worlds);
  }
  if(cp){box.classList.add('cp-sidebar-postbox');side.insertBefore(box,side.querySelector('.cp-panel-category'));panel.classList.remove('portal-account-welcome');panel.querySelector('.portal-welcome-card')?.remove();}else panel.insertBefore(box,worlds);
 }
 new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
 function mailLabel(){return !cp?'Open your inbox to view unread mail.':mailState===null?'Checking unread mail…':mailState==='unavailable'?'Unread count temporarily unavailable.':mailState===0?'Your inbox is up to date.':mailState+' unread '+(mailState===1?'message':'messages');}
 function paintMail(){const box=document.querySelector('.portal-account-card');if(box?.dataset.identity!==user)return;const status=box.querySelector('.postbox-status');if(status)status.textContent=mailLabel();box?.classList.toggle('has-unread-mail',Number(mailState)>0);}
 async function refreshMail(){if(!cp||!user||mailBusy||document.hidden)return;const who=user,current=mailRevision;mailBusy=true;try{const r=await fetch('/api/internal-mail/summary',{credentials:'same-origin',cache:'no-store'}),d=r.ok?await r.json():null;if(current!==mailRevision||user!==who)return;mailState=Number.isSafeInteger(d?.unreadCount)&&d.unreadCount>=0?d.unreadCount:'unavailable';paintMail();}catch{if(current===mailRevision&&user===who){mailState='unavailable';paintMail();}}finally{mailBusy=false;}}
 function setUser(next){if(next!==user){mailRevision++;mailState=null;}user=next;render();paintMail();void refreshMail();}
 async function refresh(){const current=++revision;try{const r=await fetch('https://cp.dunerealms.com/api/welcome',{credentials:'include',cache:'no-store'});const d=r.ok?await r.json():null;if(current===revision){setUser(typeof d?.username==='string'?d.username:null);}}catch{if(current===revision){setUser(null);}}}
 window.addEventListener('dune:session',event=>{revision++;setUser(event.detail?.username||null);});
 window.addEventListener('pageshow',refresh);window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('dune:mail-changed',refreshMail);if(cp)setInterval(()=>{void refreshMail();},60000);
 render();refresh();
})();

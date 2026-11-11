import {electionDates} from './election-rules.mjs';
import {paintMenuRibbons, MENU_RELEASE} from './menu-ribbons.mjs';
import './pages.mjs';
import './embed-size.mjs';
import {menuGroupsFor,menuItemFor,hasStaffPanel,hasDevPanel,splitMenuGroups,DEV_ITEMS,factionMenuItem,REALM_GROUPS} from './panel-layout.mjs';
const dashboard=document.getElementById('dashboard');
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const asset=file=>(file==='imperial-postbank-v2.png'?'https://cp.dunerealms.com/assets/':'https://www.dunerealms.com/assets/')+file;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
if(dashboard&&!embedded){
 document.body.classList.add('cp-centers-ready','cp-panels-ready');
 let user=null,signature='',queued=false,sessionGeneration=0,factionContext=null;
 async function loadFaction(){const generation=sessionGeneration;factionContext=null;signature='';if(!user?.permissions?.includes('web.menu.game'))return;try{const response=await fetch('/api/politics/preview',{cache:'no-store'});const value=response.ok?await response.json():null;if(generation!==sessionGeneration)return;factionContext=value;signature='';schedule();}catch{if(generation===sessionGeneration){factionContext=null;signature='';schedule();}}}
 const centers=el('nav');centers.className='cp-center-nav';centers.setAttribute('aria-label','Control panel portals');
 const frame=el('div');frame.className='cp-panel-frame';const sidebar=el('nav');sidebar.className='cp-panel-sidebar';sidebar.setAttribute('aria-label','Left panel tools');const rightSidebar=el('nav');rightSidebar.className='cp-panel-sidebar cp-panel-sidebar-right';rightSidebar.setAttribute('aria-label','Right panel tools');
 const breadcrumb=el('p');breadcrumb.className='cp-center-breadcrumb';dashboard.before(centers,breadcrumb,frame);frame.append(sidebar,dashboard,rightSidebar);frame.hidden=centers.hidden=breadcrumb.hidden=true;
 const art=(parent,file,size=34)=>{const image=el('img');image.src=asset(file);image.alt='';image.width=image.height=size;image.className='cp-section-art';parent.prepend(image);return image;};
 function navigate(page){const url=new URL(location.href);url.hash=page;url.searchParams.delete('staff-area');url.searchParams.delete('center');history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));}
 const panelButton=(label,page,image)=>{const b=el('button',label);b.type='button';b.onclick=()=>navigate(page);art(b,image);centers.append(b);return b;};
 const userButton=panelButton('User Panel','user-home','nav-account-v2.webp');
 const staffButton=panelButton('Staff Panel','staff-panel','nav-staff-v2.webp');
 const devLink=panelButton('Dev Panel','dev-panel','seals/team-dev-150.png');devLink.className='cp-dev-link';
 const realmButton=panelButton('Realm & Politics','realm-panel','seals/office-landsraad.png');
 const realmTabs=el('nav');realmTabs.className='cp-realm-tabs cp-context-links';realmTabs.setAttribute('aria-label','Realm and Politics tabs');frame.before(realmTabs);
 const realmHome=el('section');realmHome.id='realm-panel';realmHome.className='cp-layout-home';realmHome.hidden=true;dashboard.append(realmHome);
 const framePages=[];
 function framePage(id,title,node,url){const section=el('section');section.id=id;section.hidden=true;section.className='cp-native-management';section.append(el('h2',title));const frame=el('iframe');frame.title=title;frame.loading='lazy';frame.referrerPolicy='same-origin';section.append(frame);dashboard.append(section);framePages.push({section,frame,node,url});}
 framePage('support-management','osTicket management','web.tickets.admin','https://support.dunerealms.com/dune-sso.php?staff=1&admin=1');
 for(const item of DEV_ITEMS)framePage(item.page,item.label,null,'https://support.dunerealms.com/dev-tasks.php?view='+item.view);
 function placeholder(id,title,copy){if(document.getElementById(id))return;const section=el('section');section.id=id;section.hidden=true;section.className='cp-layout-placeholder';section.append(el('p','COMING TO THE REALMS'),el('h2',title),el('p',copy),el('p','Placeholder · no actions are available yet.'));dashboard.append(section);}
 placeholder('discord-link','Discord linking','Secure Discord account linking will be available here. This placeholder does not connect an account or change Discord roles.');

 placeholder('hosting-control','Hosting control','Your future hosting workspace. No servers are provisioned from this page.');
 // Move original nodes, never clone forms or their listeners/CSRF fields.
 const oldStaff=document.getElementById('staff');
 if(oldStaff&&!document.getElementById('user-management')){
  const heading=[...oldStaff.querySelectorAll('h2')].find(h=>h.textContent==='Website accounts');
  if(heading){const section=el('section');section.id='user-management';section.hidden=true;section.className='cp-layout-tool';heading.textContent='User management';for(let n=heading;n;){const next=n.nextSibling;section.append(n);n=next;}dashboard.append(section);}
 }
 if(oldStaff&&!document.getElementById('community-goals')){
  const stop=[...oldStaff.querySelectorAll('h2')].find(h=>h.textContent==='Server operations');
  if(stop&&oldStaff.querySelector('#campaign-form')){const section=el('section');section.id='community-goals';section.hidden=true;section.className='cp-layout-tool';while(oldStaff.firstChild&&oldStaff.firstChild!==stop)section.append(oldStaff.firstChild);const title=section.querySelector('h2');if(title)title.textContent='Community goals';dashboard.append(section);}
 }
 const staffHome=el('section');staffHome.id='staff-panel';staffHome.hidden=true;staffHome.className='cp-layout-home';const staffHero=el('header');staffHero.className='cp-panel-hero';const staffText=el('div');staffText.append(el('p','THE IMPERIAL STAFF BUREAU'),el('h2','Staff Panel'),el('p','Your authorised website, network and community tools in one place.'));art(staffHero,'seals/department-network-staff-150.png',112);staffHero.append(staffText);const staffSummary=el('div');staffSummary.className='cp-panel-summary';staffHome.append(staffHero,staffSummary);dashboard.append(staffHome);
 const userHome=document.getElementById('user-home');const userSummary=el('div');userSummary.className='cp-panel-summary';userHome?.append(userSummary);
 const preserved=el('div');preserved.className='cp-context-links';userHome?.append(preserved);
 const reference=el('div');reference.className='cp-context-links';staffHome.append(reference);
 function linkFor(item){item=factionMenuItem(item,factionContext);const a=el('a');a.href=item.url||'#'+item.page;const label=el('span',item.label);a.append(label);art(a,item.art);if(item.placeholder){const note=el('small','Placeholder');a.append(note);}return a;}
 function groupCards(host,groups){host.replaceChildren();for(const[label,items]of groups){const card=el('section');card.className='cp-panel-card';card.append(el('h3',label));for(const item of items)card.append(linkFor(item));host.append(card);}}
 function related(id,items){const section=document.getElementById(id);if(!section)return;const allowed=items.filter(([, ,node])=>user.permissions.includes(node));const key=JSON.stringify(allowed);const old=section.querySelector(':scope>.cp-context-links');const hero=section.querySelector(':scope>.cp-user-page-hero');if(old?.dataset.signature===key){if(hero&&old.previousElementSibling!==hero)hero.after(old);return;}old?.remove();const nav=el('nav');nav.dataset.signature=key;nav.className='cp-context-links';nav.setAttribute('aria-label','Related account tools');for(const[label,page]of allowed){const a=el('a',label);a.href='#'+page;art(a,page==='discord-link'?'nav-discord-v2.webp':page==='luckperms'||page==='game-permissions'?'nav-clan-v2.webp':'nav-account-v2.webp');if(page===id)a.setAttribute('aria-current','page');nav.append(a);}if(hero)hero.after(nav);else section.prepend(nav);}
 async function fillElectionStatistics(card){
  const generation=sessionGeneration;
  card.replaceChildren(el('h3','Live election statistics'),el('p','Loading current chambers…'));
  const results=await Promise.allSettled(['house','imperial'].map(async kind=>{
   const response=await fetch('/api/politics/ballot/'+kind,{cache:'no-store'});
   if(!response.ok)throw Error('Chamber unavailable');return response.json();
  }));
  if(generation!==sessionGeneration||!card.isConnected)return;
  card.replaceChildren(el('h3','Live election statistics'));
  for(let i=0;i<results.length;i++){
   const title=i===0?'House':'Emperor',result=results[i];
   if(result.status!=='fulfilled'){card.append(el('p',title+': unavailable. Open the chamber to check your eligibility.'));continue;}
   const data=result.value,total=data.candidates.reduce((n,c)=>n+Number(c.votes),0);
   const line=el('p');line.append(el('strong',title+': '+data.candidates.length+' candidate(s)'));
   line.append(el('span',' · '+total+' votes'+(data.round?' in round '+(data.round.number+1):' · applications open')));card.append(line);
  }
  const refresh=el('button','Refresh standings');refresh.type='button';refresh.onclick=()=>fillElectionStatistics(card);card.append(refresh);
 }
 function paint(){
  frame.hidden=centers.hidden=breadcrumb.hidden=!user;realmTabs.hidden=true;if(!user){signature='';sidebar.replaceChildren();rightSidebar.replaceChildren();for(const p of framePages){p.section.hidden=true;p.frame.removeAttribute('src');}return;}
  for(const id of ['staff-panel','discord-link','landsraad','hosting-control','user-management','community-goals']){const section=document.getElementById(id);if(section)section.hidden=false;}
  staffButton.hidden=!hasStaffPanel(user);devLink.hidden=!hasDevPanel(user);
  const active=dashboard.querySelector(':scope>section.cp-page-active')?.id||'user-home';
  for(const p of framePages){const allowed=p.node?user.permissions.includes(p.node):hasDevPanel(user);p.section.hidden=!allowed;if(!allowed)p.frame.removeAttribute('src');else if(active===p.section.id&&!p.frame.getAttribute('src'))p.frame.src=p.url;}
  const userGroups=menuGroupsFor(user,'user'),staffGroups=menuGroupsFor(user,'staff');
  const staffPages=new Set(staffGroups.flatMap(([,items])=>items.flatMap(i=>[i.page,...(i.aliases||[])])));
  const realmGroups=menuGroupsFor(user,'realm');realmButton.hidden=!realmGroups.length;realmHome.hidden=!realmGroups.length;
  const realmActive=active==='realm-panel'||REALM_GROUPS.flatMap(([,items])=>items).some(i=>i.page===active||i.aliases?.includes(active));
  const panel=realmActive?'realm':DEV_ITEMS.some(i=>i.page===active)?'dev':active==='staff-panel'||staffPages.has(active)||['staff','website-staff-home','staff-home','game-staff-home','network-staff-home','staff-manual'].includes(active)?'staff':'user';
  userButton.setAttribute('aria-pressed',String(panel==='user'));staffButton.setAttribute('aria-pressed',String(panel==='staff'));devLink.setAttribute('aria-pressed',String(panel==='dev'));
  realmButton.setAttribute('aria-pressed',String(panel==='realm'));realmTabs.hidden=true;
  const groups=panel==='realm'?realmGroups:panel==='dev'?[['Dev Center',DEV_ITEMS]]:panel==='staff'?staffGroups:userGroups;
  const officeLink=dashboard.querySelector('nav a[href="#imperial-atelier"]');const officeEligible=!!officeLink&&user.permissions.includes('web.menu.game');
  const next=JSON.stringify([user.username,panel,officeEligible,groups.map(([label,items])=>[label,items.map(i=>i.page||i.url)]),user.permissions]);
  if(next!==signature){
   signature=next;frame.dataset.panel=panel;
   realmTabs.replaceChildren();const overview=linkFor({page:'realm-panel',label:'Overview',art:'seals/office-landsraad.png'});realmTabs.append(overview);for(const[,items]of realmGroups)for(const item of items)realmTabs.append(linkFor(item));
   realmHome.replaceChildren();const hero=el('header');hero.className='cp-panel-hero';art(hero,'seals/office-landsraad.png',112);const intro=el('div');intro.append(el('p','THE IMPERIAL ASSEMBLY'),el('h2','Realm & Politics'),el('p','Your House, the throne and the next chapter of the realm.'));hero.append(intro);realmHome.append(hero);const stats=el('div');stats.className='cp-panel-summary';
   const house=factionMenuItem({page:'formal-council',label:'Not verified'},factionContext).label.replace(/ Council$/,'');
   const date=kind=>new Date(electionDates(kind)[0]).toLocaleString('en-GB',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' GMT';
   for(const[title,value,copy]of [['Your House',house,'Verified from your linked game account.'],['Next House election',date('house'),'Two-week terms · voting 09:00–12:00 GMT'],['Next Emperor election',date('imperial'),'Four-week terms · voting 15:00–18:00 GMT'],['Live election statistics','Loading…','Current chamber totals.']]){const card=el('section');card.className='cp-panel-card';card.append(el('h3',title),el('strong',value),el('p',copy));stats.append(card);if(title==='Live election statistics')queueMicrotask(()=>fillElectionStatistics(card));}realmHome.append(stats);
   sidebar.replaceChildren();rightSidebar.replaceChildren();const home=el('a',panel==='realm'?'Realm & Politics overview':panel==='dev'?'Dev Panel overview':panel==='staff'?'Staff Panel overview':'User Panel overview');home.className='cp-panel-overview-link';home.href=panel==='realm'?'#realm-panel':panel==='dev'?'#dev-panel':panel==='staff'?'#staff-panel':'#user-home';sidebar.append(home);
   const halves=panel==='realm'?[groups.filter(([label])=>label!=='Imperial Postbank'),groups.filter(([label])=>label==='Imperial Postbank')]:panel==='dev'?[groups,[]]:splitMenuGroups(groups);rightSidebar.hidden=!halves[1].length;for(const[side,sections]of [[sidebar,halves[0]],[rightSidebar,halves[1]]])for(const[label,items]of sections){const h=el('h3',label);h.className='cp-panel-category';if(label==='Imperial Postbank'){h.classList.add('cp-bank-category');art(h,'imperial-postbank-v2.png',150);}side.append(h);for(const item of items){const a=linkFor(item);a.dataset.panelPage=item.page||'';side.append(a);}}
   paintMenuRibbons(frame, document.querySelector('.dune-release-badge')?.textContent.match(/\d+(?:\.\d+){3}/)?.[0] || MENU_RELEASE);
   groupCards(userSummary,userGroups);groupCards(staffSummary,staffGroups);
   preserved.replaceChildren();if(user.permissions.includes('web.menu.game')){const a=el('a','Clan Center');a.href='https://clans.dunerealms.com/';preserved.append(a);}if(officeEligible){const a=el('a','Imperial Atelier · current office');a.href='#imperial-atelier';preserved.append(a);}
   reference.replaceChildren();if(user.permissions.includes('web.menu.staffmanual')){const a=el('a','Staff guide');a.href='#staff-manual';reference.append(a);}if(user.permissions.includes('web.ranks.manage')){const a=el('a','Linked in-game ranks');a.href='#game-permissions';reference.append(a);}
  }
  for(const a of frame.querySelectorAll('.cp-panel-sidebar a')){const selected=a.hash==='#'+active||menuItemFor(active)?.page===a.dataset.panelPage;if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  for(const a of realmTabs.querySelectorAll('a')){if(a.hash==='#'+active||menuItemFor(active)?.page===a.hash.slice(1))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  const current=factionMenuItem(DEV_ITEMS.find(i=>i.page===active)||menuItemFor(active),factionContext);breadcrumb.textContent=(panel==='realm'?'Realm & Politics':panel==='dev'?'Dev Panel':panel==='staff'?'Staff Panel':'User Panel')+' / '+(current?.label||(active==='staff-panel'||active==='user-home'?'Overview':dashboard.querySelector(':scope>section.cp-page-active h2')?.textContent||'Overview'));
  related('site-profile',[['Profile & biography','site-profile','web.menu.security'],['Security & email','security','web.menu.security'],['Discord linking','discord-link','web.menu.security']]);related('security',[['Profile & biography','site-profile','web.menu.security'],['Security & email','security','web.menu.security'],['Discord linking','discord-link','web.menu.security']]);
  related('discord-link',[['Profile & biography','site-profile','web.menu.security'],['Security & email','security','web.menu.security'],['Discord linking','discord-link','web.menu.security']]);
  related('luckperms',[['LuckPerms','luckperms','web.menu.luckperms'],['Linked in-game ranks','game-permissions','web.ranks.manage']]);related('game-permissions',[['LuckPerms','luckperms','web.menu.luckperms'],['Linked in-game ranks','game-permissions','web.ranks.manage']]);
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;paint();});}
 for(const side of [sidebar,rightSidebar])side.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(!a)return;event.preventDefault();navigate(a.hash.slice(1));});
 window.addEventListener('dune:session',event=>{sessionGeneration++;user=event.detail;factionContext=null;signature='';schedule();loadFaction();});for(const name of ['dune:page','hashchange','popstate'])window.addEventListener(name,schedule);
 window.addEventListener('dune:game-link-changed',()=>{sessionGeneration++;loadFaction();schedule();});
 new MutationObserver(schedule).observe(dashboard,{childList:true,subtree:true});
 const initialGeneration=sessionGeneration;try{const response=await fetch('/api/auth/session',{cache:'no-store'});if(response.ok){const data=await response.json();if(initialGeneration===sessionGeneration){user=data.user;loadFaction();if(user&&!location.hash)navigate('user-home');paint();}}}catch{if(initialGeneration===sessionGeneration)paint();}
}

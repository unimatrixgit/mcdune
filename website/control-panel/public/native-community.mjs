const dashboard=document.getElementById('dashboard'),nav=dashboard?.querySelector('nav');
function create(id,title,node,url){
 const section=document.createElement('section');section.id=id;section.hidden=true;section.className='native-community';
 const heading=document.createElement('h2');heading.textContent=title;const links=document.createElement('p'),open=document.createElement('a');open.href=url;open.target='_blank';open.rel='noopener';open.textContent='Open '+title+' separately';links.append(open);
 const frame=document.createElement('iframe');frame.title=title;frame.loading='lazy';section.append(heading,links,frame);
 const link=document.createElement('a');link.href='#'+id;link.textContent=title;link.hidden=true;nav.append(link);dashboard.append(section);
 return{section,links,frame,link,node,url};
}
if(dashboard&&nav){
 const pages=[create('tickets','Support tickets','web.menu.tickets','https://support.dunerealms.com/dune-sso.php'),create('forum-admin','Forum moderation','web.menu.forum','https://forums.dunerealms.com/dune-sso.php'),create('staff-tickets','Staff ticket desk','web.tickets.staff','https://support.dunerealms.com/dune-sso.php?staff=1')];
 function loadActive(){for(const page of pages)if(page.allowed&&location.hash==='#'+page.section.id&&!page.frame.getAttribute('src'))page.frame.src=page.url;}
 let revision=0;
 function session(user){
  for(const page of pages){const allowed=!!user?.permissions?.includes(page.node);page.allowed=allowed;page.link.hidden=!allowed;page.section.hidden=!allowed;if(!allowed)page.frame.removeAttribute('src');}
  loadActive();
 }
 window.addEventListener('dune:session',event=>{revision++;session(event.detail);});
 window.addEventListener('dune:page',loadActive);window.addEventListener('hashchange',loadActive);
 const initial=revision;fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(initial===revision)session(data?.authenticated?data.user:null);}).catch(()=>{if(initial===revision)session(null);});
}

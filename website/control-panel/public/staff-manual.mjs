const dashboard=document.getElementById('dashboard'),nav=dashboard?.querySelector('nav');
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
if(dashboard&&nav){
 const section=el('section');section.id='staff-manual';section.hidden=true;
 const tab=el('a','Staff manual');tab.href='#staff-manual';tab.hidden=true;nav.append(tab);
 section.append(el('h2','Staff manual'),el('p','Browse by feature. Each guide lists its permissions and clearly marks work that is still awaiting integration or deployment.'));
 const searchLabel=el('label','Find a feature or permission'),search=el('input');search.type='search';search.placeholder='CoreProtect, chat, inventory…';searchLabel.append(search);section.append(searchLabel);
 const notice=el('p');notice.setAttribute('role','status');const content=el('div');section.append(notice,content);dashboard.append(section);
 let categories=[],generation=0;
 function render(){content.replaceChildren();const term=search.value.trim().toLowerCase();const matches=categories.filter(c=>[c.title,c.module,...c.nodes,...c.steps,...c.checks].join(' ').toLowerCase().includes(term));notice.textContent=matches.length+' feature guides';for(const c of matches){const details=el('details'),summary=el('summary',c.title);details.open=!!term;details.append(summary,el('p',c.module+' · '+c.status));const steps=el('ol');for(const step of c.steps)steps.append(el('li',step));details.append(steps,el('h3','Permission nodes'));if(c.nodes.length){const list=el('ul');for(const name of c.nodes){const item=el('li');item.append(el('code',name));list.append(item);}details.append(list);}else details.append(el('p','No new permission nodes are active for this integration yet.'));details.append(el('h3','Checks & limitations'));const checks=el('ul');for(const check of c.checks)checks.append(el('li',check));details.append(checks);content.append(details);}}
 search.addEventListener('input',render);
 async function session(user){const token=++generation,allowed=user?.permissions?.includes('web.menu.staffmanual');tab.hidden=!allowed;section.hidden=!allowed;categories=[];content.replaceChildren();if(!allowed)return;notice.textContent='Loading feature guides…';try{const response=await fetch('/api/staff/manual',{cache:'no-store'});if(token!==generation)return;if(!response.ok)throw Error(response.status===403?'You no longer have permission to read the staff manual.':'Staff manual is unavailable.');const data=await response.json();if(token!==generation)return;categories=data.categories;render();}catch(error){if(token===generation)notice.textContent=error.message;}}
 window.addEventListener('dune:session',event=>session(event.detail));
 const response=await fetch('/api/auth/session',{cache:'no-store'});if(response.ok){const data=await response.json();await session(data.user);}
}

import {itemIcon} from './inventory/inventory-view.mjs';
const dashboard=document.getElementById('dashboard'),nav=dashboard?.querySelector('nav');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const money=value=>new Intl.NumberFormat(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
const words=value=>String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const planet=value=>({arrakis:'Arrakduin',caladan:'Kaladam',giedi_prime:'Giedermark',kaitain:'Kaiterhof',sigma_draconis_iv:'Sigmadraken IV',lobby:'Vaerkring'}[value]||words(value));
if(dashboard&&nav){
 const style=el('link');style.rel='stylesheet';style.href='/exchange.css';document.head.append(style);
 const section=el('section',undefined,'exchange-desk');section.id='exchange';section.hidden=true;
 const hero=el('header',undefined,'exchange-hero'),art=el('div',undefined,'exchange-art exchange-art-market');art.setAttribute('aria-hidden','true');
 const intro=el('div');intro.append(el('p','THE IMPERIAL TRADE DESK','exchange-eyebrow'),el('h2','Exchange'),el('p','Goods from across the realms. Browse live player offers, then trade securely in game.'));
 const guide=el('div',undefined,'exchange-guide');guide.append(el('strong','Sell from your inventory'),el('p','Player menu → Item Exchange → Add Items / Sell'),el('code','/exchange'));hero.append(art,intro,guide);
 const tabs=el('div',undefined,'exchange-view-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Exchange listings');const tabButtons={};
 let view='all',rows=[],linked=false,authenticated=false,requestSerial=0;
 for(const [key,label]of [['all','All listings'],['mine','My listings']]){const button=el('button',label);button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(key===view));button.onclick=()=>{if(view===key)return;view=key;load();};tabButtons[key]=button;tabs.append(button);}
 const stats=el('div',undefined,'exchange-stats'),tools=el('div',undefined,'exchange-tools');
 const searchLabel=el('label','Find an item or seller'),search=el('input');search.type='search';search.placeholder='Search items, sellers or planets';searchLabel.append(search);
 const categoryLabel=el('label','Category'),category=el('select');for(const [value,label]of [['all','All categories'],['ores','Ores & minerals'],['spice','Spice'],['building','Building'],['equipment','Equipment'],['farming','Farming'],['misc','Other goods']]){const option=el('option',label);option.value=value;category.append(option);}categoryLabel.append(category);
 const sortLabel=el('label','Sort by'),sort=el('select');for(const [value,label]of [['recent','Newest first'],['cheap','Lowest unit price'],['price','Highest unit price'],['quantity','Most items']]){const option=el('option',label);option.value=value;sort.append(option);}sortLabel.append(sort);
 const refresh=el('button','Refresh listings');refresh.type='button';tools.append(searchLabel,categoryLabel,sortLabel,refresh);
 const status=el('p',undefined,'exchange-status');status.setAttribute('role','status');const list=el('div',undefined,'exchange-list-wrap');list.id='exchange-list-panel';list.setAttribute('role','tabpanel');for(const button of Object.values(tabButtons))button.setAttribute('aria-controls',list.id);
 section.append(hero,tabs,stats,tools,status,list,exchangeLogisticsFooter());dashboard.append(section);const link=el('a','Exchange');link.href='#exchange';nav.append(link);
 function render(){
  for(const [key,button]of Object.entries(tabButtons))button.setAttribute('aria-selected',String(key===view));
  stats.replaceChildren();const count=rows.reduce((sum,row)=>sum+Number(row.quantity||0),0),prices=rows.map(row=>Number(row.price)).filter(Number.isFinite);
  for(const [label,value]of [[view==='mine'?'Your active offers':'Live offers',String(rows.length)],['Items available',new Intl.NumberFormat().format(count)],['Unit price range',prices.length?money(Math.min(...prices))+' – '+money(Math.max(...prices))+' DM':'—']]){const card=el('article');card.append(el('small',label),el('strong',value));stats.append(card);}
  const q=search.value.trim().toLowerCase(),filtered=rows.filter(row=>(category.value==='all'||row.category===category.value)&&[row.material,row.displayName,row.seller,row.category,planet(row.origin)].join(' ').toLowerCase().includes(q));
  filtered.sort((a,b)=>sort.value==='cheap'?Number(a.price)-Number(b.price):sort.value==='price'?Number(b.price)-Number(a.price):sort.value==='quantity'?Number(b.quantity)-Number(a.quantity):Number(b.id)-Number(a.id));
  if(!filtered.length){const empty=el('div',undefined,'exchange-empty');empty.append(el('div',undefined,'exchange-art exchange-art-contract'),el('h3',view==='mine'&&!linked?'Link your traveller identity':rows.length?'No matching offers':view==='mine'?'Your stall is ready':'The market is quiet'));
   empty.append(el('p',view==='mine'&&!linked?'Link your verified Minecraft account to see the items you have listed.':rows.length?'Try another search or category.':view==='mine'?'List a stack through Item Exchange in game. It will appear here once the listing is saved.':'There are no live player listings yet. Add your first offer through the in-game Item Exchange.'));
   if(view==='mine'&&!linked){const game=el('a','Link Minecraft account');game.href='#game';empty.append(game);}list.replaceChildren(empty);
  }else{
   const table=el('table',undefined,'exchange-table');table.append(el('caption',view==='mine'?'Your active player inventory listings':'Live player inventory listings'));
   const head=el('thead'),header=el('tr');for(const label of ['Item','Category','Origin','Seller','Available','Each · DM','Total · DM']){const th=el('th',label);th.scope='col';header.append(th);}head.append(header);const body=el('tbody');
   for(const row of filtered){const tr=el('tr'),item=el('td'),cell=el('div',undefined,'exchange-item'),icon=el('span',undefined,'exchange-item-icon');icon.append(itemIcon({material:row.material}));const name=el('div');name.append(el('strong',row.displayName||words(row.material)),el('small','#'+row.id+' · '+words(row.material)));cell.append(icon,name);item.append(cell);const type=el('td');type.append(el('span',words(row.category),'exchange-category'));const qty=el('td');qty.append(el('span',String(row.quantity),'exchange-quantity'));tr.append(item,type,el('td',planet(row.origin)),el('td',row.seller),qty,el('td',money(row.price),'exchange-price'),el('td',money(Number(row.price)*Number(row.quantity)),'exchange-price exchange-total'));body.append(tr);}table.append(head,body);list.replaceChildren(table);
  }
  status.textContent=(view==='mine'?'Your listings':'Live market')+' · '+filtered.length+' of '+rows.length+' offers · Purchases, delivery and reclaiming stay in game.';
 }
 async function load(){
  if(!authenticated)return;const serial=++requestSerial;refresh.disabled=true;list.setAttribute('aria-busy','true');status.textContent='Opening the trade ledger…';
  try{const response=await fetch('/api/exchange/listings?view='+view,{cache:'no-store'}),data=await response.json();if(serial!==requestSerial)return;if(!response.ok)throw Error(data.message||'Listings are temporarily unavailable.');rows=Array.isArray(data.listings)?data.listings:[];linked=data.linked===true;render();}
  catch(error){if(serial!==requestSerial)return;rows=[];stats.replaceChildren();list.replaceChildren(el('p','The live ledger could not be loaded. Refresh to try again.','exchange-empty'));status.textContent=error.message;}
  finally{if(serial===requestSerial){refresh.disabled=false;list.removeAttribute('aria-busy');}}
 }
 search.oninput=render;category.onchange=render;sort.onchange=render;refresh.onclick=load;
 async function session(user){authenticated=!!user;link.hidden=!authenticated;section.hidden=!authenticated;if(!authenticated){requestSerial++;rows=[];list.replaceChildren();stats.replaceChildren();return;}if(location.hash==='#exchange')await load();}
 window.addEventListener('dune:session',event=>session(event.detail));window.addEventListener('dune:page',()=>{if(location.hash==='#exchange')load();});window.addEventListener('hashchange',()=>{if(location.hash==='#exchange')load();});
 const response=await fetch('/api/auth/session',{cache:'no-store'});if(response.ok)await session((await response.json()).user);
}

function exchangeLogisticsFooter(){const footer=document.createElement('footer');footer.className='exchange-logistics-provider';const label=document.createElement('span');label.textContent='Exchange logistics supplied by';const brands=document.createElement('div');brands.className='exchange-logistics-brands';const spice=document.createElement('img');spice.src='/assets/spicepost-logo-v2.svg';spice.alt='SpicePost';spice.width=130;spice.height=43;const parent=document.createElement('div');parent.className='exchange-logistics-parent';const part=document.createElement('span');part.textContent='part of';const group=document.createElement('img');group.src='/assets/corrino-group-logo.svg';group.alt='Corrino Group';group.width=116;group.height=28;parent.append(part,group);brands.append(spice,parent);footer.append(label,brands);return footer;}

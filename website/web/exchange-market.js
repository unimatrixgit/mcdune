import {categories,planets,materialName,demoListings,validListings,filterListings,listingInstruction} from './exchange-data.js';
const $=id=>document.getElementById(id);
const state={items:[],page:0,demo:true,loading:false};
const perPage=12;
const categoryIcons={ores:'◆',spice:'✦',building:'▦',equipment:'⚒',farming:'❧',misc:'◎'};
function element(tag,className,value) {
  const el=document.createElement(tag); if(className) el.className=className;
  if(value!==undefined) el.textContent=String(value); return el;
}
function render() {
  const filters={search:$('market-search').value,category:$('market-category').value,planet:$('market-planet').value,sort:$('market-sort').value};
  const matches=filterListings(state.items,filters);
  const pages=Math.max(1,Math.ceil(matches.length/perPage));
  state.page=Math.max(0,Math.min(state.page,pages-1));
  $('market-count').textContent=matches.length+' '+(state.demo?'demo offers':'live listings');
  $('market-page').textContent='Page '+(state.page+1)+' of '+pages;
  $('market-prev').disabled=state.page===0; $('market-next').disabled=state.page>=pages-1;
  $('market-mode').textContent=state.demo?'DEMONSTRATION MARKET':'LIVE MARKET · READ ONLY';
  $('market-mode-detail').textContent=state.demo?'Fictional sellers, items and prices. No purchases or payments.':'Verified listings from the connected game market. Trade inside Minecraft.';
  document.querySelectorAll('button[data-planet]').forEach(b=>b.setAttribute('aria-pressed',String(filters.planet===b.dataset.planet)));
  document.querySelectorAll('button[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(filters.category===b.dataset.category)));
  const root=$('market-results'); root.replaceChildren();
  if(!matches.length) {
    root.append(element('p','market-empty',state.items.length?'No matching offers. Try another filter or clear your search.':'The connected market has no listings yet. List your held item with /exchange sell <amount> <price>.'));
    return;
  }
  for(const offer of matches.slice(state.page*perPage,(state.page+1)*perPage)) {
    const card=element('article','market-card'); card.dataset.planet=offer.origin;
    const art=element('div','market-item-art'); art.setAttribute('aria-hidden','true');
    art.append(element('span','',categoryIcons[offer.category]));
    card.append(art,element('p','market-card-category',categories[offer.category]),element('h3','',materialName(offer.material)),
      element('p','market-price',offer.price.toLocaleString(undefined,{maximumFractionDigits:2})+' dunemarks'),
      element('p','market-unit','per item · '+offer.quantity+' available'),element('p','market-seller',offer.seller),
      element('p','market-origin',planets[offer.origin]),element('small','market-instruction',listingInstruction(offer,state.demo)));
    const price=card.querySelector('.market-price'),note=document.createElement('img');note.src='assets/dunemark-icon-64.png';note.alt='';note.setAttribute('aria-hidden','true');note.className='currency-note-icon';price.prepend(note);
    root.append(card);
  }
}
async function load() {
  if(state.loading) return;
  state.loading=true; $('market-refresh').disabled=true;
  $('market-status').textContent='Checking for live market listings…';
  try {
    const response=await fetch('/api/exchange/listings',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error('Market unavailable');
    const data=await response.json(),items=validListings(data.listings);
    if(data.listings.length&&!items.length) throw Error('Invalid listings');
    state.items=items; state.demo=false;
    $('market-status').textContent='Connected to the game market · Read only · Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  } catch {
    state.items=demoListings; state.demo=true;
    $('market-status').textContent='Game market not connected — showing '+demoListings.length+' fictional demo offers. Refresh to check the connection.';
  } finally {
    state.loading=false; state.page=0; $('market-refresh').disabled=false; render();
  }
}
for(const id of ['market-search','market-category','market-planet','market-sort']) {
  $(id).addEventListener(id==='market-search'?'input':'change',()=>{state.page=0;render();});
}
for(const kind of ['planet','category']) document.querySelectorAll('button[data-'+kind+']').forEach(button=>{
  button.addEventListener('click',()=>{$('market-'+kind).value=button.dataset[kind];state.page=0;render();});
});
$('market-refresh').addEventListener('click',load);
$('market-prev').addEventListener('click',()=>{state.page--;render();});
$('market-next').addEventListener('click',()=>{state.page++;render();});
// Render the demonstration immediately while the first connection check is in flight.
state.items=demoListings; render(); load();

function exchangeLogisticsFooter(){const footer=document.createElement('footer');footer.className='exchange-logistics-provider';const label=document.createElement('span');label.textContent='Exchange logistics supplied by';const brands=document.createElement('div');brands.className='exchange-logistics-brands';const spice=document.createElement('img');spice.src='/assets/spicepost-logo-v2.svg';spice.alt='SpicePost';spice.width=130;spice.height=43;const parent=document.createElement('div');parent.className='exchange-logistics-parent';const part=document.createElement('span');part.textContent='part of';const group=document.createElement('img');group.src='/assets/corrino-group-logo.svg';group.alt='Corrino Group';group.width=116;group.height=28;parent.append(part,group);brands.append(spice,parent);footer.append(label,brands);return footer;}
const logisticsBoard=document.querySelector('.exchange-content, .market-board');if(logisticsBoard)logisticsBoard.after(exchangeLogisticsFooter());

import {createKitGenerator,createEnchantmentProfile} from './kit-generator.mjs';
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const qualities=['common','uncommon','rare','very_rare','legendary'];
const labels={common:'Common',uncommon:'Uncommon',rare:'Rare',very_rare:'Very Rare',legendary:'Legendary'};
let serial=0;

export function createHouseTailor({data,save,isCurrent=()=>true}){
 const root=el('div');root.className='house-tailor';const prefix='house-tailor-'+(++serial);
 root.append(el('p','Five independent clan designs. Saving one quality preserves the other four.'),el('p','Saved designs appear in the Kit Exchange. Purchases and new quality delivery are not enabled here. The current in-game clan shop continues to use your Uncommon design.'));
 const tabs=el('div');tabs.className='house-quality-tabs';tabs.role='tablist';tabs.setAttribute('aria-label','Clan kit quality');root.append(tabs);
 const records=new Map((data.qualities||[]).map(tier=>[tier.quality,{...tier}])),buttons=new Map(),panels=new Map();
 let selected='uncommon';
 function build(quality){
  const tier=records.get(quality),panel=panels.get(quality);panel.replaceChildren();panel.append(el('h3',labels[quality]+' · House Tailor'),createEnchantmentProfile(quality,'clan'));
  if(!tier){panel.append(el('p','This quality could not be loaded. Refresh to retry.'));return;}
  if(!tier.unlocked){panel.append(el('p','Locked · your clan has not unlocked this quality. Personal kit progress does not transfer to your clan.'));return;}
  if(!data.canDesign){panel.append(el('p','Your clan owner and officers manage this design.'));if(tier.blueprint){panel.append(el('h4',tier.blueprint.name));for(const line of tier.blueprint.lore)panel.append(el('p',line));}return;}
  let version=tier.blueprint?.version||0;
  const generator=createKitGenerator({kind:'clan',context:'House Tailor · '+data.clan.name,quality:labels[quality],initial:tier.blueprint||{name:data.clan.name+' stillsuit',color:'#385B49',lore:[]},maxNameLength:60,maxLoreLines:4,maxLoreLineLength:80,submitLabel:'Save '+labels[quality]+' design',onSave:async values=>{
   if(!isCurrent())throw Error('Your account changed. Reopen House Tailor before saving.');
   if(!price.reportValidity())throw Error('Use a whole shop price of at least '+tier.minimumShopPriceDunemarks+' DM.');
   fields.disabled=true;
   try{const result=await save({...values,quality,version,shopPriceDunemarks:Number(price.value)});if(!isCurrent())return;tier.blueprint=result.blueprint;version=result.blueprint.version;build(quality);panels.get(quality).querySelector('[role=status]').textContent=labels[quality]+' design saved · version '+version+'.';}
   finally{fields.disabled=false;}
  }});
  const priceLabel=el('label','Public Kit Exchange price · Dunemarks'),price=el('input');price.type='number';price.min=String(tier.minimumShopPriceDunemarks);price.max='1000000';price.step='1';price.required=true;price.value=String(tier.blueprint?.shopPriceDunemarks??tier.minimumShopPriceDunemarks);priceLabel.append(price);
  const fields=el('fieldset');fields.className='house-design-fields';fields.append(el('legend',labels[quality]+' design'),...generator.form.children);fields.insertBefore(priceLabel,fields.querySelector('button[type=submit]'));generator.form.append(fields);panel.append(generator.element);
 }
 function select(quality,focus=false){selected=quality;for(const key of qualities){const button=buttons.get(key),panel=panels.get(key);button.setAttribute('aria-selected',String(key===selected));button.tabIndex=key===selected?0:-1;panel.hidden=key!==selected;}if(focus)buttons.get(quality).focus();}
 for(const quality of qualities){
  const tier=records.get(quality),button=el('button'),panel=el('section'),icon=el('img');icon.src='https://www.dunerealms.com/assets/items/office_water.png';icon.alt='';button.type='button';button.role='tab';button.id=prefix+'-tab-'+quality;button.dataset.quality=quality;button.setAttribute('aria-controls',prefix+'-'+quality);button.append(icon,el('span',labels[quality]),el('small',tier?.unlocked?'Design':'Locked'));button.onclick=()=>select(quality);
  button.onkeydown=event=>{const index=qualities.indexOf(quality);let next;if(event.key==='ArrowRight')next=qualities[(index+1)%5];if(event.key==='ArrowLeft')next=qualities[(index+4)%5];if(event.key==='Home')next=qualities[0];if(event.key==='End')next=qualities[4];if(next){event.preventDefault();select(next,true);}};
  panel.id=prefix+'-'+quality;panel.role='tabpanel';panel.setAttribute('aria-labelledby',button.id);buttons.set(quality,button);panels.set(quality,panel);tabs.append(button);root.append(panel);build(quality);
 }
 select(selected);return{element:root};
}

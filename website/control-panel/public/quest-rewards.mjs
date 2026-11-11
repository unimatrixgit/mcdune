const endpoint='/api/quest/rewards';
const message=(data,fallback)=>typeof data?.message==='string'?data.message.slice(0,300):fallback;

/** Private form state. Every session/link change invalidates outstanding reads and
 * writes; a delayed success may never render in the next account's page. */
export function createQuestRewardController({fetcher=fetch,render=()=>{}}={}){
 let actor=null,generation=0,sequence=0,revision=0,state={allowed:false,status:'idle',linked:null,busy:false,discovered:false,redeemed:false,message:'',revision};
 const pending=new Set();
 const emit=next=>{state={...state,...next};render({...state});};
 const reset=()=>{generation++;sequence++;for(const request of pending)request.abort();pending.clear();revision++;emit({allowed:!!actor,status:'idle',linked:null,busy:false,discovered:false,redeemed:false,message:'',revision});};
 const current=token=>actor!==null&&token.generation===generation&&token.sequence===sequence;
 async function api(path,body,token){
  const abort=new AbortController();pending.add(abort);
  try{
   const response=await fetcher(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:abort.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
   const data=await response.json();if(!current(token))return null;return {response,data};
  }finally{pending.delete(abort);}
 }
 async function refresh(){
  if(!actor||state.status==='redeeming')return false;
  const token={generation,sequence:++sequence};emit({busy:true,status:'loading',message:'Checking your discovery rewards…'});
  try{
   const result=await api(endpoint,undefined,token);if(!result)return false;
   const {response,data}=result;
   if(response.status===403&&data.linked===false){emit({busy:false,status:'unlinked',linked:false,discovered:false,redeemed:false,message:message(data,'Link your Minecraft identity to redeem a code.')});return false;}
   if(!response.ok)throw Error(message(data,'Rewards could not be checked. Refresh to try again.'));
   if(data.linked!==true||typeof data.discovered!=='boolean'||typeof data.redeemed!=='boolean')throw Error('Rewards could not be checked. Refresh to try again.');
   emit({busy:false,status:data.redeemed?'redeemed':'ready',linked:true,discovered:data.discovered,redeemed:data.redeemed,message:data.redeemed?'Your discovery reward has already been credited.':data.discovered?'Your discovery is recorded. Enter the private code you received in game.':'Enter a private discovery code earned in game.'});return true;
  }catch(error){if(current(token))emit({busy:false,status:'error',message:error.name==='AbortError'?'Request stopped. Refresh to try again.':error.message});return false;}
 }
 async function claim(rawCode){
  if(!actor||state.busy||state.linked!==true||state.redeemed)return false;
  const code=typeof rawCode==='string'?rawCode.trim().toUpperCase():'';
  if(!/^DRQ-[A-F0-9]{40}$/.test(code)){emit({status:'error',message:'Enter the complete discovery code from the game.'});return false;}
  const token={generation,sequence:++sequence};emit({busy:true,status:'redeeming',message:'Redeeming your code…'});
  try{
   const result=await api(endpoint+'/claim',{code},token);if(!result)return false;
   const {response,data}=result;
   if(response.status===403&&data.linked===false){revision++;emit({busy:false,status:'unlinked',linked:false,revision,message:message(data,'Link your Minecraft identity to redeem a code.')});return false;}
   if(!response.ok)throw Error(message(data,'Your code could not be redeemed. Check it and try again.'));
   if(data.ok!==true||typeof data.credited!=='boolean'||data.amount!==1000)throw Error('The reward result could not be verified. Refresh before trying again.');
   revision++;emit({busy:false,status:'redeemed',discovered:true,redeemed:true,revision,message:data.credited?'1,000 Dunemarks credited to your game wallet.':'This reward was already redeemed. No duplicate Dunemarks were credited.'});return true;
  }catch(error){if(current(token))emit({busy:false,status:'error',message:error.name==='AbortError'?'Request stopped. Refresh before trying again.':error.message});return false;}
 }
 const controller={
  snapshot:()=>({...state}),
  setSession(user){actor=typeof user?.username==='string'&&user.permissions?.includes('web.menu.game')?user.username:null;reset();},
  linkChanged(){if(!actor)return;reset();refresh();},
  refresh,claim,
  async bootstrap(){const initial=generation;try{const response=await fetcher('/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error'});const data=await response.json();if(initial!==generation)return false;controller.setSession(response.ok&&data.authenticated?data.user:null);if(actor)await refresh();return true;}catch{return false;}}
 };
 return controller;
}

export function mountQuestRewardForm(document,window,fetcher=fetch){
 const host=document.getElementById('shop-quest-dock')||document.getElementById('game');if(!host)return null;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const card=el('article');card.className='quest-reward-card';card.hidden=true;card.setAttribute('aria-labelledby','quest-reward-title');
 const header=el('div');header.className='quest-reward-heading';const art=el('img');art.src='/assets/reward-gold-ingot-transparent-v1.png';art.alt='';art.width=64;art.height=64;art.loading='lazy';
 const heading=el('div');heading.append(el('p','YOUR EARNED DISCOVERIES'));heading.firstElementChild.className='quest-reward-eyebrow';const title=el('h3','Redeem a discovery code');title.id='quest-reward-title';heading.append(title);header.append(art,heading);
 const intro=el('p','Keep your in-game discovery code private. Rewards belong to your verified Minecraft identity and can be redeemed once.');intro.className='quest-reward-intro';
 const status=el('p');status.className='quest-reward-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
 const form=el('form');form.className='quest-reward-form';const label=el('label','Private discovery code');label.htmlFor='quest-reward-code';
 const input=el('input');input.id='quest-reward-code';input.name='code';input.type='text';input.required=true;input.maxLength=44;input.minLength=44;input.pattern='[Dd][Rr][Qq]-[A-Fa-f0-9]{40}';input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','characters');input.setAttribute('aria-describedby','quest-reward-help');input.placeholder='Paste your in-game code';
 const controls=el('div');controls.className='quest-reward-controls';const submit=el('button','Redeem code');submit.type='submit';submit.className='quest-reward-submit';const refresh=el('button','Refresh status');refresh.type='button';refresh.className='quest-reward-refresh';controls.append(submit,refresh);form.append(label,input,controls);
 const help=el('p','Sign in with the website account linked to the Minecraft character that earned the code.');help.id='quest-reward-help';help.className='quest-reward-help';
 card.append(header,intro,status,form,help);host.append(card);let lastRevision=-1;
 const controller=createQuestRewardController({fetcher,render(state){
  card.hidden=!state.allowed;card.dataset.state=state.status;card.setAttribute('aria-busy',String(state.busy));status.textContent=state.message;
  if(state.revision!==lastRevision){input.value='';lastRevision=state.revision;}
  input.disabled=state.busy||state.linked!==true||state.redeemed;submit.disabled=input.disabled;refresh.disabled=state.busy;
  submit.textContent=state.status==='redeeming'?'Redeeming…':state.redeemed?'Reward redeemed':'Redeem code';
 }});
 form.addEventListener('submit',event=>{event.preventDefault();controller.claim(input.value);});refresh.addEventListener('click',()=>controller.refresh());
 window.addEventListener('dune:shop-ready',event=>{if(event.detail?.host)event.detail.host.append(card);});
 window.addEventListener('dune:shop',()=>controller.refresh());
 window.addEventListener('dune:session',event=>{controller.setSession(event.detail);if(controller.snapshot().allowed&&['#planetary-inventory','#discovery-rewards','#rewards-codes'].includes(window.location.hash))controller.refresh();});
 window.addEventListener('dune:page',event=>{if(['planetary-inventory','discovery-rewards','rewards-codes'].includes(event.detail?.page))controller.refresh();});
 window.addEventListener('hashchange',()=>{if(window.location.hash==='#planetary-inventory')controller.refresh();});
 // The existing identity loader changes this visible status only after its
 // server request completes. Invalidate a pending claim/result after relinking.
 const linkStatus=document.getElementById('game-status');if(linkStatus)new window.MutationObserver(()=>controller.linkChanged()).observe(linkStatus,{childList:true});
 controller.bootstrap();return controller;
}
if(typeof document!=='undefined'&&typeof window!=='undefined')mountQuestRewardForm(document,window);

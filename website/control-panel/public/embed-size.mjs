const origins=new Set(['https://support.dunerealms.com','https://forums.dunerealms.com','https://cp.dunerealms.com','https://www.dunerealms.com']);
export function embedUrl(frame){const src=frame?.getAttribute('src');if(typeof src!=='string'||!src.trim())return null;try{return new URL(src,frame.ownerDocument?.baseURI||'https://cp.dunerealms.com/');}catch{return null;}}
export function embedHeight(event,frame){
 if(!event||!frame||event.source!==frame.contentWindow||!origins.has(event.origin))return null;
 const expected=embedUrl(frame)?.origin;
 if(expected!==event.origin||!['dune-embed-size','dune-shop-size'].includes(event.data?.type))return null;
 const n=event.data.height;return Number.isFinite(n)&&n>=100&&n<=200000?Math.ceil(n):null;
}
if(typeof window!=='undefined'){
 const bound=new WeakSet(),shopBodies=new WeakMap();let queued=false;
 const fit=(frame,height)=>{if(!Number.isFinite(height)||height<100||height>200000)return;frame.style.minHeight='0px';frame.style.height=Math.max(360,Math.ceil(height))+'px';frame.setAttribute('scrolling','no');};
 const fitOwnShop=frame=>{try{const url=embedUrl(frame);if(!url||url.origin!==location.origin||!url.pathname.startsWith('/store/'))return;const doc=frame.contentDocument;if(!doc?.body||shopBodies.get(frame)===doc.body)return;shopBodies.set(frame,doc.body);doc.documentElement.classList.add('dune-shop-embedded');const update=()=>fit(frame,doc.body.getBoundingClientRect().height+16);new ResizeObserver(update).observe(doc.body);update();}catch{/* A redirect may temporarily cross origins; use the normal handshake after load. */}};
 const measure=frame=>{const origin=embedUrl(frame)?.origin;if(!origins.has(origin))return;fitOwnShop(frame);frame.contentWindow?.postMessage({type:'dune-embed-measure'},origin);frame.contentWindow?.postMessage({type:'dune-shop-measure'},origin);};
 const scan=()=>{queued=false;for(const frame of document.querySelectorAll('#dashboard iframe[src]')){if(!bound.has(frame)){bound.add(frame);frame.addEventListener('load',()=>measure(frame));}measure(frame);}};
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(scan);}};
 window.addEventListener('message',event=>{for(const frame of document.querySelectorAll('#dashboard iframe[src]')){const height=embedHeight(event,frame);if(height===null)continue;fit(frame,height);break;}});
 new MutationObserver(schedule).observe(document.getElementById('dashboard')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});scan();
}

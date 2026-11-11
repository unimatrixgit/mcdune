
/* DuneRealms action system v1 */
(()=>{
 const selector='button,input[type=submit],input[type=button],input[type=reset],a.button,a.btn,a.action-button,[role=button],.ui.button,.cp-area-tabs>button,.tabs>a,.git-control-actions>a,.exchange-actions>a';
 const admin='#staff,#staff-home,#server-operations,#permissions,#staff-manual,#luckperms,#bans,#git-admin,#forum-admin,#staff-tickets,#website-posts,.staff-controls,.admin-panel';
 const eco='#exchange,#exchange-admin,#planetary-inventory,.exchange-desk,.kit-shop-dock,.kit-ledger';
 function assign(element){element.classList.add('dune-button');if(element.dataset.duneAction&&!element.dataset.duneAutoAction)return;const label=(element.getAttribute('aria-label')||element.value||element.textContent||'').trim().replace(/\s+/g,' '),href=element.getAttribute('href')||'';let kind='default';
  if(/^(?:approve|accept appeal|unban|confirm unban)\b/i.test(label)||/[?&]action=approve(?:&|$)/.test(href))kind='approve';
  else if(/^(?:deny|reject)\b/i.test(label)||/[?&]action=deny(?:&|$)/.test(href))kind='deny';
  else if(/^(?:reopen)\b/i.test(label)||/[?&]action=reopen(?:&|$)/.test(href))kind='reopen';
  else if(/^(?:delete|purge|stop|suspend|ban player|confirm ban)\b/i.test(label))kind='danger';
  else if(/^(?:cancel|reset|back|copy|close)\b/i.test(label))kind='neutral';
  else if(element.closest(eco)||/^(?:buy|sell|shop|trade|exchange|redeem|claim reward)\b/i.test(label))kind='economy';
  else if(element.closest(admin)||element.dataset.area==='staff'||/^(?:admin|manage|staff|permissions|server|moderation)\b/i.test(label)||location.pathname.startsWith('/scp/')||location.pathname.startsWith('/git/admin')||location.pathname.startsWith('/admin/'))kind='admin';
  element.dataset.duneAction=kind;element.dataset.duneAutoAction='true';
 }
 function scan(root){if(root.nodeType!==1&&root!==document)return;if(root.matches?.(selector))assign(root);root.querySelectorAll(selector).forEach(assign);}
 scan(document);let scheduled=false;const roots=new Set();new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){roots.add(record.target);for(const child of record.addedNodes)roots.add(child);}else roots.add(record.target);}if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;for(const root of roots)scan(root);roots.clear();});}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.addEventListener('hashchange',()=>scan(document));
})();

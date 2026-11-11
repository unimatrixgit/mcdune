export const BUTTON_CSS=`
/* DuneRealms action system v1: dark surfaces, semantic mineral-colour accents. */
html body .dune-button.dune-button.dune-button{--db-accent:#c1a15c;--db-ink:#ebd49a;--db-surface:#22392c;display:inline-flex;align-items:center;justify-content:center;gap:.45em;min-height:36px;padding:.62em 1.05em!important;border:1px solid var(--db-accent)!important;border-radius:7px!important;background:linear-gradient(145deg,var(--db-surface),#10251f)!important;color:var(--db-ink)!important;box-shadow:inset 0 1px 0 #ffffff0c,0 2px 4px #0003!important;text-shadow:none!important;text-decoration:none!important;font-weight:600;line-height:1.35;cursor:pointer;transition:border-color .16s,box-shadow .16s,background .16s,transform .16s;box-sizing:border-box;vertical-align:middle;max-width:100%}
html body .dune-button.dune-button[data-dune-action=admin]{--db-accent:#527fa5;--db-ink:#c8dfef;--db-surface:#1d3540}
html body .dune-button.dune-button:is([data-dune-action=economy],[data-dune-action=approve]){--db-accent:#558c69;--db-ink:#cde8cf;--db-surface:#203d2c}
html body .dune-button.dune-button:is([data-dune-action=deny],[data-dune-action=danger]){--db-accent:#9a625d;--db-ink:#f0cdca;--db-surface:#3b2928}
html body .dune-button.dune-button:is([data-dune-action=reopen],[data-dune-action=neutral]){--db-accent:#879b95;--db-ink:#dce5df;--db-surface:#293b35}
html body .dune-button.dune-button.dune-button:hover:not(:disabled):not([aria-disabled=true]){box-shadow:inset 0 1px 0 #ffffff13,0 0 0 1px var(--db-accent),0 4px 12px #0003!important;filter:brightness(1.1)}
html body .dune-button.dune-button.dune-button:is([aria-pressed=true],[aria-selected=true],[aria-current=page],.active){border-width:2px!important;box-shadow:inset 0 0 0 1px #ffffff10,0 0 12px #8aaf8b15!important;color:#f2f0df!important}
html body .dune-button.dune-button.dune-button:focus-visible{outline:3px solid var(--db-accent)!important;outline-offset:3px!important}
html body .dune-button.dune-button.dune-button:is(:disabled,[aria-disabled=true]){opacity:.48!important;cursor:not-allowed;filter:saturate(.55)}
html body :is(.redactor-toolbar,.tox,.ui-datepicker,.select2-container) .dune-button.dune-button.dune-button{min-height:26px;padding:4px 6px!important;border-radius:4px!important;box-shadow:none!important}
html body .dune-appeal-actions .dune-button{margin:4px 8px 4px 0!important}html body .dune-ticket-status-menu{display:flex;flex-wrap:wrap;gap:9px}
@media(prefers-reduced-motion:reduce){html body .dune-button{transition:none!important}}@media(max-width:540px){html body .dune-button.dune-button.dune-button{min-height:40px;padding:.65em .85em!important;white-space:normal}}
`;
export const BUTTON_SCRIPT=`
/* DuneRealms action system v1 */
(()=>{
 const selector='button,input[type=submit],input[type=button],input[type=reset],a.button,a.btn,a.action-button,[role=button],.ui.button,.cp-area-tabs>button,.tabs>a,.git-control-actions>a,.exchange-actions>a';
 const admin='#staff,#staff-home,#server-operations,#permissions,#staff-manual,#luckperms,#bans,#git-admin,#forum-admin,#staff-tickets,#website-posts,.staff-controls,.admin-panel';
 const eco='#exchange,#exchange-admin,#planetary-inventory,.exchange-desk,.kit-shop-dock,.kit-ledger';
 function assign(element){element.classList.add('dune-button');if(element.dataset.duneAction&&!element.dataset.duneAutoAction)return;const label=(element.getAttribute('aria-label')||element.value||element.textContent||'').trim().replace(/\\s+/g,' '),href=element.getAttribute('href')||'';let kind='default';
  if(/^(?:approve|accept appeal|unban|confirm unban)\\b/i.test(label)||/[?&]action=approve(?:&|$)/.test(href))kind='approve';
  else if(/^(?:deny|reject)\\b/i.test(label)||/[?&]action=deny(?:&|$)/.test(href))kind='deny';
  else if(/^(?:reopen)\\b/i.test(label)||/[?&]action=reopen(?:&|$)/.test(href))kind='reopen';
  else if(/^(?:delete|purge|stop|suspend|ban player|confirm ban)\\b/i.test(label))kind='danger';
  else if(/^(?:cancel|reset|back|copy|close)\\b/i.test(label))kind='neutral';
  else if(element.closest(eco)||/^(?:buy|sell|shop|trade|exchange|redeem|claim reward)\\b/i.test(label))kind='economy';
  else if(element.closest(admin)||element.dataset.area==='staff'||/^(?:admin|manage|staff|permissions|server|moderation)\\b/i.test(label)||location.pathname.startsWith('/scp/')||location.pathname.startsWith('/git/admin')||location.pathname.startsWith('/admin/'))kind='admin';
  element.dataset.duneAction=kind;element.dataset.duneAutoAction='true';
 }
 function scan(root){if(root.nodeType!==1&&root!==document)return;if(root.matches?.(selector))assign(root);root.querySelectorAll(selector).forEach(assign);}
 scan(document);let scheduled=false;const roots=new Set();new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){roots.add(record.target);for(const child of record.addedNodes)roots.add(child);}else roots.add(record.target);}if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;for(const root of roots)scan(root);roots.clear();});}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.addEventListener('hashchange',()=>scan(document));
})();
`;

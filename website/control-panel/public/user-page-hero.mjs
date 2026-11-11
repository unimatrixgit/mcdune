const pages={
 'bans':['THE IMPERIAL MODERATION BUREAU','Bans & appeals','Review moderation records, linked appeals and evidence through your authorised tools.','seals/department-ban-appeals-150.png'],
 'discord-link':['YOUR COMMUNITY CONNECTION','Discord linking','Secure Discord account linking is planned. No account is linked from this placeholder.','nav-discord-full-v2.webp'],
 'user-home':['YOUR ACCOUNT AT A GLANCE','User Panel','Your identity, support and next steps in one place.','nav-account-full-v2.webp'],
 'game':['YOUR VERIFIED GAME IDENTITY','Linked Account','Connect your Minecraft identity and manage your verified link.','uuid-link-imperial-v1.png'],
 'planetary-inventory':['YOUR PLANETARY EQUIPMENT','Inventory','Review your saved equipment and inventories across the worlds.','nav-exchange-full-v2.webp'],
 'kit-checkout':['YOUR KIT ORDER','Kit Checkout','Review your selected kits and confirm payment with Dunemarks.','nav-shop-v1.webp'],
 'transactions':['YOUR TRADING LEDGER','Transactions','Follow your recorded Exchange activity and completed trades.','nav-exchange-full-v2.webp'],
 'shop-settings':['YOUR STOREFRONT','Shop Settings','Your storefront preferences and purchase settings, together in one place.','nav-shop-v1.webp'],
 'exchange-settings':['YOUR MARKETPLACE PREFERENCES','Exchange Settings','Manage your trading preferences as Exchange integration becomes available.','nav-exchange-full-v2.webp'],
 'kits-exchange':['YOUR STILLSUIT WORKSHOP','Imperial Tailor','Create your colours, manage your kit designs and publish your latest commissions.','items/office_water.png'],
 'rewards-codes':['YOUR EARNED REWARDS','Rewards & Codes','Discover rewards, review community codes and redeem your purchased kits.','nav-manual-full-v2.webp'],
 'quests':['YOUR NEXT CHAPTER','Quests','Follow your discoveries and keep track of your next adventure.','nav-manual-full-v2.webp'],
 'clan-quests':['YOUR JOURNEY ACROSS THE DUNES','Quests','Manage your player quests, clan commissions and Spacing Guild adventures.','nav-manual-full-v2.webp'],
 'clan-quests-player':['YOUR PERSONAL ADVENTURE','Player Quests','Follow your own story and track your progress through the desert.','nav-manual-full-v2.webp'],
 'clan-quests-clan':['COMMISSIONS UNDER YOUR BANNER','Clan Quests','Review the shared adventures and objectives of your clan.','nav-clan-full-v2.webp'],
 'clan-quests-guild':['CONTRACTS BEYOND THE HORIZON','Spacing Guild Quests','Explore Guild contracts for your character and your clan.','nav-manual-full-v2.webp'],
 'personal-bank':['YOUR DUNEMARKS VAULT','Imperial Postbank','Your current account, savings and shared treasuries in one place.','/assets/imperial-postbank-v2.png'],
 'tickets':['YOUR PRIVATE SUPPORT DESK','Support Tickets','Open a case, follow your tickets and stay in touch with the support team.','nav-support-full-v2.webp'],
 'site-profile':['YOUR COMMUNITY IDENTITY','Personal information','Introduce yourself and manage the details you share with the community.','nav-account-full-v2.webp'],
 'security':['PROTECT YOUR ACCOUNT','Security','Manage your password and keep access to your account secure.','nav-account-full-v2.webp'],
 'imperial-atelier':['REGALIA OF THE REALM','The Imperial Atelier','Ceremonial stillsuits for the Emperor and current officeholders.','imperial-seal-128.png']
};
const dashboard=document.getElementById('dashboard');
let embeddedClan=false;try{embeddedClan=parent!==window&&new URL(document.referrer).hostname==='clans.dunerealms.com';}catch{}
function apply(){if(!dashboard||embeddedClan)return;for(const [id,[eyebrow,title,description,icon]]of Object.entries(pages)){const section=document.getElementById(id);if(!section||section.parentElement!==dashboard)continue;let hero=section.querySelector(':scope>.cp-user-page-hero');if(!hero){hero=document.createElement('header');hero.className='cp-user-page-hero';const art=document.createElement('img');art.src=icon.startsWith('/')?icon:'https://www.dunerealms.com/assets/'+icon;art.alt='';art.width=112;art.height=112;const text=document.createElement('div'),small=document.createElement('p'),heading=document.createElement('h2'),copy=document.createElement('p');small.className='cp-user-page-eyebrow';small.textContent=eyebrow;heading.textContent=title;copy.textContent=description;text.append(small,heading,copy);hero.append(art,text);section.prepend(hero);}section.classList.add('cp-user-banner-page');
 for(const old of section.querySelectorAll(':scope>h2,:scope>.overview-heading,:scope>.kit-market-banner,:scope>.atelier-banner')){old.classList.add('cp-user-legacy-heading');if(old.tagName==='H2'){const before=old.previousElementSibling,after=old.nextElementSibling;for(const p of [before,after])if(p?.tagName==='P'&&!p.id&&!p.hasAttribute('role')&&!p.querySelector('a,button,input'))p.classList.add('cp-user-legacy-heading');}}
 for(const header of section.querySelectorAll(':scope>header:not(.cp-user-page-hero)')){if(header.classList.contains('kit-heading')){header.classList.add('cp-user-legacy-toolbar');header.querySelector(':scope>div')?.classList.add('cp-user-legacy-heading');}else if(header.querySelector('h2')&&!header.querySelector('button,form,nav'))header.classList.add('cp-user-legacy-heading');}
 if(section.classList.contains('commerce-settings-placeholder'))for(const old of section.querySelectorAll(':scope>img,:scope>p:not(.commerce-placeholder-note)'))old.classList.add('cp-user-legacy-heading');
}}
apply();if(dashboard){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply();});}).observe(dashboard,{childList:true,subtree:true});window.addEventListener('dune:page',apply);}

import {renderNewsBody} from './news-format.mjs';
import {forumLinks,NEWS_CATEGORIES} from './news.mjs';
import {SHARED_HEADER,SHARED_HEAD} from '../scripts/portal-navigation.mjs';
const base='https://www.dunerealms.com';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages={
 '/':['DuneRealms — Desert Minecraft Server | Java & Bedrock','Explore DuneRealms, a desert science-fiction Minecraft community. Read server news, follow The Quest for Tavren II Aedrecht and join on Java or Bedrock.'],
 '/news-archive.html':['DuneRealms News & Changelog Archive','Browse DuneRealms server news, maintenance notices, community updates and published changelogs.'],
 '/manual.html':['DuneRealms Field Manual & Wiki','Learn about DuneRealms worlds, houses, travel, spice, gameplay and community systems in the illustrated field manual.'],
 '/wiki.html':['Our World & Disclaimer | DuneRealms','Discover the original DuneRealms setting, Dutch-inspired names, fan-project disclaimer and contact information.'],
 '/donate.html':['Community Support & Goals | DuneRealms','Follow DuneRealms community funding goals and shared rewards. Check current availability before contributing.'],
 '/discord.html':['DuneRealms Discord Community','Find the DuneRealms community Discord and connect with fellow desert adventurers.'],
 '/staff.html':['DuneRealms Staff & Contributors','Meet the DuneRealms community staff and project contributors.']
};
export const newsPath=p=>'/news/'+p.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75)+'-'+p.id;
const published="SELECT p.id,p.title,p.body,p.category,p.published_at,p.updated_at,COALESCE(a.display_name,a.username,'DuneRealms') author_name FROM website_posts p LEFT JOIN site_accounts a ON a.id=p.author_id WHERE p.status='published' AND p.published_at<=?";
const ld=data=>'<script type="application/ld+json">'+JSON.stringify(data).replaceAll('<','\\u003c')+'</script>';
function metadata(html,{title,description,canonical,type='website',image=base+'/assets/dunerealms-season-logo-v2.png',structured}){
 html=html.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\b(?=[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["']))[^>]*>/gi,'').replace(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi,'');
 const head='<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:site_name" content="DuneRealms"><meta property="og:type" content="'+type+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+image+'"><meta name="twitter:card" content="summary_large_image">'+(structured?ld(structured):'');
 return html.replace(/<\/head>/i,head+'</head>');
}
export function createSearchVisibility(db){
 const getPosts=async(limit=50000)=> (await db.prepare(published+' ORDER BY p.published_at DESC,p.id DESC LIMIT ?').bind(Date.now(),limit).all()).results;
 return{
  async route(request){
   const u=new URL(request.url);if(!['GET','HEAD'].includes(request.method))return null;
   if(u.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /internal/\nDisallow: /git/\nSitemap: '+base+'/sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public,max-age=300'}});
   if(u.pathname==='/sitemap.xml'){
    const posts=await getPosts();const urls=[...Object.keys(pages).filter(p=>p!=='/manual.html').map(p=>'<url><loc>'+base+p+'</loc></url>'),...posts.map(p=>'<url><loc>'+esc(base+newsPath(p))+'</loc><lastmod>'+new Date(Number(p.updated_at||p.published_at)).toISOString()+'</lastmod></url>')];
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=300'}});
   }
   if(u.pathname==='/index.html')return Response.redirect(base+'/',301);
   const legacy=u.pathname==='/news-archive.html'&&u.searchParams.has('post'),match=u.pathname.match(/^\/news\/(?:[a-z0-9-]*-)?([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);
   if(!legacy&&!match)return null;
   const id=legacy?u.searchParams.get('post'):match[1];if(!/^[a-f0-9-]{36}$/i.test(id||''))return new Response('News post not found',{status:404});
   const p=await db.prepare(published+' AND p.id=?').bind(Date.now(),id).first();if(!p)return new Response('News post not found',{status:404,headers:{'X-Robots-Tag':'noindex'}});
   const path=newsPath(p);if(legacy||u.pathname!==path)return Response.redirect(base+path,301);
   const description=p.body.replace(/\s+/g,' ').slice(0,160),date=new Date(Number(p.published_at)).toISOString();
   const art='/assets/news-'+(['world','news','maintenance','changelogs','events','community'].includes(p.category)?p.category:'news')+'.webp';
   const linked=(await forumLinks(db,[p]))[0],byline='<p class="dispatch-byline">Written by '+esc(p.author_name)+'</p>',discussion=linked.forum_url?'<p><a class="dispatch-read-more" href="'+esc(linked.forum_url)+'">Go to forum post →</a></p>':'';
   let html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-news.css?v=article-20261102">'+SHARED_HEAD+'</head><body class="home-news news-article-page">'+SHARED_HEADER+'<main id="main"><article id="news-full-post" class="dispatch-full"><a class="article-back" href="/news-archive.html">← News archive</a><div class="article-heading"><div><div class="article-meta"><span class="article-category">'+esc(NEWS_CATEGORIES[p.category]||NEWS_CATEGORIES.news)+'</span><time datetime="'+date+'">'+esc(new Date(Number(p.published_at)).toLocaleDateString('en-GB',{dateStyle:'long'}))+'</time></div><h1>'+esc(p.title)+'</h1>'+byline+'</div><img src="'+art+'" alt="Imperial dispatch artwork" width="360" height="240"></div><div class="dispatch-full-body article-body">'+renderNewsBody(p.body)+'</div>'+discussion+'</article></main><footer><a href="/">DuneRealms</a> · <a href="/wiki.html">Disclaimer &amp; contact</a></footer></body></html>';
   html=metadata(html,{title:p.title+' | DuneRealms',description,canonical:base+path,type:'article',structured:{'@context':'https://schema.org','@type':'NewsArticle',headline:p.title,datePublished:date,dateModified:new Date(Number(p.updated_at||p.published_at)).toISOString(),mainEntityOfPage:base+path,image:[base+'/assets/dunerealms-season-logo-v2.png'],publisher:{'@type':'Organization',name:'DuneRealms',url:base}}});
   return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public,max-age=60'}});
  },
  async html(request,html){
   const u=new URL(request.url),path=u.pathname==='/'?'/':u.pathname,config=pages[path];if(!config)return html;
   html=metadata(html,{title:config[0],description:config[1],canonical:path==='/manual.html'?'https://wiki.dunerealms.com/':base+path,structured:path==='/'?{'@context':'https://schema.org','@type':'WebSite',name:'DuneRealms',url:base+'/'}:null});
   if(path==='/'||path==='/news-archive.html'){
    const posts=await getPosts(path==='/'?9:25),cards='<div class="dispatch-grid" data-server-news>'+posts.map(p=>'<article class="dispatch-card"><img src="/assets/nav-discord-full-v2.webp" width="1672" height="941" alt="" loading="lazy"><div class="dispatch-copy"><span>'+esc(NEWS_CATEGORIES[p.category]||NEWS_CATEGORIES.news)+'</span><h3><a href="'+newsPath(p)+'">'+esc(p.title)+'</a></h3><p>'+esc(p.body.slice(0,180))+'</p><a class="dispatch-read-more" href="'+newsPath(p)+'">Read more →</a></div></article>').join('')+'</div>';
    html=html.replace(/(<div\s+data-news-module="news"[^>]*>)/, '$1'+cards);
   }
   return html;
  }
 };
}

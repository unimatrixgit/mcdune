// Account features have one canonical origin and one host-only session cookie.
export function controlPanelRedirect(request,settings={}) {
  if(!['GET','HEAD'].includes(request.method))return null;
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  const pages={'/account.html':'game','/account':'game','/portal.html':'game','/profile.html':'game','/login.html':'game','/register.html':'game','/tickets.html':'tickets','/tickets':'tickets','/support':'tickets'};
  if(!Object.hasOwn(pages,path))return null;
  const target=new URL(settings.CP_ORIGIN||'https://cp.dunerealms.com');
  target.pathname='/';target.search=url.search;target.hash=pages[path];
  return new Response(null,{status:302,headers:{Location:target.href,'Cache-Control':'no-store'}});
}

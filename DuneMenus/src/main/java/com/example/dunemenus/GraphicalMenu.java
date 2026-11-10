package com.example.dunemenus;
import org.bukkit.*;import org.bukkit.entity.Player;import org.bukkit.inventory.*;import org.bukkit.inventory.meta.ItemMeta;import org.bukkit.event.inventory.*;import net.kyori.adventure.key.Key;import net.kyori.adventure.text.Component;import net.kyori.adventure.text.format.NamedTextColor;import java.util.*;
/** Server-owned graphical cards. Display items never enter player inventory. */
final class GraphicalMenu {
 static final String RELEASE="Alpha 1.0.0.4";
 static final int[] DASHBOARD_SLOTS={10,12,14,16,28,30,32,34,40};
 static boolean navigator(String title){String s=title.toLowerCase(Locale.ROOT);return s.contains("main menu")||s.contains("navigator");}
 static boolean directNavigation(DuneMenus.Card card){String s=card.label().toLowerCase(Locale.ROOT);return card.action()!=null&&(s.equals("exchange")||s.equals("bank")||s.equals("passport")||s.equals("war room")||s.equals("achievements")||s.equals("notifications")||s.equals("events")||s.equals("staff console")||s.equals("my house")||s.equals("contracts")||s.equals("item exchange"));}
 static final int[] CENTERS={10,13,16,28,31,34};
 static final Map<UUID,Screen> screens=new HashMap<>();
 static final class Screen implements InventoryHolder {
  final UUID owner;final DuneMenus.View view;final Map<Integer,Runnable> actions=new HashMap<>();Inventory inventory;
  Screen(UUID owner,DuneMenus.View view){this.owner=owner;this.view=view;}
  public Inventory getInventory(){return inventory;}
 }
 static boolean owned(Inventory inventory,Player actor){return inventory!=null&&inventory.getHolder() instanceof Screen s&&s.owner.equals(actor.getUniqueId())&&screens.get(s.owner)==s;}
 static boolean usable(Screen screen,Player actor,DuneMenus plugin){return screen.owner.equals(actor.getUniqueId())&&screens.get(screen.owner)==screen&&plugin.current(actor,screen.view);}
 static void forget(Player actor){screens.remove(actor.getUniqueId());}
 static void clear(){screens.clear();}
 static ItemStack icon(Material material,String label,String body){ItemStack item=new ItemStack(material);ItemMeta meta=item.getItemMeta();meta.setDisplayName(ChatColor.GOLD+label);List<String> lore=new ArrayList<>();for(String line:body.split("\n"))for(int at=0;at<Math.max(1,line.length());at+=42)lore.add(ChatColor.GRAY+line.substring(Math.min(at,line.length()),Math.min(at+42,line.length())));meta.setLore(lore);item.setItemMeta(meta);return item;}
 private static ItemStack card(DuneMenus.Card card,boolean navigation){ItemStack item=card.item();if(item==null)item=icon(Material.PAPER,card.label(),card.body());ItemMeta meta=item.getItemMeta();meta.setDisplayName(ChatColor.GOLD+card.label());List<String> lore=new ArrayList<>();for(String text:card.body().split("\n"))for(int at=0;at<Math.max(1,text.length());at+=42)lore.add(ChatColor.GRAY+text.substring(Math.min(at,text.length()),Math.min(at+42,text.length())));lore.add(ChatColor.YELLOW+(navigation&&directNavigation(card)?"Click to open":"Click to review"));meta.setLore(lore);
 if(navigation){String s=card.label().toLowerCase(Locale.ROOT);String model=s.contains("exchange")||s.contains("shop")?"gui_nav_shop":s.contains("contract")||s.contains("job")?"gui_nav_jobs":s.contains("staff")||s.contains("ticket")?"gui_nav_staff":s.contains("faction")||s.contains("clan")?"gui_nav_clan":null;if(model!=null){item=new ItemStack(Material.PAPER);meta=item.getItemMeta();meta.setDisplayName(ChatColor.GOLD+card.label());meta.setLore(lore);meta.setItemModel(new NamespacedKey("dunerealms",model));}}
 item.setItemMeta(meta);return item;}
 static Component title(Player actor){Component label=Component.text(RELEASE+" · Menu",NamedTextColor.GOLD).font(Key.key("minecraft:default"));return actor.hasResourcePack()?Component.text("\ue232\ue230\ue231\ue233",NamedTextColor.WHITE).font(Key.key("dunerealms:imperial_menus")).append(label):label;}
 static void show(DuneMenus plugin,Player actor,DuneMenus.View view,int detail,int page){
  if(!plugin.current(actor,view))return;Screen screen=screens.get(actor.getUniqueId());boolean open=screen==null||screen.view!=view;
  if(open){screen=new Screen(actor.getUniqueId(),view);screen.inventory=Bukkit.createInventory(screen,54,title(actor));screens.put(screen.owner,screen);}
  screen.actions.clear();screen.inventory.clear();long revision=view.revision().incrementAndGet();
  ItemStack fill=icon(Material.BLACK_STAINED_GLASS_PANE," ","");for(int i=0;i<54;i++)screen.inventory.setItem(i,fill);
  screen.inventory.setItem(4,icon(Material.NETHER_STAR,view.title(),RELEASE+"\n"+MenuTheme.of(view.title()).name()));
  if(detail<0){boolean nav=navigator(view.title());int perPage=nav?DASHBOARD_SLOTS.length:CENTERS.length;int pages=Math.max(1,(view.cards().size()+perPage-1)/perPage);if(page<0||page>=pages)return;
   for(int i=page*perPage;i<Math.min((page+1)*perPage,view.cards().size());i++){
    int index=i,position=i-page*perPage,center=nav?DASHBOARD_SLOTS[position]:CENTERS[position];
    var entry=view.cards().get(i);screen.inventory.setItem(center,card(entry,nav));
    if(nav){String op=directNavigation(entry)?"action":"detail";screen.actions.put(center,()->plugin.navigate(actor,view,op,index,revision));}
    else for(int slot:region(center))screen.actions.put(slot,()->plugin.navigate(actor,view,"detail",index,revision));
   }
   if(nav){screen.inventory.setItem(0,icon(Material.CHISELED_SANDSTONE," ",""));screen.actions.put(0,()->plugin.navigate(actor,view,"ornament",0,revision));}
   if(page>0)button(screen,45,Material.ARROW,"Previous page","",()->show(plugin,actor,view,-1,page-1));
   screen.inventory.setItem(48,icon(Material.MAP,"Page "+(page+1)+" / "+pages,nav?"Select a service to open":"Click a card to review"));
   if(page+1<pages)button(screen,53,Material.ARROW,"Next page","",()->show(plugin,actor,view,-1,page+1));
  }else{
   if(detail>=view.cards().size())return;var card=view.cards().get(detail);screen.inventory.setItem(22,card(card,false));screen.inventory.setItem(13,icon(Material.WRITABLE_BOOK,card.label(),card.body()));
   if(card.action()!=null)button(screen,30,Material.LIME_DYE,"Confirm / Continue","Rechecks your current access before acting",()->plugin.navigate(actor,view,"action",detail,revision));
   button(screen,32,Material.ARROW,"Back to cards","No action is performed",()->show(plugin,actor,view,-1,detail/6));
  }
  button(screen,49,Material.BARRIER,"Close","Return to the game",()->plugin.navigate(actor,view,"close",0,revision));
  if(open)actor.openInventory(screen.inventory);
 }
 static int[] region(int center){int start=center-1;return new int[]{start,start+1,start+2,start+9,start+10,start+11};}
 private static void button(Screen screen,int slot,Material material,String label,String body,Runnable action){screen.inventory.setItem(slot,icon(material,label,body));screen.actions.put(slot,action);}
 static void click(DuneMenus plugin,InventoryClickEvent event){if(!(event.getView().getTopInventory().getHolder() instanceof Screen screen))return;event.setCancelled(true);if(!(event.getWhoClicked() instanceof Player actor)||!usable(screen,actor,plugin)||event.getClickedInventory()!=screen.inventory||!(event.getClick()==ClickType.LEFT||event.getClick()==ClickType.RIGHT))return;Runnable action=screen.actions.get(event.getRawSlot());if(action==null)return;long revision=screen.view.revision().get();Bukkit.getScheduler().runTask(plugin,()->{if(usable(screen,actor,plugin)&&screen.view.revision().get()==revision)action.run();});}
 static void drag(InventoryDragEvent event){if(event.getView().getTopInventory().getHolder() instanceof Screen)event.setCancelled(true);}
 static void closed(DuneMenus plugin,InventoryCloseEvent event){if(event.getInventory().getHolder() instanceof Screen screen&&event.getPlayer() instanceof Player actor&&screens.get(screen.owner)==screen){screens.remove(screen.owner);if(plugin.current(actor,screen.view))plugin.cancel(actor);}}
}

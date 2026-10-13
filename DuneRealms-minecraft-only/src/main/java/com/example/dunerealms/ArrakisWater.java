package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.generator.*;
import java.util.*;

/** Finite, naturally generated Arrakis water caches and two water-trading careers. */
public final class ArrakisWater implements Listener {
    private final DuneCore plugin;
    private final NamespacedKey waterKey;
    private final Map<UUID, String> careers = new HashMap<>();
    private final Map<UUID,Integer> money;
    private final Runnable save;
    private final Politics politics;
    ArrakisWater(DuneCore plugin,Map<UUID,Integer> money,Runnable save,Politics politics) {
        this.plugin=plugin;this.money=money;this.save=save;this.politics=politics;
        waterKey=new NamespacedKey("dunerealms","finite_arrakis_water");
    }
    private boolean arrakis(World w){return w.getName().equalsIgnoreCase("arrakis");}
    public static final class SietchPopulator extends BlockPopulator {
        @Override public void populate(WorldInfo world, Random random, int cx,int cz,LimitedRegion region) {
            if(!world.getName().equalsIgnoreCase("arrakis") || random.nextInt(90)!=0)return;
            int x=cx*16+4+random.nextInt(8), z=cz*16+4+random.nextInt(8);
            int y=region.getHighestBlockYAt(x,z);
            if(y<65 || y>world.getMaxHeight()-12 || y-12<world.getMinHeight())return;
            // Stone-brick surface shelter with an underground cavern containing a finite pool.
            for(int dx=-4;dx<=4;dx++)for(int dz=-4;dz<=4;dz++)for(int dy=-10;dy<=3;dy++){
                int ax=x+dx,az=z+dz,ay=y+dy;
                if(!region.isInRegion(ax,ay,az))continue;
                boolean cave=dy>=-9 && dy<=-5 && Math.abs(dx)<=3 && Math.abs(dz)<=3;
                if(cave)region.setType(ax,ay,az,dy<=-8?Material.WATER:Material.AIR);
                else if(dy>=0 && dy<=3 && Math.abs(dx)<=3 && Math.abs(dz)<=3) {
                    boolean wall=Math.abs(dx)==3 || Math.abs(dz)==3 || dy==3;
                    region.setType(ax,ay,az,wall?Material.SANDSTONE:Material.AIR);
                }
            }
            // A marked entrance and ladder descending to the water chamber.
            for(int dy=-7;dy<=2;dy++){
                if(region.isInRegion(x,y+dy,z))region.setType(x,y+dy,z,Material.AIR);
                if(region.isInRegion(x+1,y+dy,z))region.setType(x+1,y+dy,z,Material.LADDER);
            }
            if(region.isInRegion(x,y+4,z))region.setType(x,y+4,z,Material.ORANGE_BANNER);
        }
    }
    private boolean tagged(ItemStack i){return i!=null && i.hasItemMeta() && i.getItemMeta().getPersistentDataContainer().has(waterKey,PersistentDataType.BYTE);}
    @EventHandler public void onFill(PlayerBucketFillEvent e){
        if(!arrakis(e.getBlockClicked().getWorld()))return;
        Block water=e.getBlockClicked().getRelative(e.getBlockFace());
        if(water.getType()!=Material.WATER || !(water.getBlockData() instanceof org.bukkit.block.data.Levelled level) || level.getLevel()!=0)return;
        // Vanilla consumes the source block; turn the resulting bucket into a saleable, tagged item.
        ItemStack result=new ItemStack(Material.WATER_BUCKET);ItemMeta m=result.getItemMeta();
        m.setDisplayName(ChatColor.AQUA+"Arrakis Water - Finite Source");
        m.getPersistentDataContainer().set(waterKey,PersistentDataType.BYTE,(byte)1);
        result.setItemMeta(m);e.setItemStack(result);
    }
    @EventHandler public void onFlow(BlockFromToEvent e){
        if(arrakis(e.getBlock().getWorld()) && e.getBlock().getType()==Material.WATER)e.setCancelled(true);
    }
    @EventHandler public void onPlace(PlayerBucketEmptyEvent e){
        if(arrakis(e.getBlock().getWorld()) && e.getBucket()==Material.WATER_BUCKET){e.setCancelled(true);e.getPlayer().sendMessage(ChatColor.RED+"Water cannot be placed on Arrakis. Every natural source is finite.");}
    }
    @EventHandler public void onIce(BlockFormEvent e){if(arrakis(e.getBlock().getWorld()) && (e.getNewState().getType()==Material.ICE || e.getNewState().getType()==Material.SNOW))e.setCancelled(true);}
    @EventHandler public void onCauldron(org.bukkit.event.block.CauldronLevelChangeEvent e){if(arrakis(e.getBlock().getWorld()) && e.getNewState().getType()==Material.WATER_CAULDRON)e.setCancelled(true);}
    public void command(Player p,String[] args){
        if(args.length<2){p.sendMessage(ChatColor.AQUA+"/dune water guild|smuggler|sell|status");return;}
        String mode=args[1].toLowerCase(Locale.ROOT);
        if(mode.equals("guild")||mode.equals("smuggler")){
            careers.put(p.getUniqueId(),mode);p.sendMessage(ChatColor.GREEN+"Water career selected: "+mode);return;
        }
        if(mode.equals("status")){p.sendMessage("Water career: "+careers.getOrDefault(p.getUniqueId(),"guild")+". Water is worth half of spice; smuggling pays +45% with local retaliation risk.");return;}
        if(!mode.equals("sell")){p.sendMessage("/dune water guild|smuggler|sell|status");return;}
        int count=0;
        for(ItemStack item:p.getInventory().getStorageContents())if(tagged(item))count+=item.getAmount();
        if(count==0){p.sendMessage(ChatColor.RED+"You have no collected Arrakis water buckets.");return;}
        int spice=plugin.getConfig().getInt("spice-sell-price",100);
        int base=Math.max(1,spice/2);
        boolean appointed=politics.isAuthorizedWater(plugin.factionOf(p));
        boolean smuggler=!appointed;
        int gross=(int)Math.round(count*base*(smuggler?1.45:1.0));
        if(smuggler)plugin.reportSmuggling(p,"WATER",gross);
        int levy=politics.levy(p.getUniqueId(),gross);
        for(int i=0;i<p.getInventory().getSize();i++){
            ItemStack item=p.getInventory().getItem(i);
            if(tagged(item))p.getInventory().setItem(i,null);
        }
        money.merge(p.getUniqueId(),gross-levy,Integer::sum);save.run();
        p.sendMessage(ChatColor.GOLD+"Sold "+count+" water buckets for "+(gross-levy)+" Solaris (Trust levy "+levy+").");
    }
    @EventHandler public void onCollect(PlayerBucketFillEvent e) {
        Player p=e.getPlayer();
        if(politics.isAuthorizedWater(plugin.factionOf(p)))return;
        if(e.getBlockClicked().getRelative(e.getBlockFace()).getType()!=Material.WATER)return;
        if(Math.random()>=plugin.getConfig().getDouble("arrakis-water.smuggler-retaliation-chance",0.30))return;
        int spice=plugin.getConfig().getInt("spice-sell-price",100);
        int profit=(int)Math.round(Math.max(1,spice/2)*1.45);
        String world=p.getWorld().getName();
        try{
            if(plugin.sharedDatabase()!=null)plugin.sharedDatabase().issueBounty(p.getUniqueId(),world,profit);
            else p.sendMessage(ChatColor.RED+"Bounty tracking requires shared database.");
        }catch(Exception ex){plugin.getLogger().warning("Could not issue bounty: "+ex.getMessage());return;}
        for(Player local:p.getWorld().getPlayers())
            local.sendMessage(ChatColor.RED+"WATER SMUGGLER ACTIVE: "+p.getName()+"! Bounty: "+profit+" Solaris. Hunt them down!");
        for(int i=0;i<2;i++){
            Location at=p.getLocation().clone().add((Math.random()-.5)*8,0,(Math.random()-.5)*8);
            try{Husk hostile=p.getWorld().spawn(at,Husk.class);
                hostile.setCustomName(ChatColor.RED+"Angry Local");hostile.setTarget(p);
            }catch(Exception ignored){}
        }
    }
}

package com.example.dunerealms;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;

/** Configurable hourly NPC-issued spice contracts; independent from player-sponsored jobs. */
final class ServerJobs {
    private record Template(String id, String title, int spiceRequired, int pay, long limitSeconds) {}
    private record Active(String id, long acceptedAt, int harvested) {}
    private final JavaPlugin plugin;
    private final Economy economy;
    private final Map<String,Template> templates = new LinkedHashMap<>();
    private final Map<UUID,Active> active = new HashMap<>();
    private final File stateFile;
    private final File jobsFile;
    private long rotationStart;
    private List<String> offers = new ArrayList<>();

    ServerJobs(JavaPlugin plugin, Economy economy) {
        this.plugin=plugin; this.economy=economy;
        stateFile=new File(plugin.getDataFolder(),"server-jobs-state.yml");
        jobsFile=new File(plugin.getDataFolder(),"server-jobs.yml");
    }
    void load() {
        if (!jobsFile.exists()) plugin.saveResource("server-jobs.yml",false);
        reloadTemplates();
        YamlConfiguration y=YamlConfiguration.loadConfiguration(stateFile);
        rotationStart=y.getLong("rotation-start",0);
        offers=new ArrayList<>(y.getStringList("offers"));
        ConfigurationSection section=y.getConfigurationSection("active");
        if(section!=null) for(String id:section.getKeys(false)) try {
            UUID uuid=UUID.fromString(id);
            active.put(uuid,new Active(y.getString("active."+id+".id",""),y.getLong("active."+id+".accepted-at"),y.getInt("active."+id+".harvested")));
        } catch(IllegalArgumentException ignored) {}
        tick();
        Bukkit.getScheduler().runTaskTimer(plugin,this::tick,20L,20L*10);
    }
    private void reloadTemplates() {
        templates.clear();
        YamlConfiguration y=YamlConfiguration.loadConfiguration(jobsFile);
        ConfigurationSection section=y.getConfigurationSection("jobs");
        if(section==null) return;
        for(String id:section.getKeys(false)) {
            String key="jobs."+id+".";
            int required=y.getInt(key+"spice-required");
            int pay=y.getInt(key+"pay");
            long duration=y.getLong(key+"time-limit-minutes")*60L;
            if(required<=0 || pay<=0 || duration<=0) {
                plugin.getLogger().warning("Invalid server job: "+id); continue;
            }
            templates.put(id,new Template(id,y.getString(key+"title",id),required,pay,duration));
        }
    }
    private void tick() {
        long now=Instant.now().getEpochSecond();
        long interval=3600;
        long window=now/interval*interval;
        if(rotationStart!=window) {
            rotationStart=window;
            reloadTemplates();
            List<String> all=new ArrayList<>(templates.keySet());
            Collections.shuffle(all);
            int count=Math.max(1,YamlConfiguration.loadConfiguration(jobsFile).getInt("offers-per-hour",3));
            offers=new ArrayList<>(all.subList(0,Math.min(count,all.size())));
            Bukkit.broadcastMessage(ChatColor.GOLD+"[CHOAM] New server spice contracts are available! /dune serverjobs");
        }
        for(var entry:new ArrayList<>(active.entrySet())) {
            Active job=entry.getValue();
            Template t=templates.get(job.id());
            if(t==null || now-job.acceptedAt()>=t.limitSeconds()) {
                fail(entry.getKey(),job,t);
            }
        }
        save();
    }
    private void fail(UUID player,Active job,Template t) {
        active.remove(player);
        if(t==null) return;
        int fine=(int)Math.ceil(t.pay()*0.05);
        economy.withdrawPlayer(Bukkit.getOfflinePlayer(player),fine); // DuneEss permits contract debt.
        Player online=Bukkit.getPlayer(player);
        if(online!=null) online.sendMessage(ChatColor.RED+"CHOAM contract failed: "+t.title()+". Fine: "+fine+" Solaris (5% of pay).");
    }
    void harvest(Player p,int amount) {
        Active a=active.get(p.getUniqueId());
        if(a==null) return;
        Template t=templates.get(a.id());
        if(t==null) return;
        long now=Instant.now().getEpochSecond();
        if(now-a.acceptedAt()>=t.limitSeconds()) { fail(p.getUniqueId(),a,t); save(); return; }
        int progress=Math.min(t.spiceRequired(),a.harvested()+amount);
        if(progress>=t.spiceRequired()) {
            active.remove(p.getUniqueId());
            economy.depositPlayer(p,t.pay());
            p.sendMessage(ChatColor.GREEN+"CHOAM contract complete: "+t.title()+"! Paid "+t.pay()+" Solaris.");
        } else active.put(p.getUniqueId(),new Active(a.id(),a.acceptedAt(),progress));
        save();
    }
    List<String> offerIds() { return List.copyOf(offers); }
    String describe(String id) {
        Template t=templates.get(id);
        return t==null ? "Unavailable" : t.title()+" | "+t.spiceRequired()+" spice | "+t.pay()+" Solaris | "+(t.limitSeconds()/60)+" min | 5% failure fine";
    }
    String activeDescription(Player p) {
        Active a=active.get(p.getUniqueId());
        if(a==null) return "No active contract";
        Template t=templates.get(a.id());
        if(t==null) return "Contract no longer available";
        return t.title()+" | "+a.harvested()+"/"+t.spiceRequired()+" spice | "+Math.max(0,(a.acceptedAt()+t.limitSeconds()-Instant.now().getEpochSecond())/60)+" min left";
    }
    void list(Player p) {
        p.sendMessage(ChatColor.GOLD+"=== CHOAM Hourly Contracts ===");
        for(String id:offers) {
            Template t=templates.get(id); if(t==null) continue;
            p.sendMessage(ChatColor.YELLOW+id+" | "+t.title()+" | "+t.spiceRequired()+" spice | "+t.pay()+" Solaris | "+(t.limitSeconds()/60)+" min | failure fine "+(int)Math.ceil(t.pay()*0.05)+" Solaris");
        }
        Active a=active.get(p.getUniqueId());
        if(a!=null) {
            Template t=templates.get(a.id());
            if(t!=null) p.sendMessage(ChatColor.AQUA+"Active: "+t.title()+" "+a.harvested()+"/"+t.spiceRequired()+" spice, "+Math.max(0,(a.acceptedAt()+t.limitSeconds()-Instant.now().getEpochSecond())/60)+" min left");
        }
    }
    void command(Player p,String[] args) {
        if(args.length<2) { list(p); return; }
        if(args[1].equalsIgnoreCase("reload")) {
            if(!p.hasPermission("dune.admin")) { p.sendMessage("Admin only."); return; }
            reloadTemplates(); offers.removeIf(id->!templates.containsKey(id));
            p.sendMessage("Server job definitions reloaded; next rotation occurs at the next hour."); return;
        }
        if(!args[1].equalsIgnoreCase("accept") || args.length<3) { list(p); return; }
        if(active.containsKey(p.getUniqueId())) { p.sendMessage("Finish your existing CHOAM contract first."); return; }
        Template t=templates.get(args[2]);
        if(t==null || !offers.contains(t.id())) { p.sendMessage("Job not available in the current rotation."); return; }
        active.put(p.getUniqueId(),new Active(t.id(),Instant.now().getEpochSecond(),0));
        save();
        p.sendMessage(ChatColor.GREEN+"Accepted "+t.title()+". Complete within "+(t.limitSeconds()/60)+" minutes or pay a 5% fine.");
    }
    void save() {
        YamlConfiguration y=new YamlConfiguration();
        y.set("rotation-start",rotationStart); y.set("offers",offers);
        for(var e:active.entrySet()) {
            String path="active."+e.getKey()+".";
            y.set(path+"id",e.getValue().id());
            y.set(path+"accepted-at",e.getValue().acceptedAt());
            y.set(path+"harvested",e.getValue().harvested());
        }
        try { y.save(stateFile); } catch(IOException ex) { plugin.getLogger().warning("Cannot save CHOAM jobs: "+ex.getMessage()); }
    }
}

package com.example.dunerealms;

import org.bukkit.ChatColor;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Prototype political systems. Persistent locally; deploy a shared transactional database
 * before enabling elections or treasury spending across multiple backend servers.
 */
public final class Politics {
    private final JavaPlugin plugin;
    private final Map<UUID,String> factions;
    private final Economy economy;
    private final File file;
    private final SharedDatabase database;
    private final YamlConfiguration state;
    private static final String[] HOUSES={"Fremen","Harkonnen","Corrino","Atreides","Ordos"};

    public Politics(JavaPlugin plugin, Map<UUID,String> factions, Economy economy, SharedDatabase database) {
        this.plugin=plugin; this.factions=factions; this.economy=economy;this.database=database;
        file=new File(plugin.getDataFolder(),"politics.yml");
        state=YamlConfiguration.loadConfiguration(file);
        refresh();
    }
    private long week() { return Instant.now().truncatedTo(ChronoUnit.DAYS).getEpochSecond()/604800; }
    private void refresh(){
        if(database==null)return;
        try{
            YamlConfiguration latest=new YamlConfiguration();
            latest.loadFromString(database.loadPolitics());
            for(String key:new HashSet<>(state.getKeys(false)))state.set(key,null);
            for(String key:latest.getKeys(false))state.set(key,latest.get(key));
        }catch(Exception e){plugin.getLogger().severe("Politics refresh failed: "+e.getMessage());}
    }
    private void save() {
        try {
            if(database!=null)database.savePolitics(state.saveToString());
            else state.save(file);
        }catch(Exception e){plugin.getLogger().warning("Politics save failed: "+e.getMessage());}
    }
    private boolean house(String h) { return Arrays.stream(HOUSES).anyMatch(x->x.equalsIgnoreCase(h)); }
    private String canon(String h) { return Arrays.stream(HOUSES).filter(x->x.equalsIgnoreCase(h)).findFirst().orElse(null); }
    private String faction(Player p) { return factions.getOrDefault(p.getUniqueId(),""); }
    private void msg(CommandSender s,String text) { s.sendMessage(ChatColor.GOLD+"[Dune Politics] "+ChatColor.WHITE+text); }
    public synchronized int levy(UUID player,int gross) {
        refresh();
        if (gross<=0) return 0;
        int fee=levyAmount(gross);
        state.set("trust",state.getLong("trust")+fee); save();
        return fee;
    }
    public int levyAmount(int gross) {
        double rate = Math.max(0, Math.min(1, plugin.getConfig().getDouble("politics.trust-levy", 0.0121)));
        return (int) Math.ceil(Math.max(0, gross) * rate);
    }
    /** The appointments expire automatically when a new election week or Emperor changes. */
    private boolean appointed(String key,String house) {
        refresh();
        String emperorId=winnerId("votes.emperor."+week());
        return !emperorId.isBlank()
            && state.getLong("appointments."+key+".week",-1)==week()
            && emperorId.equals(state.getString("appointments."+key+".emperor",""))
            && house.equalsIgnoreCase(state.getString("appointments."+key+".house",""));
    }
    public synchronized boolean isSpiceSteward(String house) { return appointed("steward",house); }
    public synchronized boolean isHouseOfWater(String house) { return appointed("water",house); }
    public synchronized boolean isAuthorizedSpice(String house) { return isSpiceSteward(house); }
    public synchronized boolean isAuthorizedWater(String house) { return isHouseOfWater(house); }
    public synchronized boolean freeArrakis(String house) {
        refresh();
        return (isSpiceSteward(house) || isHouseOfWater(house))
            && house.equalsIgnoreCase(state.getString("edict.arrakis.house",""));
    }
    public synchronized boolean command(Player p,String[] args) {
        refresh();
        if(args.length<2) { msg(p,"/dune politics status|deposit <amount>|vote <player>|emperorvote <player>|leader|invasion <house>|defend|steward <house>|houseofwater <house>"); return true; }
        String house=faction(p), op=args[1].toLowerCase(Locale.ROOT);
        if(op.equals("status")) {
            msg(p,"Spacing Trust: "+state.getLong("trust")+" Solaris | Election week: "+week());
            msg(p,"Your faction: "+house+" | Leader: "+leader(house)+" | Emperor: "+emperor());
            msg(p,"Steward of Dune: "+state.getString("appointments.steward.house","none")+" | House of Water: "+state.getString("appointments.water.house","none"));
            msg(p,"Active invasion: "+state.getString("invasion.attacker","none")+" -> "+state.getString("invasion.defender","none"));
            return true;
        }
        if(!house(house)) { msg(p,"Select a playable faction first."); return true; }
        if(op.equals("deposit")) {
            if(args.length<3) {msg(p,"Usage: /dune politics deposit <solaris>");return true;}
            int amount;
            try {amount=Integer.parseInt(args[2]);} catch(NumberFormatException e){msg(p,"Invalid amount.");return true;}
            if(amount<=0 || !economy.has(p,amount)){msg(p,"Insufficient Solaris.");return true;}
            economy.withdrawPlayer(p,amount);
            state.set("trust",state.getLong("trust")+amount); save();
            msg(p,"Deposited "+amount+" Solaris into the Spacing Trust.");return true;
        }
        if(op.equals("leader")) {msg(p,"Elected "+house+" leader: "+leader(house));return true;}
        if(op.equals("vote") || op.equals("emperorvote")) {
            if(args.length<3){msg(p,"Specify an ONLINE candidate name.");return true;}
            Player candidate=plugin.getServer().getPlayerExact(args[2]);
            if(candidate==null || !house(faction(candidate))) {msg(p,"Candidate must be online and have a faction.");return true;}
            if(op.equals("vote") && !house.equalsIgnoreCase(faction(candidate))) {msg(p,"Faction candidates must belong to your house.");return true;}
            String prefix=op.equals("vote")?"votes.house."+week()+"."+house:"votes.emperor."+week();
            String ballot=prefix+".ballots."+p.getUniqueId();
            if(state.contains(ballot)){msg(p,"You already voted in this election.");return true;}
            state.set(ballot,candidate.getUniqueId().toString());
            String tally=prefix+".tally."+candidate.getUniqueId();
            state.set(tally,state.getInt(tally)+1);
            state.set(prefix+".names."+candidate.getUniqueId(),candidate.getName());
            save(); msg(p,"Vote recorded for "+candidate.getName()+".");return true;
        }
        if(op.equals("invasion")) {
            if(!p.getUniqueId().toString().equals(winnerId("votes.house."+week()+"."+house))) {msg(p,"Only this week's elected leader may invade.");return true;}
            if(args.length<3 || canon(args[2])==null || house.equalsIgnoreCase(args[2])) {msg(p,"Specify another playable faction.");return true;}
            int cost=plugin.getConfig().getInt("politics.invasion-cost",50000);
            if(state.getLong("trust")<cost){msg(p,"Spacing Trust requires "+cost+" Solaris.");return true;}
            if(state.getLong("invasion.until",0)>System.currentTimeMillis()){msg(p,"An invasion is already active.");return true;}
            state.set("trust",state.getLong("trust")-cost);
            state.set("invasion.attacker",house);state.set("invasion.defender",canon(args[2]));
            state.set("invasion.until",System.currentTimeMillis()+plugin.getConfig().getLong("politics.invasion-minutes",60)*60000L);
            state.set("invasion.defenses",0);save();
            plugin.getServer().broadcastMessage(ChatColor.RED+"INVASION: "+house+" attacks "+canon(args[2])+"! Defenders: /dune politics defend");
            return true;
        }
        if(op.equals("defend")) {
            if(state.getLong("invasion.until",0)<=System.currentTimeMillis() || !house.equalsIgnoreCase(state.getString("invasion.defender",""))) {msg(p,"Your house has no active defense.");return true;}
            String key="invasion.defenders."+p.getUniqueId();
            if(state.getBoolean(key)){msg(p,"You have already contributed to this defense.");return true;}
            state.set(key,true);int defenses=state.getInt("invasion.defenses")+1;state.set("invasion.defenses",defenses);
            if(defenses>=plugin.getConfig().getInt("politics.defenders-needed",5)) {
                plugin.getServer().broadcastMessage(ChatColor.GREEN+house+" has repelled the invasion!");
                state.set("invasion.until",0);
                state.set("invasion.defenders",null);
            }
            save();msg(p,"Defense contribution registered ("+defenses+").");return true;
        }
        if(op.equals("steward") || op.equals("houseofwater")) {
            String emperorId=winnerId("votes.emperor."+week());
            if(emperorId.isBlank() || !p.getUniqueId().toString().equals(emperorId)) {
                msg(p,"Only the elected Emperor can appoint houses.");return true;
            }
            if(args.length<3 || canon(args[2])==null) {
                msg(p,"Choose a playable faction.");return true;
            }
            String key=op.equals("steward")?"steward":"water";
            String root="appointments."+key;
            if(state.getLong(root+".week",-1)==week() && emperorId.equals(state.getString(root+".emperor",""))) {
                msg(p,"This appointment has already been made during your term.");return true;
            }
            state.set(root+".house",canon(args[2]));
            state.set(root+".week",week());
            state.set(root+".emperor",emperorId);
            save();
            plugin.getServer().broadcastMessage(ChatColor.LIGHT_PURPLE+"IMPERIAL APPOINTMENT: "+canon(args[2])+
                (key.equals("steward")?" is now Steward of Dune (legal spice rights).":" is now House of Water (legal water rights)."));
            return true;
        }
        msg(p,"Unknown politics command.");return true;
    }
    private String winnerId(String prefix) {
        String path=prefix+".tally";
        if(state.getConfigurationSection(path)==null)return "";
        String best="";int score=0;
        for(String id:state.getConfigurationSection(path).getKeys(false)) {
            int n=state.getInt(path+"."+id);
            if(n>score || (n==score && id.compareTo(best)<0)){best=id;score=n;}
        }
        return best;
    }
    private String winnerName(String prefix) {
        String id=winnerId(prefix);
        return id.isEmpty()?"Not elected":state.getString(prefix+".names."+id,id);
    }
    public String leader(String house) {refresh();return winnerName("votes.house."+week()+"."+house);}
    public String emperor() {refresh();return winnerName("votes.emperor."+week());}
}

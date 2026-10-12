package com.example.dunerealms;

import org.bukkit.block.Biome;
import org.bukkit.generator.BiomeProvider;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.command.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.entity.EntityTargetLivingEntityEvent;
import org.bukkit.event.entity.EntityTeleportEvent;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeModifier;
import org.bukkit.inventory.EquipmentSlotGroup;
import org.bukkit.inventory.meta.Damageable;
import org.bukkit.inventory.meta.ArmorMeta;
import org.bukkit.inventory.meta.trim.ArmorTrim;
import org.bukkit.inventory.meta.trim.TrimMaterial;
import org.bukkit.inventory.meta.trim.TrimPattern;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.block.Action;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.*;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.generator.WorldInfo;
import org.bukkit.generator.LimitedRegion;
import org.bukkit.generator.BlockPopulator;
import org.bukkit.util.noise.SimplexOctaveGenerator;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;

public final class DuneRealms extends JavaPlugin implements Listener, CommandExecutor {
    private final String[] planets = {"arrakis", "giedi_prime", "kaitain", "caladan", "sigma_draconis_iv"};
    private final String[] factions = {"Fremen", "Harkonnen", "Corrino", "Atreides", "Ordos"};
    private final Map<UUID, String> selected = new HashMap<>();
    private final Map<UUID, Integer> money = new HashMap<>();
    private NamespacedKey itemKey, npcKey, wormKey, armorFactionKey;
    private File dataFile;
    private final Map<UUID, Job> jobs = new HashMap<>();
    private final Map<UUID, UUID> activeWorkers = new HashMap<>();
    private record Job(UUID owner, int quota, int harvested) {}
    private YamlConfiguration data;
    private ServerJobs serverJobs;
    private final Map<UUID, Integer> sunExposureSeconds = new HashMap<>();
    private ConfigurableGui gui;
    private Politics politics;
    private SharedDatabase sharedDatabase;
    public SharedDatabase sharedDatabase(){return sharedDatabase;}
    public String factionOf(Player player){return selected.getOrDefault(player.getUniqueId(),"");}
    public Map<UUID,Integer> walletMap(){return money;}
    public void persistPlayers(){savePlayers();}
    private ArrakisWater arrakisWater;

    @Override public void onEnable() {
        saveDefaultConfig(); itemKey = new NamespacedKey(this, "item"); npcKey = new NamespacedKey(this, "guild"); wormKey = new NamespacedKey(this, "sandworm"); armorFactionKey = new NamespacedKey(this, "armor_faction");
        dataFile = new File(getDataFolder(), "players.yml"); data = YamlConfiguration.loadConfiguration(dataFile);
        for (String key : data.getKeys(false)) try {
            UUID id = UUID.fromString(key); selected.put(id, data.getString(key + ".faction", "")); money.put(id, data.getInt(key + ".solaris", 0));
        } catch (IllegalArgumentException ignored) { }
        for (String id : data.getConfigurationSection("jobs") == null ? Set.<String>of() : data.getConfigurationSection("jobs").getKeys(false)) {
            try {
                UUID owner = UUID.fromString(id);
                int quota = data.getInt("jobs." + id + ".quota");
                int harvested = data.getInt("jobs." + id + ".harvested");
                if (quota > harvested) jobs.put(owner, new Job(owner, quota, harvested));
            } catch (IllegalArgumentException ignored) {}
        }
        if (!getConfig().getBoolean("network.enabled", true)) {
        for (String name : planets) {
            WorldCreator creator = new WorldCreator(name).environment(World.Environment.NORMAL).generator(new PlanetGenerator(name));
            World world = Bukkit.createWorld(creator);
            if (world != null) { world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, !name.equals("arrakis")); world.setTime(name.equals("giedi_prime") ? 18000 : 6000); }
        }
        } else {
            String localPlanet = getConfig().getString("network.local-planet", "arrakis");
            if (!Arrays.asList(planets).contains(localPlanet)) throw new IllegalStateException("Invalid network.local-planet: " + localPlanet);
            Bukkit.createWorld(new WorldCreator(localPlanet).environment(World.Environment.NORMAL).generator(new PlanetGenerator(localPlanet)));
            getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");
        }
        if(getConfig().getBoolean("database.enabled",false)) {
            try { sharedDatabase=new SharedDatabase(this); }
            catch(Exception ex){getLogger().severe("Shared database required but unavailable: "+ex.getMessage());getServer().getPluginManager().disablePlugin(this);return;}
        }
        politics = new Politics(this, selected, money, this::savePlayers, sharedDatabase);
        arrakisWater = new ArrakisWater(this,money,this::savePlayers,politics);
        Bukkit.getPluginManager().registerEvents(arrakisWater,this);
        serverJobs = new ServerJobs(this, money, this::savePlayers);
        serverJobs.load();
        Bukkit.getScheduler().runTaskTimer(this, this::checkArrakisSun, 20L, 20L);
        Bukkit.getScheduler().runTaskTimer(this, this::applyFactionSetEffects, 20L, 20L);
        gui = new ConfigurableGui(this, serverJobs, money, jobs, planets, factions, selected);
        Objects.requireNonNull(getCommand("dune")).setExecutor(this);
        Bukkit.getPluginManager().registerEvents(this, this);
        Bukkit.getScheduler().runTaskTimer(this, this::spawnSandworms, 200L, 200L);
        getLogger().info("DuneRealms enabled. Four worlds and Arrakis sandworms ready.");
    }
    @Override public void onDisable() { if(serverJobs!=null)serverJobs.save(); savePlayers(); }
    private void savePlayers() {
        if(sharedDatabase!=null){
            for(Player player:Bukkit.getOnlinePlayers())try{sharedDatabase.savePlayer(player,selected,money);}
            catch(Exception ex){getLogger().severe("Shared save failed for "+player.getName()+": "+ex.getMessage());}
            return;
        }
        for (UUID id : money.keySet()) { data.set(id + ".solaris", money.get(id)); data.set(id + ".faction", selected.getOrDefault(id, "")); }
        data.set("jobs", null);
        for (Job job : jobs.values()) {
            data.set("jobs." + job.owner() + ".quota", job.quota());
            data.set("jobs." + job.owner() + ".harvested", job.harvested());
        }
        try { data.save(dataFile); } catch (IOException ex) { getLogger().warning("Cannot save players: " + ex.getMessage()); }
    }
    private ItemStack custom(Material material, String name, String id) {
        ItemStack item = new ItemStack(material); ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(ChatColor.GOLD + name); meta.getPersistentDataContainer().set(itemKey, PersistentDataType.STRING, id);
        item.setItemMeta(meta); return item;
    }
    private boolean is(ItemStack item, String id) { return item != null && item.hasItemMeta() && id.equals(item.getItemMeta().getPersistentDataContainer().get(itemKey, PersistentDataType.STRING)); }
    private ItemStack menuItem() {
        ItemStack item = custom(Material.NETHER_STAR, "Dune Navigator", "menu_opener");
        ItemMeta meta = item.getItemMeta();
        meta.setLore(List.of(ChatColor.YELLOW + "Left or right click to open DuneRealms"));
        item.setItemMeta(meta);
        return item;
    }
    private void giveMenuItem(Player p) {
        for (ItemStack item : p.getInventory().getContents()) if (is(item, "menu_opener")) return;
        Map<Integer, ItemStack> leftover = p.getInventory().addItem(menuItem());
        if (!leftover.isEmpty()) p.sendMessage(ChatColor.RED + "Your inventory is full. Use /dune menuitem later.");
    }
    @EventHandler public void onMenuItemUse(PlayerInteractEvent event) {
        if (event.getHand() != EquipmentSlot.HAND) return;
        Action action = event.getAction();
        if (action != Action.RIGHT_CLICK_AIR && action != Action.RIGHT_CLICK_BLOCK
            && action != Action.LEFT_CLICK_AIR && action != Action.LEFT_CLICK_BLOCK) return;
        if (!is(event.getItem(), "menu_opener")) return;
        event.setCancelled(true);
        gui.open(event.getPlayer(), "main");
    }
    private Color factionArmorColor(String faction) {
        return switch (faction.toLowerCase(Locale.ROOT)) {
            case "harkonnen" -> Color.fromRGB(190, 35, 45);
            case "fremen" -> Color.fromRGB(235, 125, 25);
            case "ordos" -> Color.fromRGB(45, 155, 75);
            case "spacing_guild", "guild" -> Color.fromRGB(20, 20, 20);
            case "atreides" -> Color.fromRGB(45, 105, 210);
            case "corrino" -> Color.fromRGB(135, 65, 180);
            default -> Color.fromRGB(95, 83, 67);
        };
    }
    private void checkArrakisSun() {
        if (!getConfig().getBoolean("arrakis-sun.enabled", true)) return;
        int lethalSeconds = Math.max(1, getConfig().getInt("arrakis-sun.lethal-seconds", 300));
        int warningInterval = Math.max(1, getConfig().getInt("arrakis-sun.warning-interval-seconds", 30));
        for (Player player : Bukkit.getOnlinePlayers()) {
            UUID id = player.getUniqueId();
            boolean exposed = player.getWorld().getName().equalsIgnoreCase("arrakis")
                && player.getGameMode() != GameMode.CREATIVE
                && player.getGameMode() != GameMode.SPECTATOR
                && !player.isDead()
                && !wearingStillsuit(player)
                && player.getWorld().isClearWeather()
                && player.getWorld().getTime() < 12300
                && player.getWorld().getHighestBlockYAt(player.getLocation()) <= player.getLocation().getBlockY();
            if (!exposed) {
                // Taking shelter, reaching night, or putting on a stillsuit resets exposure.
                if (sunExposureSeconds.remove(id) != null) player.setFireTicks(0);
                continue;
            }
            int seconds = sunExposureSeconds.merge(id, 1, Integer::sum);
            // The visible burning effect is cosmetic until the exposure timer expires.
            player.setFireTicks(Math.max(player.getFireTicks(), 40));
            // Cancel fire damage from this cosmetic effect in the dedicated damage listener.
            if (seconds == 1 || seconds % warningInterval == 0) {
                player.sendMessage(ChatColor.RED + "Arrakis sun exposure: " +
                    Math.max(0, lethalSeconds - seconds) + " seconds until fatal heatstroke! Find shade or wear a stillsuit.");
            }
            if (seconds >= lethalSeconds) {
                sunExposureSeconds.remove(id);
                player.setHealth(0.0);
            }
        }
    }
    @EventHandler public void onSunDamage(org.bukkit.event.entity.EntityDamageEvent event) {
        if (!(event.getEntity() instanceof Player player)) return;
        if (event.getCause() != org.bukkit.event.entity.EntityDamageEvent.DamageCause.FIRE_TICK) return;
        if (sunExposureSeconds.containsKey(player.getUniqueId())) event.setCancelled(true);
    }
    private void applyNetheriteStats(ItemMeta meta, String piece) {
        // Match vanilla netherite armor points, toughness and knockback resistance.
        double armor = switch(piece) {
            case "HELMET" -> 3.0;
            case "CHESTPLATE" -> 8.0;
            case "LEGGINGS" -> 6.0;
            default -> 3.0;
        };
        EquipmentSlotGroup slot = switch(piece) {
            case "HELMET" -> EquipmentSlotGroup.HEAD;
            case "CHESTPLATE" -> EquipmentSlotGroup.CHEST;
            case "LEGGINGS" -> EquipmentSlotGroup.LEGS;
            default -> EquipmentSlotGroup.FEET;
        };
        meta.addAttributeModifier(Attribute.ARMOR,
            new AttributeModifier(new NamespacedKey(this,"stillsuit_armor_"+piece.toLowerCase(Locale.ROOT)),
                armor, AttributeModifier.Operation.ADD_NUMBER, slot));
        meta.addAttributeModifier(Attribute.ARMOR_TOUGHNESS,
            new AttributeModifier(new NamespacedKey(this,"stillsuit_toughness_"+piece.toLowerCase(Locale.ROOT)),
                3.0, AttributeModifier.Operation.ADD_NUMBER, slot));
        meta.addAttributeModifier(Attribute.KNOCKBACK_RESISTANCE,
            new AttributeModifier(new NamespacedKey(this,"stillsuit_knockback_"+piece.toLowerCase(Locale.ROOT)),
                0.1, AttributeModifier.Operation.ADD_NUMBER, slot));
    }
    private void mergeElytra(Player p) {
        final int price=1_000_000;
        if(money.getOrDefault(p.getUniqueId(),0)<price) {
            p.sendMessage(ChatColor.RED+"You need 1,000,000 Solaris."); return;
        }
        ItemStack chest=p.getInventory().getChestplate();
        if(chest==null || chest.getType()!=Material.LEATHER_CHESTPLATE || !is(chest,"stillsuit")) {
            p.sendMessage(ChatColor.RED+"Wear your faction stillsuit chestplate first."); return;
        }
        int elytraSlot=-1;
        for(int i=0;i<p.getInventory().getStorageContents().length;i++) {
            ItemStack candidate=p.getInventory().getItem(i);
            if(candidate!=null && candidate.getType()==Material.ELYTRA) { elytraSlot=i; break; }
        }
        if(elytraSlot<0) { p.sendMessage(ChatColor.RED+"Carry an Elytra in your inventory."); return; }
        ItemStack winged=new ItemStack(Material.ELYTRA);
        ItemMeta meta=winged.getItemMeta();
        String faction=selected.getOrDefault(p.getUniqueId(),"Fremen");
        meta.setDisplayName(ChatColor.GOLD+faction+" Winged Stillsuit");
        meta.setLore(List.of(ChatColor.LIGHT_PURPLE+"Elytra flight + netherite-level chest protection",
            ChatColor.GRAY+"Upgraded for 1,000,000 Solaris"));
        meta.getPersistentDataContainer().set(itemKey,PersistentDataType.STRING,"stillsuit");
        meta.getPersistentDataContainer().set(armorFactionKey,PersistentDataType.STRING,faction.toLowerCase(Locale.ROOT));
        applyNetheriteStats(meta,"CHESTPLATE");
        winged.setItemMeta(meta);
        p.getInventory().setItem(elytraSlot,null);
        p.getInventory().setChestplate(winged);
        money.merge(p.getUniqueId(),-price,Integer::sum);
        savePlayers();
        p.sendMessage(ChatColor.GREEN+"Elytra merged with your stillsuit! Paid 1,000,000 Solaris.");
    }
    private void applyFactionTrim(ItemMeta meta, String faction) {
        if (!(meta instanceof ArmorMeta armorMeta)) return;
        // One distinct vanilla trim pattern per faction, with contrasting trim colors.
        TrimPattern pattern;
        TrimMaterial material;
        switch (faction.toLowerCase(Locale.ROOT)) {
            case "harkonnen" -> { pattern = TrimPattern.RIB; material = TrimMaterial.DIAMOND; }
            case "ordos" -> { pattern = TrimPattern.SENTRY; material = TrimMaterial.REDSTONE; }
            case "atreides" -> { pattern = TrimPattern.COAST; material = TrimMaterial.COPPER; }
            case "corrino" -> { pattern = TrimPattern.SPIRE; material = TrimMaterial.GOLD; }
            case "fremen" -> { pattern = TrimPattern.DUNE; material = TrimMaterial.LAPIS; }
            case "spacing_guild", "guild" -> { pattern = TrimPattern.EYE; material = TrimMaterial.QUARTZ; }
            default -> { pattern = TrimPattern.DUNE; material = TrimMaterial.LAPIS; }
        }
        armorMeta.setTrim(new ArmorTrim(material, pattern));
    }
    private void kit(Player p) {
        String faction = selected.getOrDefault(p.getUniqueId(), "Fremen");
        Color armorColor = factionArmorColor(faction);
        ItemStack shovel=custom(Material.NETHERITE_SHOVEL,"Spice Harvest Shovel","shovel");
        shovel.addUnsafeEnchantment(Enchantment.EFFICIENCY,5);
        shovel.addUnsafeEnchantment(Enchantment.UNBREAKING,3);
        p.getInventory().addItem(shovel);
        for (Material m : new Material[]{Material.LEATHER_HELMET, Material.LEATHER_CHESTPLATE, Material.LEATHER_LEGGINGS, Material.LEATHER_BOOTS}) {
            ItemStack armor = custom(m, "Stillsuit " + m.name().toLowerCase(Locale.ROOT), "stillsuit");
            org.bukkit.inventory.meta.LeatherArmorMeta meta = (org.bukkit.inventory.meta.LeatherArmorMeta) armor.getItemMeta();
            meta.setColor(armorColor);
            meta.setDisplayName(ChatColor.GOLD + faction + " Stillsuit " + m.name().replace("LEATHER_", "").toLowerCase(Locale.ROOT));
            applyNetheriteStats(meta,m.name().replace("LEATHER_",""));
            applyFactionTrim(meta,faction);
            meta.getPersistentDataContainer().set(armorFactionKey,PersistentDataType.STRING,faction.toLowerCase(Locale.ROOT));
            if(faction.equalsIgnoreCase("Fremen")) {
                meta.addEnchant(Enchantment.UNBREAKING,3,true);
                if(m==Material.LEATHER_LEGGINGS)meta.addEnchant(Enchantment.SWIFT_SNEAK,3,true);
            }
            if(faction.equalsIgnoreCase("Corrino"))meta.addEnchant(Enchantment.PROTECTION,3,true);
            armor.setItemMeta(meta);
            p.getInventory().addItem(armor);
        }
    }
    private String fullSetFaction(Player player) {
        String faction=selected.getOrDefault(player.getUniqueId(),"").toLowerCase(Locale.ROOT);
        if(faction.isEmpty())return "";
        ItemStack[] armor=player.getInventory().getArmorContents();
        if(armor.length!=4)return "";
        for(ItemStack piece:armor) {
            if(!is(piece,"stillsuit"))return "";
            String tagged=piece.getItemMeta().getPersistentDataContainer().get(armorFactionKey,PersistentDataType.STRING);
            if(!faction.equals(tagged))return "";
        }
        // The chest slot may hold either the stillsuit chestplate or a merged winged stillsuit.
        return faction;
    }
    private void applyFactionSetEffects() {
        for(Player p:Bukkit.getOnlinePlayers()) {
            String faction=fullSetFaction(p);
            if(faction.equals("harkonnen"))
                p.addPotionEffect(new PotionEffect(PotionEffectType.STRENGTH,25,1,true,false,true));
            // No permanent potion refresh: the attribute is removed immediately when the set breaks.
            var health=p.getAttribute(Attribute.MAX_HEALTH);
            if(health!=null) {
                NamespacedKey key=new NamespacedKey(this,"atreides_full_set_hearts");
                AttributeModifier existing=null;
                for(AttributeModifier modifier:health.getModifiers())
                    if(modifier.getKey().equals(key)){existing=modifier;break;}
                if(existing!=null && !faction.equals("atreides")) {
                    health.removeModifier(existing);
                    if(p.getHealth()>health.getValue())p.setHealth(health.getValue());
                } else if(existing==null && faction.equals("atreides"))
                    health.addModifier(new AttributeModifier(key,8.0,AttributeModifier.Operation.ADD_NUMBER));
            }
        }
    }
    @EventHandler public void onOrdosPearl(org.bukkit.event.player.PlayerInteractEvent e) {
        Player p=e.getPlayer();
        if(!fullSetFaction(p).equals("ordos"))return;
        if(e.getHand()!=EquipmentSlot.HAND)return;
        if(e.getAction()!=Action.RIGHT_CLICK_AIR && e.getAction()!=Action.RIGHT_CLICK_BLOCK)return;
        ItemStack held=e.getItem();
        if(held==null||held.getType()!=Material.ENDER_PEARL)return;
        // Trigger on activation; vanilla pearl throw remains intact.
        p.addPotionEffect(new PotionEffect(PotionEffectType.INVISIBILITY,100,0,true,false,true));
        p.sendMessage(ChatColor.DARK_GREEN+"Shadow Step: invisible for five seconds.");
    }
    private boolean wearingStillsuit(Player p) {
        for (ItemStack armor : p.getInventory().getArmorContents()) if (!is(armor, "stillsuit")) return false;
        return true;
    }
    private boolean emperorSanctioned(Player p,String planet) {
        return planet.equalsIgnoreCase("arrakis") && politics.isSpiceSteward(selected.getOrDefault(p.getUniqueId(),""));
    }
    public void reportSmuggling(Player p,String commodity,int bounty) {
        if(sharedDatabase==null){p.sendMessage(ChatColor.RED+"Smuggling bounty unavailable without shared PostgreSQL.");return;}
        try {
            sharedDatabase.issueBounty(p.getUniqueId(),p.getWorld().getName(),Math.max(1,bounty));
            for(Player witness:p.getWorld().getPlayers())
                witness.sendMessage(ChatColor.RED+commodity+" SMUGGLING: "+p.getName()+
                    " is wanted! Bounty: "+Math.max(1,bounty)+" Solaris.");
        }catch(Exception ex){getLogger().severe("Smuggling bounty failure: "+ex.getMessage());}
    }
    private void checkArrakisArrival(Player p) {
        if(!p.getWorld().getName().equalsIgnoreCase("arrakis"))return;
        if(sharedDatabase==null){getLogger().warning("Arrakis smuggler arrival enforcement requires PostgreSQL.");return;}
        try {
            if(politics.isSpiceSteward(selected.getOrDefault(p.getUniqueId(),"")))return;
            if(sharedDatabase.consumeArrakisPermit(p.getUniqueId()))return;
            int bounty=Math.max(1,(int)Math.round(Math.max(1,getConfig().getInt("spice-sell-price",100)/2.0)*1.45));
            sharedDatabase.issueBounty(p.getUniqueId(),"arrakis",bounty);
            for(Player local:p.getWorld().getPlayers())local.sendMessage(ChatColor.RED+
                "UNSANCTIONED ARRIVAL ON ARRAKIS: "+p.getName()+" is wanted for smuggling! Bounty: "+bounty+" Solaris.");
            p.sendMessage(ChatColor.RED+"Your arrival was not sanctioned by the Emperor. You are wanted on Arrakis!");
        }catch(Exception ex){getLogger().severe("Arrakis travel authorization failed: "+ex.getMessage());p.kickPlayer("Arrival authorization unavailable. Please reconnect.");}
    }
    private void teleport(Player p, String planet) {
        if (!Arrays.asList(planets).contains(planet)) { p.sendMessage(ChatColor.RED + "Unknown planet."); return; }
        if (getConfig().getBoolean("network.enabled", true)) {
            String local = getConfig().getString("network.local-planet", "arrakis");
            if (planet.equals(local)) { p.sendMessage(ChatColor.YELLOW + "You are already on " + planet); return; }
            String target = getConfig().getString("network.servers." + planet);
            if (target == null || target.isBlank()) { p.sendMessage(ChatColor.RED + "Planet server not configured."); return; }
            try {
                // Only the current Steward of Dune has legal spice travel privileges.
                if(emperorSanctioned(p,planet)) {
                    if(sharedDatabase==null){p.sendMessage(ChatColor.RED+"Emperor-sanctioned travel requires shared database.");return;}
                    
try {
    sharedDatabase.issueArrakisPermit(
        p.getUniqueId(),
        System.currentTimeMillis() + 120000L
    );
} catch (java.sql.SQLException e) {
    getLogger().log(
        java.util.logging.Level.SEVERE,
        "Failed to issue Arrakis travel permit for " + p.getName(),
        e
    );
    p.sendMessage(
        ChatColor.RED + "Unable to authorize Arrakis travel. Please try again."
    );
    return true;
}

                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                DataOutputStream data = new DataOutputStream(bytes);
                data.writeUTF("Connect"); data.writeUTF(target);
                p.sendPluginMessage(this, "BungeeCord", bytes.toByteArray());
                p.sendMessage(ChatColor.AQUA + "Spacing Guild transfer requested: " + planet);
            } catch (IOException ex) { getLogger().warning("Proxy transfer failed: " + ex.getMessage()); }
            return;
        }
        World w = Bukkit.getWorld(planet); if (w == null) { p.sendMessage("World unavailable."); return; }
        int y = w.getHighestBlockYAt(0, 0) + 2;
        p.teleport(new Location(w, 0.5, Math.max(y, 66), 0.5));
        if(planet.equals("arrakis"))Bukkit.getScheduler().runTaskLater(this,()->checkArrakisArrival(p),1L);
        p.sendMessage(ChatColor.AQUA + "Spacing Guild arrival: " + planet);
    }
    private boolean isLocalPlanet(String planet) {
        return !getConfig().getBoolean("network.enabled", true)
            || planet.equals(getConfig().getString("network.local-planet", "arrakis"));
    }
    private void travelMenu(Player p) {
        Inventory inv = Bukkit.createInventory(null, 9, "Spacing Guild Travel");
        for (int i = 0; i < planets.length; i++) inv.setItem(i, custom(Material.ENDER_PEARL, planets[i] + " - " + getConfig().getInt("travel-price") + " Solaris", "travel:" + planets[i]));
        p.openInventory(inv);
    }
    @Override public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player p)) { sender.sendMessage("Run this command in-game."); return true; }
        if (args.length == 0) { gui.open(p, "main"); return true; }
        if (args[0].equalsIgnoreCase("help")) {
            p.sendMessage(ChatColor.GOLD + "/dune choose <fremen|harkonnen|corrino|atreides>, kit, balance, sell, water, travel, politics, exchange, serverjobs, serverjobs accept <id>, job post <spice>, job accept <player>, job finish, guildnpc (admin)"); return true;
        }
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "choose" -> {
                if (args.length < 2) { p.sendMessage("Choose a faction name."); break; }
                String choice = args[1];
                String match = Arrays.stream(factions).filter(f -> f.equalsIgnoreCase(choice)).findFirst().orElse(null);
                if (match == null) { p.sendMessage("Unknown faction."); break; }
                if (selected.containsKey(p.getUniqueId()) && !selected.get(p.getUniqueId()).isEmpty() && !p.hasPermission("dune.admin")) { p.sendMessage("Faction already selected."); break; }
                selected.put(p.getUniqueId(), match); money.putIfAbsent(p.getUniqueId(), 0); savePlayers(); kit(p); teleport(p, planets[Arrays.asList(factions).indexOf(match)]);
                p.sendMessage(ChatColor.GREEN + "You joined " + match + "!");
            }
            case "elytra" -> mergeElytra(p);
            case "kit" -> { if (!selected.containsKey(p.getUniqueId())) { p.sendMessage("Choose a faction first."); break; } kit(p); }
            case "politics", "trust" -> politics.command(p, args);
            case "water" -> arrakisWater.command(p,args);
            case "balance" -> p.sendMessage(ChatColor.YELLOW + "Solaris: " + money.getOrDefault(p.getUniqueId(), 0));
            case "sell" -> {
                int amount = 0;
                for (ItemStack stack : p.getInventory().getStorageContents()) if (is(stack, "spice")) { amount += stack.getAmount(); stack.setAmount(0); }
                if(amount>0 && !politics.isAuthorizedSpice(selected.getOrDefault(p.getUniqueId(),""))) {
                    reportSmuggling(p,"SPICE",amount*getConfig().getInt("spice-sell-price"));
                }
                int gross = amount * getConfig().getInt("spice-sell-price"); int tax = politics.levy(p.getUniqueId(), gross); int earned = gross - tax; money.merge(p.getUniqueId(), earned, Integer::sum); savePlayers();
                p.sendMessage(ChatColor.GOLD + "Sold " + amount + " spice for " + earned + " Solaris ("+tax+" deposited into Spacing Trust).");
            }
            case "travel" -> travelMenu(p);
            case "menu", "gui" -> gui.open(p, "main");
            case "guireload" -> { if (p.hasPermission("dune.admin")) { gui.reload(); p.sendMessage("GUI configuration reloaded."); } else p.sendMessage("Admin only."); }
            case "menuitem" -> { giveMenuItem(p); p.sendMessage(ChatColor.GREEN + "Dune Navigator ready."); }
            case "exchange" -> gui.open(p, "exchange");
            case "serverjobs" -> serverJobs.command(p, args);
            case "job" -> jobCommand(p, args);
            case "guildnpc" -> {
                if (!p.hasPermission("dune.admin")) { p.sendMessage("Admin only."); break; }
                Villager v = p.getWorld().spawn(p.getLocation(), Villager.class); v.setCustomName(ChatColor.LIGHT_PURPLE + "Spacing Guild Navigator"); v.setCustomNameVisible(true);
                v.setProfession(Villager.Profession.CLERIC); v.setAI(false); v.getPersistentDataContainer().set(npcKey, PersistentDataType.BYTE, (byte)1);
            }
            case "givespice" -> { if (p.hasPermission("dune.admin")) p.getInventory().addItem(custom(Material.ORANGE_DYE, "Melange Spice", "spice")); }
            default -> p.sendMessage("Use /dune help");
        }
        return true;
    }
    void runGuiCommand(Player p, String command) {
        String[] args = command.trim().split("\\s+");
        if (args.length == 0 || args[0].isEmpty()) return;
        if (args[0].equalsIgnoreCase("travel") && args.length == 2) {
            String world = args[1].toLowerCase(Locale.ROOT);
            if (!Arrays.asList(planets).contains(world)) return;
            int cost = (world.equals("arrakis") && politics.isSpiceSteward(selected.getOrDefault(p.getUniqueId(),""))) ? 0 : getConfig().getInt("travel-price", 100);
            if (money.getOrDefault(p.getUniqueId(), 0) < cost) { p.sendMessage(ChatColor.RED+"Not enough Solaris."); return; }
            money.merge(p.getUniqueId(), -cost, Integer::sum);
            savePlayers(); teleport(p, world); return;
        }
        onCommand(p, Objects.requireNonNull(getCommand("dune")), "dune", args);
    }
    @EventHandler public void onGuiClick(InventoryClickEvent e) { gui.click(e); }
    @EventHandler public void onGuiDrag(org.bukkit.event.inventory.InventoryDragEvent e) { gui.drag(e); }
    private void showExchange(Player p) {
        p.sendMessage(ChatColor.GOLD + "=== Spice Exchange (15% worker / 85% sponsor) ===");
        if (jobs.isEmpty()) { p.sendMessage("No jobs listed. Use /dune job post <spice quota>."); return; }
        for (Job j : jobs.values()) {
            String name = Bukkit.getOfflinePlayer(j.owner()).getName();
           p.sendMessage(
    ChatColor.YELLOW.toString()
    + (name == null ? j.owner() : name)
    + ": "
    + (j.quota() - j.harvested())
    + " spice remaining; /dune job accept "
    + (name == null ? j.owner() : name)
);
        }
    }
    private void jobCommand(Player p, String[] args) {
        if (args.length < 2) { showExchange(p); return; }
        UUID id = p.getUniqueId();
        switch (args[1].toLowerCase(Locale.ROOT)) {
            case "post" -> {
                if (args.length < 3) { p.sendMessage("/dune job post <spice quota>"); return; }
                int quota;
                try { quota = Integer.parseInt(args[2]); } catch (NumberFormatException ex) { p.sendMessage("Enter a number."); return; }
                if (quota < 1 || quota > 100000) { p.sendMessage("Quota must be 1–100000."); return; }
                if (jobs.containsKey(id)) { p.sendMessage("Finish or cancel your current listing first."); return; }
                jobs.put(id, new Job(id, quota, 0)); savePlayers();
                p.sendMessage(ChatColor.GREEN + "Exchange listing posted for " + quota + " spice.");
            }
            case "cancel" -> {
                if (!jobs.containsKey(id)) { p.sendMessage("No listing to cancel."); return; }
                if (activeWorkers.containsValue(id)) { p.sendMessage("A worker has accepted your job."); return; }
                jobs.remove(id); savePlayers(); p.sendMessage("Listing cancelled.");
            }
            case "accept" -> {
                if (activeWorkers.containsKey(id)) { p.sendMessage("You already have a job."); return; }
                if (args.length < 3) { p.sendMessage("/dune job accept <player>"); return; }
                Job job = jobs.values().stream().filter(j -> {
                    String name = Bukkit.getOfflinePlayer(j.owner()).getName();
                    return j.owner().toString().equalsIgnoreCase(args[2]) || (name != null && name.equalsIgnoreCase(args[2]));
                }).findFirst().orElse(null);
                if (job == null || job.owner().equals(id)) { p.sendMessage("Invalid listing."); return; }
                if (activeWorkers.containsValue(job.owner())) { p.sendMessage("That job is already taken."); return; }
                activeWorkers.put(id, job.owner());
                p.sendMessage(ChatColor.GREEN + "Job accepted! Harvest spice on Arrakis. Earnings are automatically split 15/85.");
                teleport(p, "arrakis");
            }
            case "finish" -> {
                if (activeWorkers.remove(id) == null) { p.sendMessage("No active job."); return; }
                p.sendMessage("You left the spice job.");
            }
            default -> showExchange(p);
        }
    }
    @EventHandler(priority=org.bukkit.event.EventPriority.LOWEST) public void loadNetworkPlayer(PlayerJoinEvent e) {
        if(sharedDatabase==null)return;
        try{sharedDatabase.loadPlayer(e.getPlayer(),selected,money);
            if(getConfig().getString("network.local-planet","arrakis").equalsIgnoreCase("arrakis"))
                Bukkit.getScheduler().runTaskLater(this,()->{if(e.getPlayer().isOnline())checkArrakisArrival(e.getPlayer());},5L);
        }
        catch(Exception ex){getLogger().severe("Shared player load failed: "+ex.getMessage());e.getPlayer().kickPlayer("Your network profile could not be loaded.");}
    }
    @EventHandler public void onNetworkQuit(org.bukkit.event.player.PlayerQuitEvent e) {
        if(sharedDatabase!=null)try{sharedDatabase.savePlayer(e.getPlayer(),selected,money);}
        catch(Exception ex){getLogger().severe("Shared player save failed: "+ex.getMessage());}
    }
    @EventHandler public void onBountyKill(org.bukkit.event.entity.PlayerDeathEvent e) {
        Player victim=e.getEntity(), killer=victim.getKiller();
        if(killer==null||killer.equals(victim)||sharedDatabase==null)return;
        try {
            int reward=sharedDatabase.claimBounty(victim.getUniqueId(),killer.getUniqueId());
            if(reward>0){money.merge(killer.getUniqueId(),reward,Integer::sum);savePlayers();
                Bukkit.broadcastMessage(ChatColor.GOLD+killer.getName()+" claimed "+reward+" Solaris bounty on "+victim.getName()+"!");}
        }catch(Exception ex){getLogger().warning("Bounty claim failed: "+ex.getMessage());}
    }
    @EventHandler public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        Bukkit.getScheduler().runTask(this, () -> giveMenuItem(p));
        if (!selected.containsKey(p.getUniqueId()) || selected.get(p.getUniqueId()).isEmpty()) p.sendMessage(ChatColor.GOLD + "Choose your faction with /dune choose <fremen|harkonnen|corrino|atreides>.");
        else Bukkit.getScheduler().runTask(this, () -> {
            if (p.getWorld().getName().equals("world")) teleport(p, planets[Arrays.asList(factions).indexOf(selected.get(p.getUniqueId()))]);
        });
    }
    @EventHandler public void onRespawn(PlayerRespawnEvent e) {
        String faction = selected.get(e.getPlayer().getUniqueId());
        if (faction == null) return;
        int index = Arrays.asList(factions).indexOf(faction);
        if (index < 0) return;
        World w = Bukkit.getWorld(planets[index]);
        if (w != null) e.setRespawnLocation(new Location(w, 0.5, Math.max(66, w.getHighestBlockYAt(0,0)+2), 0.5));
    }
    @EventHandler public void onNpc(PlayerInteractEntityEvent e) {
        if (e.getRightClicked().getPersistentDataContainer().has(npcKey, PersistentDataType.BYTE)) { e.setCancelled(true); travelMenu(e.getPlayer()); }
    }
    @EventHandler public void onMenu(InventoryClickEvent e) {
        if (!e.getView().getTitle().equals("Spacing Guild Travel")) return;
        e.setCancelled(true); if (!(e.getWhoClicked() instanceof Player p)) return;
        ItemStack clicked = e.getCurrentItem(); if (clicked == null || !clicked.hasItemMeta()) return;
        String id = clicked.getItemMeta().getPersistentDataContainer().get(itemKey, PersistentDataType.STRING);
        if (id == null || !id.startsWith("travel:")) return;
        String planet = id.substring(7); int cost = getConfig().getInt("travel-price");
        if (money.getOrDefault(p.getUniqueId(), 0) < cost) { p.sendMessage(ChatColor.RED + "You need " + cost + " Solaris."); return; }
        money.merge(p.getUniqueId(), -cost, Integer::sum); savePlayers(); p.closeInventory(); teleport(p, planet);
    }
    @EventHandler public void onSpice(BlockBreakEvent e) {
        Block block = e.getBlock(); if (!block.getWorld().getName().equals("arrakis") || block.getType() != Material.RED_SAND) return;
        Player p = e.getPlayer(); if (!is(p.getInventory().getItemInMainHand(), "shovel") || !wearingStillsuit(p)) {
            e.setCancelled(true); p.sendMessage(ChatColor.RED + "Wear a full stillsuit and use a Netherite Spice Harvest Shovel to extract spice."); return;
        }
        e.setDropItems(false); e.setExpToDrop(0);
        int amount = selected.getOrDefault(p.getUniqueId(), "").equals("Fremen") ? 2 : 1;
        serverJobs.harvest(p, amount);
        UUID sponsor = activeWorkers.get(p.getUniqueId());
        if (sponsor != null) {
            Job job = jobs.get(sponsor);
            if (job == null) activeWorkers.remove(p.getUniqueId());
            else {
                int credited = Math.min(amount, job.quota() - job.harvested());
                int unitPrice = getConfig().getInt("spice-sell-price", 100);
                // Pay in whole Solaris with exact 15/85 split over accumulated earnings.
                int oldValue = job.harvested() * unitPrice;
                int newValue = (job.harvested() + credited) * unitPrice;
                int workerPay = (int)((newValue * 15L) / 100 - (oldValue * 15L) / 100);
                money.merge(p.getUniqueId(), workerPay, Integer::sum);
                money.merge(sponsor, credited * unitPrice - workerPay, Integer::sum);
                int progress = job.harvested() + credited;
                if (progress >= job.quota()) {
                    jobs.remove(sponsor); activeWorkers.remove(p.getUniqueId());
                    p.sendMessage(ChatColor.GREEN + "Spice contract completed!");
                } else jobs.put(sponsor, new Job(sponsor, job.quota(), progress));
                savePlayers();
                p.sendMessage(ChatColor.GOLD + "Job spice: +" + workerPay + " Solaris (15% share).");
                // Contract spice is sold automatically, not dropped as a second payout.
                if (credited == amount) return;
                amount -= credited;
            }
        }
        block.getWorld().dropItemNaturally(block.getLocation(), custom(Material.ORANGE_DYE, "Melange Spice", "spice").asQuantity(amount));
        Location loc = block.getLocation(); long delay = 20L * getConfig().getLong("spice-respawn-seconds", 120);
        Bukkit.getScheduler().runTaskLater(this, () -> { if (loc.getChunk().isLoaded() && loc.getBlock().getType() == Material.AIR) loc.getBlock().setType(Material.RED_SAND); }, delay);
    }
    private boolean isWorm(Entity entity) {
        return entity.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE);
    }
    private void spawnSandworms() {
        if (!getConfig().getBoolean("sandworms.enabled", true)) return;
        World world = Bukkit.getWorld("arrakis");
        if (world == null) return;
        int max = Math.max(0, getConfig().getInt("sandworms.max-per-world", 12));
        int count = (int) world.getEntitiesByClass(Husk.class).stream().filter(this::isWorm).count();
        Random rng = java.util.concurrent.ThreadLocalRandom.current();
        for (Player player : world.getPlayers()) {
            if (count >= max) break;
            if (rng.nextDouble() > getConfig().getDouble("sandworms.spawn-chance", 0.35)) continue;
            boolean nearby = world.getNearbyEntities(player.getLocation(), 48, 32, 48).stream().anyMatch(this::isWorm);
            if (nearby) continue;
            double angle = rng.nextDouble() * Math.PI * 2;
            int distance = 22 + rng.nextInt(19);
            int x = player.getLocation().getBlockX() + (int) (Math.cos(angle) * distance);
            int z = player.getLocation().getBlockZ() + (int) (Math.sin(angle) * distance);
            int y = world.getHighestBlockYAt(x, z);
            Material surface = world.getBlockAt(x, y, z).getType();
            if (surface != Material.SAND && surface != Material.RED_SAND) continue;
            Location location = new Location(world, x + 0.5, y + 1, z + 0.5);
            Husk worm = world.spawn(location, Husk.class, h -> {
                h.getPersistentDataContainer().set(wormKey, PersistentDataType.BYTE, (byte) 1);
                h.setCustomName(ChatColor.GOLD + "Shai-Hulud | Sandworm");
                h.setCustomNameVisible(true);
                h.setRemoveWhenFarAway(true);
                h.setAdult();
                h.setCanPickupItems(false);
                h.getAttribute(Attribute.MAX_HEALTH).setBaseValue(getConfig().getDouble("sandworms.health", 500.0));
                h.setHealth(h.getAttribute(Attribute.MAX_HEALTH).getValue());
                h.getAttribute(Attribute.ATTACK_DAMAGE).setBaseValue(getConfig().getDouble("sandworms.attack-damage", 30.0));
                h.getAttribute(Attribute.MOVEMENT_SPEED).setBaseValue(0.33);
                h.getAttribute(Attribute.SCALE).setBaseValue(3.5);
                h.setTarget(player);
            });
            world.spawnParticle(Particle.CLOUD, location, 45, 2, 1, 2, 0.1);
            world.playSound(location, Sound.ENTITY_WARDEN_ROAR, 2f, 0.6f);
            count++;
        }
    }
    @EventHandler public void onWormTarget(EntityTargetLivingEntityEvent e) {
        if (isWorm(e.getEntity()) && (!(e.getTarget() instanceof Player) || !e.getEntity().getWorld().getName().equals("arrakis"))) e.setCancelled(true);
    }
    @EventHandler public void onWormTeleport(EntityTeleportEvent e) {
        if (isWorm(e.getEntity()) && e.getTo() != null && !e.getTo().getWorld().getName().equals("arrakis")) e.setCancelled(true);
    }
    @EventHandler public void onWormDeath(EntityDeathEvent e) {
        if (isWorm(e.getEntity())) {
            e.getDrops().clear(); e.setDroppedExp(0);
            generateWormSpiceField(e.getEntity().getLocation());
        }
    }
    private void generateWormSpiceField(Location center) {
        World w = center.getWorld();
        if (w == null || !w.getName().equals("arrakis")) return;
        int price = Math.max(1, getConfig().getInt("spice-sell-price", 100));
        int target = Math.max(1, (int)Math.ceil(100000.0 / price));
        int placed = 0;
        int radius = Math.max(8, (int)Math.ceil(Math.sqrt(target / Math.PI)) + 5);
        Random random = java.util.concurrent.ThreadLocalRandom.current();
        for (int dx = -radius; dx <= radius && placed < target; dx++)
            for (int dz = -radius; dz <= radius && placed < target; dz++) {
                if (dx*dx + dz*dz > radius*radius || random.nextDouble() > 0.85) continue;
                int x = center.getBlockX()+dx, z = center.getBlockZ()+dz;
                int y = w.getHighestBlockYAt(x,z);
                Block b = w.getBlockAt(x,y,z);
                if (b.getType() == Material.SAND || b.getType() == Material.RED_SAND) {
                    b.setType(Material.RED_SAND);
                    placed++;
                }
            }
        w.strikeLightningEffect(center);
        Bukkit.broadcastMessage(ChatColor.GOLD + "Shai-Hulud has fallen! A spice bloom has appeared on Arrakis (" + placed + " deposits, up to " + (placed * price) + " Solaris at base yield).");
    }
    @EventHandler public void onCombat(EntityDamageByEntityEvent e) {
        if (e.getDamager() instanceof Player p && selected.getOrDefault(p.getUniqueId(), "").equals("Harkonnen")) e.setDamage(e.getDamage() * 1.15);
        if (e.getEntity() instanceof Player p && selected.getOrDefault(p.getUniqueId(), "").equals("Corrino")) e.setDamage(e.getDamage() * 0.85);
    }
    @EventHandler public void onMove(org.bukkit.event.player.PlayerMoveEvent e) {
        Player p = e.getPlayer(); if (p.getTicksLived() % 100 != 0) return;
        String faction = selected.getOrDefault(p.getUniqueId(), "");
        if (faction.equals("Atreides")) p.addPotionEffect(new PotionEffect(PotionEffectType.SPEED, 130, 0, true, false));
        if (faction.equals("Fremen") && p.getWorld().getName().equals("arrakis")) p.addPotionEffect(new PotionEffect(PotionEffectType.RESISTANCE, 130, 0, true, false));
    }
    private static class PlanetGenerator extends ChunkGenerator {
        private final String planet;
        PlanetGenerator(String planet) { this.planet = planet; }
        @Override public List<BlockPopulator> getDefaultPopulators(World world) {
            return planet.equals("arrakis") ? List.of(new ArrakisWater.SietchPopulator()) : List.of();
        }
        @Override public void generateNoise(WorldInfo world, Random random, int chunkX, int chunkZ, ChunkData data) {
            int sea = 63;
            for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) {
                int gx = chunkX * 16 + x, gz = chunkZ * 16 + z;
                double n = Math.sin(gx * .018) * Math.cos(gz * .021) + Math.sin(gx * .057 + gz * .029) * .4;
                int h = switch (planet) {
                    case "arrakis" -> 70 + (int)(n * 12);
                    case "giedi_prime" -> 66 + (int)(n * 9);
                    case "kaitain" -> 75 + (int)(n * 7);
                    default -> 55 + (int)(n * 17);
                };
                data.setBlock(x, world.getMinHeight(), z, Material.BEDROCK);
                Material core = planet.equals("giedi_prime") ? Material.DEEPSLATE : Material.STONE;
                for (int y = world.getMinHeight() + 1; y < h - 4; y++) data.setBlock(x, y, z, core);
                for (int y = h - 4; y <= h; y++) {
                    Material surface = switch (planet) {
                        case "arrakis" -> random.nextInt(12) == 0 ? Material.RED_SAND : Material.SAND;
                        case "giedi_prime" -> random.nextInt(8) == 0 ? Material.COAL_BLOCK : Material.BLACKSTONE;
                        case "kaitain" -> y == h ? Material.GRASS_BLOCK : Material.DIRT;
                        default -> y == h ? Material.GRASS_BLOCK : Material.DIRT;
                    };
                    data.setBlock(x, y, z, surface);
                }
                if (planet.equals("caladan") && h < sea) for (int y = h + 1; y <= sea; y++) data.setBlock(x, y, z, Material.WATER);
            }
        }
        @Override public BiomeProvider getDefaultBiomeProvider(WorldInfo worldInfo) {
            return new BiomeProvider() {
                @Override public Biome getBiome(WorldInfo info, int x, int y, int z) {
                    return switch (planet) { case "arrakis" -> Biome.DESERT; case "giedi_prime" -> Biome.BADLANDS; case "kaitain" -> Biome.PLAINS; default -> Biome.OCEAN; };
                }
                @Override public List<Biome> getBiomes(WorldInfo info) { return List.of(getBiome(info, 0, 64, 0)); }
            };
        }
    }
}

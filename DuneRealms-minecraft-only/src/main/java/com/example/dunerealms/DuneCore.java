package com.example.dunerealms;

import org.bukkit.*;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.block.Block;
import org.bukkit.command.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.entity.EntityCombustEvent;
import org.bukkit.event.entity.EntityTargetLivingEntityEvent;
import org.bukkit.event.entity.EntityTeleportEvent;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.event.entity.ProjectileLaunchEvent;
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
import org.bukkit.projectiles.ProjectileSource;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.potion.*;
import java.io.File;
import java.io.IOException;
import java.util.*;

public final class DuneCore extends JavaPlugin implements Listener, CommandExecutor, TabCompleter {
    private final String[] planets = {"arrakis", "giedi_prime", "kaitain", "caladan", "sigma_draconis_iv"};
    private final String[] factions = {"Fremen", "Harkonnen", "Corrino", "Atreides", "Ordos"};
    private final Map<UUID, String> selected = new HashMap<>();
    private Economy economy;
    private NamespacedKey itemKey, npcKey, wormKey, armorFactionKey, raiderKey;
    private File dataFile;
    private final Map<UUID, Job> jobs = new HashMap<>();
    private final Map<UUID, UUID> activeWorkers = new HashMap<>();
    private final Map<UUID, ItemStack[]> ordosCloakedArmor = new HashMap<>();
    private final Map<UUID, BukkitTask> ordosRevealTasks = new HashMap<>();
    private record Job(UUID owner, int quota, int harvested) {}
    private YamlConfiguration data;
    private ServerJobs serverJobs;
    private final Map<UUID, Integer> sunExposureSeconds = new HashMap<>();
    private ConfigurableGui gui;
    private AdminGui adminGui;
    private Smugglers smugglers;
    private Politics politics;
    private SharedDatabase sharedDatabase;
    public SharedDatabase sharedDatabase(){return sharedDatabase;}
    public String factionOf(Player player){return selected.getOrDefault(player.getUniqueId(),"");}
    public void persistPlayers(){savePlayers();}
    private ArrakisWater arrakisWater;
    private ArrakisAnnouncements announcements;
    private SandwormMobs sandwormMobs;

    public void announceArrakisEvent(String kind, Location location, String identity) {
        if (announcements != null) announcements.announce(kind, location, identity);
    }

    @Override public void onEnable() {
        migrateLegacyData();
        saveDefaultConfig(); itemKey = new NamespacedKey("dunerealms", "item"); npcKey = new NamespacedKey("dunerealms", "guild"); wormKey = new NamespacedKey("dunerealms", "sandworm"); armorFactionKey = new NamespacedKey("dunerealms", "armor_faction"); raiderKey = new NamespacedKey("dunerealms", "spice_raider");
        dataFile = new File(getDataFolder(), "players.yml"); data = YamlConfiguration.loadConfiguration(dataFile);
        for (String key : data.getKeys(false)) try {
            UUID id = UUID.fromString(key); selected.put(id, data.getString(key + ".faction", ""));
        } catch (IllegalArgumentException ignored) { }
        for (String id : data.getConfigurationSection("jobs") == null ? Set.<String>of() : data.getConfigurationSection("jobs").getKeys(false)) {
            try {
                UUID owner = UUID.fromString(id);
                int quota = data.getInt("jobs." + id + ".quota");
                int harvested = data.getInt("jobs." + id + ".harvested");
                if (quota > harvested) jobs.put(owner, new Job(owner, quota, harvested));
            } catch (IllegalArgumentException ignored) {}
        }
        org.bukkit.plugin.RegisteredServiceProvider<Economy> economyRegistration = Bukkit.getServicesManager().getRegistration(Economy.class);
        if (economyRegistration == null) { getLogger().severe("Install Vault and DuneEss before DuneCore."); getServer().getPluginManager().disablePlugin(this); return; }
        economy = economyRegistration.getProvider();
        if(getConfig().getBoolean("database.enabled",false)) {
            try { sharedDatabase=new SharedDatabase(this); }
            catch(Exception ex){getLogger().severe("Shared database required but unavailable: "+ex.getMessage());getServer().getPluginManager().disablePlugin(this);return;}
        }
        politics = new Politics(this, selected, economy, sharedDatabase);
        arrakisWater = new ArrakisWater(this,economy,politics);
        Bukkit.getPluginManager().registerEvents(arrakisWater,this);
        serverJobs = new ServerJobs(this, economy);
        serverJobs.load();
        Bukkit.getScheduler().runTaskTimer(this, this::checkArrakisSun, 20L, 20L);
        Bukkit.getScheduler().runTaskTimer(this, this::applyFactionSetEffects, 20L, 20L);
        gui = new ConfigurableGui(this, serverJobs, economy, jobs, planets, factions, selected);
        PluginCommand duneCommand = Objects.requireNonNull(getCommand("dune"));
        duneCommand.setExecutor(this);
        duneCommand.setTabCompleter(this);
        Bukkit.getPluginManager().registerEvents(this, this);
        adminGui = new AdminGui(this);
        smugglers = new Smugglers(this, economy, politics);
        announcements = new ArrakisAnnouncements(this);
        sandwormMobs = new SandwormMobs(this, wormKey);
        World loadedArrakis = Bukkit.getWorld("arrakis");
        if (loadedArrakis != null) for (Entity entity : loadedArrakis.getEntities())
            if (isWorm(entity)) announceArrakisEvent("sandworm", entity.getLocation(), "worm:" + entity.getUniqueId());
        Bukkit.getScheduler().runTaskTimer(this, this::spawnSandworms, 200L, 200L);
                Bukkit.getScheduler().runTaskTimer(this, this::spawnSpiceRaiders, 200L, 200L);
        getLogger().info("DuneCore enabled. Gameplay, faction travel, Arrakis threats, and spice raiders ready.");
    }
    @Override public void onDisable() {
        for (UUID playerId : new ArrayList<>(ordosCloakedArmor.keySet())) restoreOrdosArmor(playerId);
        if(serverJobs!=null)serverJobs.save(); savePlayers();
    }
    private void savePlayers() {
        if (sharedDatabase != null) {
            for (Player player : Bukkit.getOnlinePlayers()) try { sharedDatabase.savePlayer(player, selected); }
            catch (Exception ex) { getLogger().severe("Shared save failed for " + player.getName() + ": " + ex.getMessage()); }
            return;
        }
        for (UUID id : selected.keySet()) data.set(id + ".faction", selected.getOrDefault(id, ""));
        data.set("jobs", null);
        for (Job job : jobs.values()) { data.set("jobs." + job.owner() + ".quota", job.quota()); data.set("jobs." + job.owner() + ".harvested", job.harvested()); }
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
        meta.setLore(List.of(ChatColor.YELLOW + "Left or right click to open DuneCore"));
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
            new AttributeModifier(new NamespacedKey("dunerealms","stillsuit_armor_"+piece.toLowerCase(Locale.ROOT)),
                armor, AttributeModifier.Operation.ADD_NUMBER, slot));
        meta.addAttributeModifier(Attribute.ARMOR_TOUGHNESS,
            new AttributeModifier(new NamespacedKey("dunerealms","stillsuit_toughness_"+piece.toLowerCase(Locale.ROOT)),
                3.0, AttributeModifier.Operation.ADD_NUMBER, slot));
        meta.addAttributeModifier(Attribute.KNOCKBACK_RESISTANCE,
            new AttributeModifier(new NamespacedKey("dunerealms","stillsuit_knockback_"+piece.toLowerCase(Locale.ROOT)),
                0.1, AttributeModifier.Operation.ADD_NUMBER, slot));
    }
    private void mergeElytra(Player p) {
        final int price=1_000_000;
        if(!economy.has(p,price)) {
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
        economy.withdrawPlayer(p, price);
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
        if (faction.equalsIgnoreCase("Ordos"))
            p.getInventory().addItem(custom(Material.WIND_CHARGE,"Ordos Implosion Charge","ordos_wind_charge"));
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
                NamespacedKey key=new NamespacedKey("dunerealms","atreides_full_set_hearts");
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
        UUID id=p.getUniqueId();
        if (!ordosCloakedArmor.containsKey(id)) {
            ItemStack[] armor=p.getInventory().getArmorContents();
            ItemStack[] saved=new ItemStack[armor.length];
            for (int i=0;i<armor.length;i++) saved[i]=armor[i]==null?null:armor[i].clone();
            ordosCloakedArmor.put(id,saved);
            p.getInventory().setArmorContents(new ItemStack[armor.length]);
        }
        BukkitTask previous=ordosRevealTasks.remove(id);
        if(previous!=null)previous.cancel();
        p.addPotionEffect(new PotionEffect(PotionEffectType.INVISIBILITY,100,0,true,false,true));
        ordosRevealTasks.put(id,Bukkit.getScheduler().runTaskLater(this,()->restoreOrdosArmor(id),100L));
        p.sendMessage(ChatColor.DARK_GREEN+"Shadow Step: invisible for five seconds.");
    }
    @EventHandler(priority=EventPriority.HIGHEST,ignoreCancelled=true) public void onOrdosChargeLaunch(ProjectileLaunchEvent event) {
        Projectile projectile=event.getEntity();
        if(!projectile.getType().name().equals("WIND_CHARGE")||!(projectile.getShooter() instanceof Player player))return;
        if(!is(player.getInventory().getItemInMainHand(),"ordos_wind_charge")
            &&!is(player.getInventory().getItemInOffHand(),"ordos_wind_charge"))return;
        projectile.getPersistentDataContainer().set(itemKey,PersistentDataType.STRING,"ordos_wind_charge_projectile");
        UUID playerId=player.getUniqueId();
        Bukkit.getScheduler().runTaskLater(this,()->{
            Player owner=Bukkit.getPlayer(playerId);
            if(owner==null)return;
            Map<Integer,ItemStack> leftovers=owner.getInventory().addItem(custom(Material.WIND_CHARGE,"Ordos Implosion Charge","ordos_wind_charge"));
            for(ItemStack leftover:leftovers.values())owner.getWorld().dropItemNaturally(owner.getLocation(),leftover);
        },1L);
    }
    @EventHandler(priority=EventPriority.HIGHEST,ignoreCancelled=true) public void onOrdosChargeHit(ProjectileHitEvent event) {
        Projectile projectile=event.getEntity();
        if(!"ordos_wind_charge_projectile".equals(projectile.getPersistentDataContainer().get(itemKey,PersistentDataType.STRING)))return;
        Location impact=projectile.getLocation();
        Block hit=event.getHitBlock();
        if(hit!=null) {
            Block target=hit.getRelative(event.getHitBlockFace()==null?org.bukkit.block.BlockFace.UP:event.getHitBlockFace());
            if(target.isEmpty()||target.isPassable()) {
                target.setType(Material.TNT);
                impact=target.getLocation().add(0.5,0.5,0.5);
                target.setType(Material.AIR);
            }
        }
        ProjectileSource source=projectile.getShooter();
        projectile.remove();
        impact.getWorld().spawn(impact,TNTPrimed.class,tnt->{tnt.setFuseTicks(0);if(source instanceof Entity entity)tnt.setSource(entity);});
    }
    private void restoreOrdosArmor(UUID id) {
        BukkitTask task=ordosRevealTasks.remove(id);
        if(task!=null)task.cancel();
        ItemStack[] saved=ordosCloakedArmor.remove(id);
        Player player=Bukkit.getPlayer(id);
        if(saved==null||player==null)return;
        ItemStack[] current=player.getInventory().getArmorContents();
        for(int i=0;i<saved.length;i++) {
            ItemStack piece=saved[i];
            if(piece==null||piece.getType()==Material.AIR)continue;
            if(current[i]==null||current[i].getType()==Material.AIR)current[i]=piece;
            else {
                Map<Integer,ItemStack> leftovers=player.getInventory().addItem(piece);
                for(ItemStack leftover:leftovers.values())player.getWorld().dropItemNaturally(player.getLocation(),leftover);
            }
        }
        player.getInventory().setArmorContents(current);
    }
    private boolean wearingStillsuit(Player p) {
        for (ItemStack armor : p.getInventory().getArmorContents()) if (!is(armor, "stillsuit")) return false;
        return true;
    }
    private boolean emperorSanctioned(Player p,String planet) {
        return planet.equalsIgnoreCase("arrakis") && politics.isSpiceSteward(selected.getOrDefault(p.getUniqueId(),""));
    }
    public int spiceSellPrice() { org.bukkit.plugin.Plugin p=Bukkit.getPluginManager().getPlugin("DuneEss"); return p instanceof JavaPlugin j ? Math.max(1,j.getConfig().getInt("currency.spice-price",15)) : 15; }
    public int travelPrice() { org.bukkit.plugin.Plugin p=Bukkit.getPluginManager().getPlugin("DuneEss"); return p instanceof JavaPlugin j ? Math.max(0,j.getConfig().getInt("currency.travel-price",100)) : 100; }
    public int processSpiceSale(Player p,int gross) {
        String house = factionOf(p);
        boolean sanctioned = politics.isAuthorizedSpice(house) || politics.isAuthorizedWater(house);
        int adjusted = sanctionedSpiceGross(gross, sanctioned);
        if (!sanctioned) reportSmuggling(p, "SPICE", adjusted);
        return Math.max(0, adjusted - politics.levy(p.getUniqueId(), adjusted));
    }
    static int sanctionedSpiceGross(int gross, boolean sanctioned) {
        return (int) Math.min(Integer.MAX_VALUE, Math.round(Math.max(0, gross) * (sanctioned ? 1.33 : 1.0)));
    }
    public boolean hasFreeArrakisTravel(Player p) { return emperorSanctioned(p,"arrakis"); }
    public boolean authorizeArrakisTravel(Player p) { if(!emperorSanctioned(p,"arrakis"))return true; if(sharedDatabase==null)return false; try{sharedDatabase.issueArrakisPermit(p.getUniqueId(),System.currentTimeMillis()+120000L);return true;}catch(java.sql.SQLException ex){getLogger().warning("Could not issue Arrakis permit: "+ex.getMessage());return false;} }
    public void enforceArrakisArrival(Player player) { checkArrakisArrival(player); }
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
            int bounty=Math.max(1,(int)Math.round(Math.max(1,spiceSellPrice()/2.0)*1.45));
            sharedDatabase.issueBounty(p.getUniqueId(),"arrakis",bounty);
            for(Player local:p.getWorld().getPlayers())local.sendMessage(ChatColor.RED+
                "UNSANCTIONED ARRIVAL ON ARRAKIS: "+p.getName()+" is wanted for smuggling! Bounty: "+bounty+" Solaris.");
            p.sendMessage(ChatColor.RED+"Your arrival was not sanctioned by the Emperor. You are wanted on Arrakis!");
        }catch(Exception ex){getLogger().severe("Arrakis travel authorization failed: "+ex.getMessage());p.kickPlayer("Arrival authorization unavailable. Please reconnect.");}
    }
    private void factionArrival(Player p,String planet) {
        org.bukkit.plugin.Plugin ess=Bukkit.getPluginManager().getPlugin("DuneEss");
        if(ess==null||!ess.isEnabled()){p.sendMessage(ChatColor.RED+"DuneEss is required for faction travel.");return;}
        try{ess.getClass().getMethod("factionArrival",Player.class,String.class).invoke(ess,p,planet);}catch(ReflectiveOperationException ex){getLogger().warning("Faction arrival failed: "+ex.getMessage());}
    }
    @Override public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (args.length > 0 && (args[0].equalsIgnoreCase("admin") || args[0].equalsIgnoreCase("adminitem"))) {
            if (sender instanceof Player player) {
                if (args[0].equalsIgnoreCase("adminitem")) {
                    if (!player.isOp()) player.sendMessage(ChatColor.RED + "Operators only.");
                    else { adminGui.giveRod(player); player.sendMessage("The admin rod is supplied when an inventory slot is free."); }
                } else adminGui.open(player);
            } else sender.sendMessage("Run this command in-game.");
            return true;
        }
        if (args.length > 0 && args[0].equalsIgnoreCase("summon")) {
            summonSandworm(sender, args);
            return true;
        }
        if (args.length > 0 && args[0].equalsIgnoreCase("help")) {
            if (sender instanceof Player player) Bukkit.dispatchCommand(player, "duneess help"); else sendHelp(sender);
            return true;
        }
        if (args.length > 0 && List.of("balance","sell","travel").contains(args[0].toLowerCase(Locale.ROOT))) {
            sender.sendMessage(ChatColor.YELLOW + "Solaris, Guild travel, and admin teleports are now in DuneEss. Use /duneess help."); return true;
        }
        if (!(sender instanceof Player p)) { sender.sendMessage("Run this command in-game."); return true; }
        if (args.length == 0) { gui.open(p, "main"); return true; }
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "choose" -> {
                if (args.length < 2) { p.sendMessage("Choose a faction name."); break; }
                String choice = args[1];
                String match = Arrays.stream(factions).filter(f -> f.equalsIgnoreCase(choice)).findFirst().orElse(null);
                if (match == null) { p.sendMessage("Unknown faction."); break; }
                if (selected.containsKey(p.getUniqueId()) && !selected.get(p.getUniqueId()).isEmpty() && !p.hasPermission("dune.admin")) { p.sendMessage("Faction already selected."); break; }
                selected.put(p.getUniqueId(), match); economy.createPlayerAccount(p); savePlayers(); kit(p); factionArrival(p, planets[Arrays.asList(factions).indexOf(match)]);
                p.sendMessage(ChatColor.GREEN + "You joined " + match + "!");
            }
            case "smuggle" -> smugglers.command(p, args);
            case "elytra" -> mergeElytra(p);
            case "kit" -> { if (!selected.containsKey(p.getUniqueId())) { p.sendMessage("Choose a faction first."); break; } kit(p); }
            case "politics", "trust" -> politics.command(p, args);
            case "water" -> arrakisWater.command(p,args);
            case "balance", "sell", "travel" -> p.sendMessage(ChatColor.YELLOW + "Solaris and Guild travel moved to /duneess.");
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
            case "givespice" -> { if (p.hasPermission("dune.admin")) p.getInventory().addItem(spiceDrop(p, 1)); }
            default -> p.sendMessage("Use /dune help");
        }
        return true;
    }

    private void sendHelp(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== DuneCore command guide ===");
        helpSection(sender, "General");
        helpLine(sender, "/dune", "Open the Dune Navigator menu.");
        helpLine(sender, "/dune help", "Show this command guide.");
        helpLine(sender, "/dune choose <faction>", "Join Fremen, Harkonnen, Corrino, Atreides, or Ordos and receive its kit.");
        helpLine(sender, "/dune kit", "Receive your selected faction's kit.");
        helpLine(sender, "/dune elytra", "Merge or repair elytra equipment in your inventory.");
        helpLine(sender, "/dune menu | /dune gui", "Open the Dune Navigator menu.");
        helpLine(sender, "/dune menuitem", "Give yourself a portable Dune Navigator item.");

        helpSection(sender, "Travel");
        helpLine(sender, "/duneess travel [planet]", "Open Guild travel or travel to a planet.");

        helpSection(sender, "Solaris and spice");
        helpLine(sender, "/duneess balance", "Check your Solaris balance.");
        helpLine(sender, "/duneess sell", "Sell tagged spice; Imperial-sanctioned houses receive +33% before levy.");
        helpLine(sender, "/dune smuggle status | cancel", "Check or abandon your roaming smuggler delivery contract.");
        helpLine(sender, "/dune exchange", "Open the player-posted spice job exchange.");

        helpSection(sender, "Politics");
        helpLine(sender, "/dune politics status", "Show Trust funds, election leaders, imperial appointments, and any invasion.");
        helpLine(sender, "/dune politics deposit <solaris>", "Contribute your Solaris to the Spacing Trust.");
        helpLine(sender, "/dune politics vote <player>", "Vote for a leader of your faction.");
        helpLine(sender, "/dune politics emperorvote <player>", "Vote for the Emperor.");
        helpLine(sender, "/dune politics leader", "Show the elected leader of your faction.");
        helpLine(sender, "/dune politics invasion <house>", "Let your elected faction leader start an invasion, if the Trust can fund it.");
        helpLine(sender, "/dune politics defend", "Contribute to your faction's defense against an active invasion.");
        helpLine(sender, "/dune politics steward <house>", "Let the Emperor appoint the house that controls spice rights.");
        helpLine(sender, "/dune politics houseofwater <house>", "Let the Emperor appoint the house that controls water rights.");
        helpLine(sender, "/dune trust <action>", "Alias for /dune politics.");

        helpSection(sender, "Contracts and water");
        helpLine(sender, "/dune serverjobs [accept <id>]", "View hourly CHOAM spice contracts or accept an available contract.");
        helpLine(sender, "/dune job", "View player-posted spice exchange jobs.");
        helpLine(sender, "/dune job post <spice quota>", "List a spice gathering job for another player.");
        helpLine(sender, "/dune job accept <player>", "Accept another player's spice gathering job.");
        helpLine(sender, "/dune job finish", "Leave your active player-posted job.");
        helpLine(sender, "/dune job cancel", "Cancel your unclaimed job listing.");
        helpLine(sender, "/dune water guild", "Register as a Guild water trader for the standard legal rate.");
        helpLine(sender, "/dune water smuggler", "Choose the higher-paying but riskier water smuggling career.");
        helpLine(sender, "/dune water sell", "Sell finite water buckets collected on Arrakis.");
        helpLine(sender, "/dune water status", "Show your water career and how water trading works.");

        if (sender.hasPermission("dune.admin")) {
            helpSection(sender, "Admin (dune.admin)");
            helpLine(sender, "/dune guireload", "Reload the configurable Navigator menu.");
            helpLine(sender, "/dune guildnpc", "Spawn a Spacing Guild Navigator at your location.");
            helpLine(sender, "/dune givespice", "Give yourself one spice item.");
            helpLine(sender, "/dune admin | /dune adminitem", "Operators: open admin controls or recover the custom blaze rod.");
            helpLine(sender, "/dune summon sandworm [x y z]", "Summon Shai-Hulud on Arrakis at your position or explicit coordinates.");
            helpLine(sender, "/duneess admin teleport arrakis [player]", "Teleport a player to the loaded Arrakis spawn.");
            helpLine(sender, "/duneess admin teleport sietch [player]", "Teleport a player to a generated Arrakis sietch.");
            helpLine(sender, "/duneess admin teleport spiceblow [player]", "Teleport a player to the nearest generated spice blow.");
            helpLine(sender, "/duneess admin spicebloom [player]", "Place an untriggered spice bloom about 50 blocks ahead of a player on Arrakis.");
            
            helpLine(sender, "/duneess admin solari <player> <amount>", "Add Solaris to an online player's balance.");
        }
    }

    private void helpLine(CommandSender sender, String command, String description) {
        sender.sendMessage(ChatColor.YELLOW + command + ChatColor.GRAY + " — " + description);
    }

    private void helpSection(CommandSender sender, String section) {
        sender.sendMessage(ChatColor.AQUA + "--- " + section + " ---");
    }

    @Override public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 0) return List.of();
        String root = args[0].toLowerCase(Locale.ROOT);
        if (args.length == 1) {
            List<String> commands = new ArrayList<>(List.of("help", "choose", "elytra", "kit", "politics", "trust", "water",
                "menu", "gui", "menuitem", "exchange", "serverjobs", "job", "smuggle"));
            if (sender.hasPermission("dune.admin")) commands.addAll(List.of("guireload", "guildnpc", "givespice", "summon", "admin", "adminitem"));
            return matching(commands, args[0]);
        }

        if (root.equals("choose") && args.length == 2) return matching(Arrays.asList(factions), args[1]);
        if (root.equals("summon") && args.length == 2 && sender.hasPermission("dune.admin")) return matching(List.of("sandworm"), args[1]);
        if ((root.equals("politics") || root.equals("trust")) && args.length == 2)
            return matching(List.of("status", "deposit", "vote", "emperorvote", "leader", "invasion", "defend", "steward", "houseofwater"), args[1]);
        if ((root.equals("politics") || root.equals("trust")) && args.length == 3) {
            if (args[1].equalsIgnoreCase("vote") || args[1].equalsIgnoreCase("emperorvote")) return onlinePlayerNames(args[2]);
            if (args[1].equalsIgnoreCase("invasion") || args[1].equalsIgnoreCase("steward") || args[1].equalsIgnoreCase("houseofwater"))
                return matching(Arrays.asList(factions), args[2]);
        }
        if (root.equals("water") && args.length == 2) return matching(List.of("guild", "smuggler", "sell", "status"), args[1]);
        if (root.equals("serverjobs") && args.length == 2) {
            List<String> options = new ArrayList<>(List.of("accept"));
            if (sender.hasPermission("dune.admin")) options.add("reload");
            return matching(options, args[1]);
        }
        if (root.equals("serverjobs") && args.length == 3 && args[1].equalsIgnoreCase("accept"))
            return matching(serverJobs.offerIds(), args[2]);
        if (root.equals("job") && args.length == 2) return matching(List.of("post", "accept", "finish", "cancel"), args[1]);
        if (root.equals("job") && args.length == 3 && args[1].equalsIgnoreCase("accept")) return onlinePlayerNames(args[2]);

        return List.of();
    }

    private List<String> onlinePlayerNames(String prefix) {
        return matching(Bukkit.getOnlinePlayers().stream().map(Player::getName).toList(), prefix);
    }

    private List<String> matching(Collection<String> options, String prefix) {
        String start = prefix.toLowerCase(Locale.ROOT);
        return options.stream().filter(option -> option.toLowerCase(Locale.ROOT).startsWith(start))
            .distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    void runGuiCommand(Player p,String command) {
        String[] args=command.trim().split("\\s+"); if(args.length==0||args[0].isEmpty())return;
        if(List.of("travel","balance","sell").contains(args[0].toLowerCase(Locale.ROOT))){Bukkit.dispatchCommand(p,"duneess "+command.trim());return;}
        onCommand(p,Objects.requireNonNull(getCommand("dune")),"dune",args);
    }
    @EventHandler public void onGuiClick(InventoryClickEvent e) { gui.click(e); }
    @EventHandler public void onGuiDrag(org.bukkit.event.inventory.InventoryDragEvent e) { gui.drag(e); }
    private void showExchange(Player p) {
        p.sendMessage(ChatColor.GOLD + "=== Spice Exchange (15% worker / 85% sponsor) ===");
        if (jobs.isEmpty()) { p.sendMessage("No jobs listed. Use /dune job post <spice quota>."); return; }
        for (Job j : jobs.values()) {
            String name = Bukkit.getOfflinePlayer(j.owner()).getName();
            p.sendMessage(ChatColor.YELLOW.toString() + (name == null ? j.owner() : name) + ": " + (j.quota()-j.harvested()) + " spice remaining; /dune job accept " + (name == null ? j.owner() : name));
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
                Bukkit.dispatchCommand(p, "duneess travel arrakis");
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
        try{sharedDatabase.loadPlayer(e.getPlayer(),selected);
            if(getConfig().getString("network.local-planet","arrakis").equalsIgnoreCase("arrakis"))
                Bukkit.getScheduler().runTaskLater(this,()->{if(e.getPlayer().isOnline())checkArrakisArrival(e.getPlayer());},5L);
        }
        catch(Exception ex){getLogger().severe("Shared player load failed: "+ex.getMessage());e.getPlayer().kickPlayer("Your network profile could not be loaded.");}
    }
    @EventHandler public void onNetworkQuit(org.bukkit.event.player.PlayerQuitEvent e) {
        restoreOrdosArmor(e.getPlayer().getUniqueId());
        if(sharedDatabase!=null)try{sharedDatabase.savePlayer(e.getPlayer(),selected);}
        catch(Exception ex){getLogger().severe("Shared player save failed: "+ex.getMessage());}
    }
    @EventHandler public void onBountyKill(org.bukkit.event.entity.PlayerDeathEvent e) {
        Player victim=e.getEntity(), killer=victim.getKiller();
        if(killer==null||killer.equals(victim)||sharedDatabase==null)return;
        try {
            int reward=sharedDatabase.claimBounty(victim.getUniqueId(),killer.getUniqueId());
            if(reward>0){economy.depositPlayer(killer,reward);
                Bukkit.broadcastMessage(ChatColor.GOLD+killer.getName()+" claimed "+reward+" Solaris bounty on "+victim.getName()+"!");}
        }catch(Exception ex){getLogger().warning("Bounty claim failed: "+ex.getMessage());}
    }
    @EventHandler public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        Bukkit.getScheduler().runTask(this, () -> giveMenuItem(p));
        if (!selected.containsKey(p.getUniqueId()) || selected.get(p.getUniqueId()).isEmpty()) {
            p.sendMessage(ChatColor.GOLD + "Choose your faction with /dune choose <fremen|harkonnen|corrino|atreides>.");
        }
        Bukkit.getScheduler().runTask(this, () -> {
            World localWorld = Bukkit.getWorld(getConfig().getString("network.local-planet", "arrakis"));
            if (p.isOnline() && localWorld != null && p.getWorld().getName().equalsIgnoreCase("world")) {
                p.teleport(localWorld.getSpawnLocation());
            }
        });
    }
    @EventHandler public void onRespawn(PlayerRespawnEvent e) {
        String faction = selected.get(e.getPlayer().getUniqueId());
        if (faction == null) return;
        int index = Arrays.asList(factions).indexOf(faction);
        if (index < 0) return;
        World w = Bukkit.getWorld(planets[index]);
        if (w != null) e.setRespawnLocation(w.getSpawnLocation().clone());
    }
    @EventHandler public void onNpc(PlayerInteractEntityEvent e) {
        if (e.getRightClicked().getPersistentDataContainer().has(npcKey, PersistentDataType.BYTE)) { e.setCancelled(true); Bukkit.dispatchCommand(e.getPlayer(), "duneess travel"); }
    }
    @EventHandler public void onSpice(BlockBreakEvent e) {
        Block block = e.getBlock();
        if (!block.getWorld().getName().equals("arrakis") || block.getType() != Material.SUSPICIOUS_SAND) return;
        Player p = e.getPlayer();
        ItemStack held = p.getInventory().getItemInMainHand();
        if (held.getType() != Material.NETHERITE_SHOVEL || !is(held, "shovel")) {
            e.setCancelled(true);
            p.sendMessage(ChatColor.RED + "Only the Spice Harvest Shovel from /dune kit can mine a spice deposit.");
            return;
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
                int unitPrice = spiceSellPrice();
                // Pay in whole Solaris with exact 15/85 split over accumulated earnings.
                int oldValue = job.harvested() * unitPrice;
                int newValue = (job.harvested() + credited) * unitPrice;
                int workerPay = (int)((newValue * 15L) / 100 - (oldValue * 15L) / 100);
                economy.depositPlayer(p, workerPay);
                economy.depositPlayer(Bukkit.getOfflinePlayer(sponsor), credited * unitPrice - workerPay);
                int progress = job.harvested() + credited;
                if (progress >= job.quota()) {
                    jobs.remove(sponsor); activeWorkers.remove(p.getUniqueId());
                    p.sendMessage(ChatColor.GREEN + "Spice contract completed!");
                } else jobs.put(sponsor, new Job(sponsor, job.quota(), progress));
                savePlayers();
                p.sendMessage(ChatColor.GOLD + "Job spice: +" + workerPay + " Solaris (15% share).");
                // Contract spice is sold automatically, not dropped as a second payout.
                if (credited == amount) {
                    scheduleSpiceRespawn(block.getLocation());
                    return;
                }
                amount -= credited;
            }
        }
        block.getWorld().dropItemNaturally(block.getLocation(), spiceDrop(p, amount));
        scheduleSpiceRespawn(block.getLocation());
    }
    private void scheduleSpiceRespawn(Location location) {
        Location loc = location.clone();
        long delay = 20L * getConfig().getLong("spice-respawn-seconds", 120);
        Bukkit.getScheduler().runTaskLater(this, () -> { if (loc.getChunk().isLoaded() && loc.getBlock().getType() == Material.AIR) loc.getBlock().setType(Material.SUSPICIOUS_SAND); }, delay);
    }
    private void migrateLegacyData() {
        File legacy = new File(getDataFolder().getParentFile(), "DuneRealms");
        if (!legacy.isDirectory()) return;
        File current = getDataFolder();
        if (!current.exists() && !current.mkdirs()) {
            getLogger().warning("Could not create DuneCore data folder for legacy settings migration.");
            return;
        }
        File[] files = legacy.listFiles(File::isFile);
        if (files == null) return;
        for (File source : files) {
            File destination = new File(current, source.getName());
            if (destination.exists()) continue;
            try {
                java.nio.file.Files.copy(source.toPath(), destination.toPath());
                getLogger().info("Migrated " + source.getName() + " from the previous DuneRealms data folder.");
            } catch (IOException ex) {
                getLogger().warning("Could not migrate " + source.getName() + ": " + ex.getMessage());
            }
        }
    }
    private ItemStack spiceDrop(Player miner, int amount) {
        ItemStack spice = custom(Material.ORANGE_DYE, "Melange Spice", "spice").asQuantity(amount);
        ItemMeta meta = spice.getItemMeta();
        String faction = selected.getOrDefault(miner.getUniqueId(), "Unaffiliated");
        meta.setLore(List.of(ChatColor.GOLD + "Price: " + spiceSellPrice() + " Solaris each",
            ChatColor.GRAY + "Mined by: " + miner.getName() + " ; faction: " + faction));
        spice.setItemMeta(meta);
        return spice;
    }
    private boolean isWorm(Entity entity) {
        return entity.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE);
    }
    @EventHandler public void onWormLoaded(com.destroystokyo.paper.event.entity.EntityAddToWorldEvent event) {
        if (isWorm(event.getEntity())) announceArrakisEvent("sandworm", event.getEntity().getLocation(), "worm:" + event.getEntity().getUniqueId());
    }
    private boolean isSpiceRaider(Entity entity) {
        return entity.getPersistentDataContainer().has(raiderKey, PersistentDataType.BYTE);
    }
    private void spawnSpiceRaiders() {
        if (!getConfig().getBoolean("spice-raiders.enabled", true)) return;
        World world = Bukkit.getWorld("arrakis");
        if (world == null) return;
        int max = Math.max(0, getConfig().getInt("spice-raiders.max-per-world", 12));
        int count = (int)world.getEntitiesByClass(Zombie.class).stream().filter(this::isSpiceRaider).count();
        if (count >= max) return;
        Random random = java.util.concurrent.ThreadLocalRandom.current();
        for (Player player : world.getPlayers()) {
            if (count >= max) break;
            boolean nearRichField = nearHighValueSpice(player);
            double chance = getConfig().getDouble(nearRichField ? "spice-raiders.chance-near-rich-field" : "spice-raiders.chance-per-player-check", nearRichField ? 0.45 : 0.08);
            if (random.nextDouble() >= Math.max(0, Math.min(1, chance))) continue;
            if (world.getNearbyEntities(player.getLocation(), 32, 24, 32).stream().anyMatch(this::isSpiceRaider)) continue;
            Zombie raider = spawnSpiceRaiderNear(player, random);
            if (raider != null) count++;
        }
    }
    private boolean nearHighValueSpice(Player player) {
        String path = "spice-raiders.";
        int radius = Math.max(8, getConfig().getInt(path + "field-radius", 24));
        int valueThreshold = Math.max(1, getConfig().getInt(path + "field-value-threshold", 5000));
        int price = spiceSellPrice();
        int required = valueThreshold / price + 1;
        World world = player.getWorld();
        int centerX = player.getLocation().getBlockX(), centerZ = player.getLocation().getBlockZ();
        int deposits = 0;
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radius * radius) continue;
            int x = centerX + dx, z = centerZ + dz, y = world.getHighestBlockYAt(x, z);
            if (world.getBlockAt(x, y, z).getType() == Material.SUSPICIOUS_SAND && ++deposits >= required) return true;
        }
        return false;
    }
    private Zombie spawnSpiceRaiderNear(Player target, Random random) {
        World world = target.getWorld();
        for (int attempt = 0; attempt < 12; attempt++) {
            double angle = random.nextDouble() * Math.PI * 2;
            int distance = 16 + random.nextInt(17);
            int x = target.getLocation().getBlockX() + (int)Math.round(Math.cos(angle) * distance);
            int z = target.getLocation().getBlockZ() + (int)Math.round(Math.sin(angle) * distance);
            int y = world.getHighestBlockYAt(x, z);
            if (world.getBlockAt(x, y, z).getType() != Material.SAND && world.getBlockAt(x, y, z).getType() != Material.RED_SAND) continue;
            if (!world.getBlockAt(x, y + 1, z).isPassable() || !world.getBlockAt(x, y + 2, z).isPassable()) continue;
            Location spawn = new Location(world, x + 0.5, y + 1, z + 0.5);
            return world.spawn(spawn, Zombie.class, raider -> {
                raider.getPersistentDataContainer().set(raiderKey, PersistentDataType.BYTE, (byte)1);
                raider.setCustomName(ChatColor.DARK_RED + "Haunted Fremen");
                raider.setCustomNameVisible(true);
                raider.setRemoveWhenFarAway(true);
                raider.setCanPickupItems(false);
                raider.getEquipment().setHelmet(new ItemStack(Material.LEATHER_HELMET));
                raider.getEquipment().setHelmetDropChance(0.0f);
                raider.getAttribute(Attribute.MAX_HEALTH).setBaseValue(getConfig().getDouble("spice-raiders.health", 36.0));
                raider.setHealth(raider.getAttribute(Attribute.MAX_HEALTH).getValue());
                raider.getAttribute(Attribute.ATTACK_DAMAGE).setBaseValue(getConfig().getDouble("spice-raiders.attack-damage", 6.0));
                raider.getAttribute(Attribute.MOVEMENT_SPEED).setBaseValue(getConfig().getDouble("spice-raiders.movement-speed", 0.28));
                raider.getEquipment().setItemInMainHand(new ItemStack(Material.IRON_SWORD));
                raider.getEquipment().setItemInMainHandDropChance(0.0f);
                raider.setTarget(target);
            });
        }
        return null;
    }
    private void spawnSandworms() {
        if (!getConfig().getBoolean("sandworms.enabled", true)) return;
        long now = System.currentTimeMillis();
        if (now < getConfig().getLong("sandworms.next-spawn-at", 0L)) return;
        World world = Bukkit.getWorld("arrakis");
        if (world == null) return;
        int max = Math.max(0, getConfig().getInt("sandworms.max-per-world", 12));
        int count = (int) world.getEntitiesByClass(Sniffer.class).stream().filter(this::isWorm).count();
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
            spawnSandworm(location, player);
            long interval = Math.max(60L, getConfig().getLong("sandworms.spawn-interval-seconds", 3600L));
            getConfig().set("sandworms.next-spawn-at", now + interval * 1000L);
            saveConfig();
            return;
        }
    }

    private Sniffer spawnSandworm(Location location, Player target) {
            World world = Objects.requireNonNull(location.getWorld());
            Sniffer worm = sandwormMobs.spawn(location, target);
            world.spawnParticle(Particle.CLOUD, location, 45, 2, 1, 2, 0.1);
            world.playSound(location, Sound.ENTITY_WARDEN_ROAR, 2f, 0.6f);
            announceArrakisEvent("sandworm", location, "worm:" + worm.getUniqueId());
            return worm;
    }

    private void summonSandworm(CommandSender sender, String[] args) {
        if (!sender.hasPermission("dune.admin")) { sender.sendMessage(ChatColor.RED + "You need dune.admin to summon Shai-Hulud."); return; }
        if ((args.length != 2 && args.length != 5) || !args[1].equalsIgnoreCase("sandworm")) {
            sender.sendMessage("Usage: /dune summon sandworm [x y z]"); return;
        }
        World world = Bukkit.getWorld("arrakis");
        if (world == null) { sender.sendMessage(ChatColor.RED + "Arrakis is not loaded on this server."); return; }
        Location location;
        if (args.length == 2) {
            if (!(sender instanceof Player player) || !player.getWorld().equals(world)) {
                sender.sendMessage("On Arrakis, omit coordinates to summon at your position; otherwise supply x y z."); return;
            }
            location = player.getLocation().clone();
        } else {
            try { location = new Location(world, Double.parseDouble(args[2]), Double.parseDouble(args[3]), Double.parseDouble(args[4])); }
            catch (NumberFormatException ex) { sender.sendMessage(ChatColor.RED + "Coordinates must be numbers."); return; }
        }
        if (!Double.isFinite(location.getX()) || !Double.isFinite(location.getY()) || !Double.isFinite(location.getZ())
            || location.getY() < world.getMinHeight() || location.getY() + 2 >= world.getMaxHeight()
            || Math.abs(location.getX()) > 29999984 || Math.abs(location.getZ()) > 29999984
            || !world.getWorldBorder().isInside(location)) {
            sender.sendMessage(ChatColor.RED + "Coordinates must be inside Arrakis' world border and build height."); return;
        }
        if (!location.getBlock().isPassable() || !location.clone().add(0, 1, 0).getBlock().isPassable()) {
            sender.sendMessage(ChatColor.RED + "Choose an open space for the sandworm."); return;
        }
        spawnSandworm(location, sender instanceof Player player && player.getWorld().equals(world) ? player : null);
        sender.sendMessage(ChatColor.GREEN + "Shai-Hulud summoned at " + location.getBlockX() + ", " + location.getBlockY() + ", " + location.getBlockZ() + ".");
    }
    @EventHandler public void onRaiderCombust(EntityCombustEvent e) {
        if (isSpiceRaider(e.getEntity())) e.setCancelled(true);
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
        int price = spiceSellPrice();
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
                    b.setType(Material.SUSPICIOUS_SAND);
                    placed++;
                }
            }
        w.strikeLightningEffect(center);
        if (placed > 0) announceArrakisEvent("spicebloom", center, "worm-bloom:" + UUID.randomUUID());
        for (Player player : w.getPlayers()) player.sendMessage(ChatColor.GOLD + "Shai-Hulud has fallen at X " + center.getBlockX() + ", Y " + center.getBlockY() + ", Z " + center.getBlockZ() + "! " + placed + " spice deposits surfaced, worth up to " + (placed * price) + " Solaris at base yield.");
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
}

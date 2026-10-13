package com.example.dunenpc;

import com.example.dunerealms.DuneCore;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.world.WorldLoadEvent;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;

public final class DuneNPC extends JavaPlugin implements Listener, CommandExecutor, TabCompleter {
    private DuneCore core;
    private Smugglers smugglers;
    private NamespacedKey guildKey;
    private static final Set<String> PLANETS = Set.of("arrakis", "caladan", "kaitain", "giedi_prime", "sigma_draconis_iv");
    private static final class Menu implements InventoryHolder {
        private Inventory inventory;
        @Override public Inventory getInventory() { return inventory; }
    }
    public DuneCore core() { return core; }

    @Override public void onEnable() {
        core = (DuneCore) Bukkit.getPluginManager().getPlugin("DuneCore");
        boolean firstConfig = !new File(getDataFolder(), "config.yml").exists();
        saveDefaultConfig();
        try { migrateData(); }
        catch (IOException exception) {
            getLogger().severe("NPC data migration failed: " + exception.getMessage());
            Bukkit.getPluginManager().disablePlugin(this); return;
        }
        if (firstConfig) {
            var old = core.getConfig().getConfigurationSection("smugglers");
            if (old != null) for (String key : old.getKeys(false)) getConfig().set("smugglers." + key, old.get(key));
            var terrain = Bukkit.getPluginManager().getPlugin("DuneTerrain");
            if (terrain instanceof JavaPlugin javaPlugin)
                getConfig().set("guild-npc.enabled", javaPlugin.getConfig().getBoolean("guild-npc.enabled", true));
            saveConfig();
        }
        var registration = Bukkit.getServicesManager().getRegistration(Economy.class);
        if (registration == null) { getLogger().severe("Vault economy unavailable."); Bukkit.getPluginManager().disablePlugin(this); return; }
        guildKey = new NamespacedKey("dunerealms", "guild");
        smugglers = new Smugglers(this, registration.getProvider(), core.politics());
        Objects.requireNonNull(getCommand("dunenpc")).setExecutor(this);
        Objects.requireNonNull(getCommand("dunenpc")).setTabCompleter(this);
        Bukkit.getPluginManager().registerEvents(this, this);
        Bukkit.getScheduler().runTask(this, () -> Bukkit.getWorlds().forEach(this::ensureGuildNpc));
    }
    @Override public void onDisable() { if (smugglers != null) smugglers.shutdown(); }
    private void migrateData() throws IOException {
        for (String name : List.of("smuggling.yml", "smuggler-camps.yml")) {
            File source = new File(core.getDataFolder(), name), destination = new File(getDataFolder(), name);
            if (source.isFile() && !destination.exists()) {
                Files.copy(source.toPath(), destination.toPath());
                getLogger().info("Copied " + name + " from DuneCore; legacy file kept as backup.");
            }
        }
    }
    @EventHandler public void worldLoaded(WorldLoadEvent event) {
        Bukkit.getScheduler().runTask(this, () -> ensureGuildNpc(event.getWorld()));
    }
    private void ensureGuildNpc(World world) {
        if (!PLANETS.contains(world.getName().toLowerCase(Locale.ROOT)) || !getConfig().getBoolean("guild-npc.enabled", true)) return;
        Location spawn = world.getSpawnLocation();
        world.getChunkAt(spawn).load();
        for (Entity entity : world.getNearbyEntities(spawn, 12, 8, 12))
            if (entity instanceof Villager && entity.getPersistentDataContainer().has(guildKey, PersistentDataType.BYTE)) return;
        int x = spawn.getBlockX() + 2, z = spawn.getBlockZ();
        for (int dx = -3; dx <= 3; dx++) for (int dz = -3; dz <= 3; dz++) {
            int bx = x + dx, bz = z + dz;
            int y = world.getHighestBlockYAt(bx, bz);
            Material ground = world.getBlockAt(bx, y, bz).getType();
            Location location = new Location(world, bx + .5, y + 1, bz + .5);
            if (y + 2 < world.getMaxHeight() && ground.isSolid() && ground != Material.CACTUS && ground != Material.MAGMA_BLOCK
                && world.getBlockAt(bx, y + 1, bz).isPassable() && world.getBlockAt(bx, y + 2, bz).isPassable()
                && !world.getBlockAt(bx, y + 1, bz).isLiquid() && world.getWorldBorder().isInside(location)) {
                spawnNavigator(location); return;
            }
        }
    }
    private void spawnNavigator(Location location) {
        location.getWorld().spawn(location, Villager.class, villager -> {
            villager.setCustomName(ChatColor.LIGHT_PURPLE + "Spacing Guild Navigator");
            villager.setCustomNameVisible(true); villager.setProfession(Villager.Profession.CLERIC);
            villager.setAI(false); villager.setInvulnerable(true); villager.setSilent(true); villager.setPersistent(true);
            villager.getPersistentDataContainer().set(guildKey, PersistentDataType.BYTE, (byte) 1);
        });
    }
    @EventHandler public void navigator(PlayerInteractEntityEvent event) {
        if (!(event.getRightClicked() instanceof Villager)
            || !event.getRightClicked().getPersistentDataContainer().has(guildKey, PersistentDataType.BYTE)) return;
        event.setCancelled(true);
        if (event.getHand() == EquipmentSlot.HAND) Bukkit.dispatchCommand(event.getPlayer(), "duneess travel");
    }
    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) { sender.sendMessage("Run this command in-game."); return true; }
        if (args.length > 0 && args[0].equalsIgnoreCase("smuggle")) { smugglers.command(player, args); return true; }
        if (args.length > 0 && args[0].equalsIgnoreCase("guildnpc")) {
            if (!player.hasPermission("dune.admin")) { player.sendMessage("Admin only."); return true; }
            spawnNavigator(player.getLocation()); player.sendMessage("Guild Navigator placed."); return true;
        }
        if (!player.isOp()) { player.sendMessage(ChatColor.RED + "Operators only. Right-click an Arrakis Smuggler for missions."); return true; }
        if (args.length == 0 || args[0].equalsIgnoreCase("admin")) { openAdmin(player); return true; }
        if (args[0].equalsIgnoreCase("smuggler")) {
            if (!getConfig().getBoolean("smugglers.enabled", true)) { player.sendMessage("Smugglers are disabled in DuneNPC/config.yml."); return true; }
            if (!player.getWorld().getName().equalsIgnoreCase("arrakis")) { player.sendMessage("Spawn smugglers on Arrakis."); return true; }
            smugglers.spawnAt(player.getLocation()); player.sendMessage("Arrakis Smuggler placed."); return true;
        }
        if (args[0].equalsIgnoreCase("status")) { status(player); return true; }
        player.sendMessage("/dunenpc admin | guildnpc | smuggler | status | smuggle status | smuggle cancel"); return true;
    }
    private void status(Player player) {
        int guild = 0, traders = 0;
        for (World world : Bukkit.getWorlds()) {
            for (Villager villager : world.getEntitiesByClass(Villager.class))
                if (villager.getPersistentDataContainer().has(guildKey, PersistentDataType.BYTE)) guild++;
            for (WanderingTrader trader : world.getEntitiesByClass(WanderingTrader.class))
                if (trader.getPersistentDataContainer().has(new NamespacedKey("dunecore", "smuggler"), PersistentDataType.BYTE)) traders++;
        }
        player.sendMessage(ChatColor.GOLD + "DuneNPC: " + guild + " loaded Guild Navigators, " + traders + " loaded smugglers, " + smugglers.activeCount() + " open contracts.");
    }
    void openAdmin(Player player) {
        if (!player.isOp()) { player.sendMessage(ChatColor.RED + "Operators only."); return; }
        Menu menu = new Menu();
        menu.inventory = Bukkit.createInventory(menu, 27, ChatColor.GOLD + "DuneNPC | NPC Administration");
        for (int slot = 0; slot < 27; slot++) menu.inventory.setItem(slot, icon(Material.BLACK_STAINED_GLASS_PANE, " "));
        menu.inventory.setItem(10, icon(Material.VILLAGER_SPAWN_EGG, "Place Guild Navigator", "Spawn at your position; opens Guild travel."));
        menu.inventory.setItem(12, icon(Material.WANDERING_TRADER_SPAWN_EGG, "Place Arrakis Smuggler", "Spawn at your position on Arrakis."));
        menu.inventory.setItem(14, icon(Material.WRITABLE_BOOK, "NPC and Mission Status", "Show loaded NPC counts and active contracts."));
        menu.inventory.setItem(16, icon(Material.CLOCK, "Quest Camp Guide", "Green: free to roam. Purple: active mission.", "Active contacts are stationary and lit.", "Missions expire after 30 real minutes."));
        menu.inventory.setItem(22, icon(Material.BLAZE_ROD, "Back to Dune Admin"));
        player.openInventory(menu.inventory);
    }
    private ItemStack icon(Material material, String name, String... lore) {
        ItemStack item = new ItemStack(material); ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(ChatColor.GOLD + name);
        meta.setLore(Arrays.stream(lore).map(line -> ChatColor.GRAY + line).toList());
        item.setItemMeta(meta); return item;
    }
    @EventHandler public void click(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder() instanceof Menu)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player) || event.getClickedInventory() != event.getView().getTopInventory()) return;
        String action = switch (event.getRawSlot()) { case 10 -> "guildnpc"; case 12 -> "smuggler"; case 14 -> "status"; case 22 -> "back"; default -> ""; };
        if (action.isEmpty()) return;
        Bukkit.getScheduler().runTask(this, () -> {
            if (!player.isOnline()) return;
            player.closeInventory(); if (!player.isOp()) return;
            Bukkit.dispatchCommand(player, action.equals("back") ? "dune admin" : "dunenpc " + action);
        });
    }
    @EventHandler public void drag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof Menu) event.setCancelled(true);
    }
    @Override public List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 1) return (sender.isOp() ? List.of("admin", "guildnpc", "smuggler", "status", "smuggle") : List.of("smuggle"))
            .stream().filter(item -> item.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        if (args.length == 2 && args[0].equalsIgnoreCase("smuggle")) return List.of("status", "cancel").stream()
            .filter(item -> item.startsWith(args[1].toLowerCase(Locale.ROOT))).toList();
        return List.of();
    }
}

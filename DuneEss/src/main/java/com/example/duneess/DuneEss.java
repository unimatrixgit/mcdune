package com.example.duneess;

import net.milkbowl.vault.economy.Economy;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.TextComponent;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.lang.reflect.Method;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.util.*;

public final class DuneEss extends JavaPlugin implements CommandExecutor, TabCompleter, Listener {
    private static final List<String> PLANETS = List.of("arrakis", "giedi_prime", "kaitain", "caladan", "sigma_draconis_iv");
    private DuneEconomy economy;
    private String jdbcUrl = "", dbUser = "", dbPassword = "";
    private boolean networkEnabled;
    private String localPlanet;
    private NamespacedKey spiceKey;
    private NamespacedKey helpPageKey, helpActionKey;
    private final Map<UUID, Integer> helpPageByPlayer = new HashMap<>();
    private static final String HELP_TITLE = ChatColor.DARK_RED + "Dune Field Guide";
    private static final List<List<HelpEntry>> HELP_PAGES = List.of(
        List.of(
            new HelpEntry("/duneess balance", "Check your Solaris wallet.", Material.GOLD_INGOT),
            new HelpEntry("/duneess sell", "Sell all tagged spice in your inventory.", Material.ORANGE_DYE),
            new HelpEntry("/duneess travel", "Open the Spacing Guild planet selector.", Material.ENDER_PEARL),
            new HelpEntry("/duneess travel arrakis", "Pay the fare and travel to Arrakis.", Material.MAP),
            new HelpEntry("/dune", "Open the Dune Navigator menu.", Material.NETHER_STAR)
        ),
        List.of(
            new HelpEntry("/dune choose fremen", "Choose Fremen; replace 'fremen' with another house to choose it.", Material.WHITE_BANNER),
            new HelpEntry("/dune kit", "Receive your faction stillsuit and spice shovel.", Material.NETHERITE_SHOVEL),
            new HelpEntry("/dune elytra", "Upgrade a worn stillsuit chestplate with an Elytra.", Material.ELYTRA),
            new HelpEntry("/dune politics status", "View the Spacing Trust, leaders, and imperial appointments.", Material.WRITABLE_BOOK),
            new HelpEntry("/dune water status", "View your Arrakis water-trading career.", Material.WATER_BUCKET)
        ),
        List.of(
            new HelpEntry("/dune serverjobs", "Browse hourly CHOAM spice contracts.", Material.EMERALD),
            new HelpEntry("/dune job", "Browse player-posted spice contracts.", Material.BOOK),
            new HelpEntry("/dune job post 100", "Post a 100-spice contract; change the amount to suit your listing.", Material.PAPER),
            new HelpEntry("/dune water sell", "Sell water collected on Arrakis.", Material.BUCKET),
            new HelpEntry("/dune exchange", "Open the spice exchange menu.", Material.CHEST)
        ),
        List.of(
            new HelpEntry("/duneess admin solari player amount", "Grant Solaris to an online player.", Material.GOLD_INGOT),
            new HelpEntry("/duneess admin teleport arrakis", "Force yourself to Arrakis spawn.", Material.COMPASS),
            new HelpEntry("/duneess admin teleport sietch", "Teleport yourself to a generated sietch.", Material.CHEST),
            new HelpEntry("/duneess admin teleport spiceblow", "Teleport yourself to a generated spice blow.", Material.MAGMA_BLOCK),
            new HelpEntry("/duneess admin spicebloom", "Place an untriggered bloom about 50 blocks ahead of you.", Material.GLOWSTONE),
            new HelpEntry("/dune guireload", "Reload DuneCore's configurable Navigator menu.", Material.COMPARATOR)
        )
    );
    private record HelpEntry(String command, String description, Material icon) {}

    @Override public void onEnable() {
        saveDefaultConfig();
        loadCoreSettings();
        spiceKey = new NamespacedKey("dunerealms", "item");
        helpPageKey = new NamespacedKey(this, "help_page");
        helpActionKey = new NamespacedKey(this, "help_action");
        economy = new DuneEconomy(this);
        getServer().getServicesManager().register(Economy.class, economy, this, ServicePriority.Highest);
        getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");
        PluginCommand command = Objects.requireNonNull(getCommand("duneess"));
        command.setExecutor(this);
        command.setTabCompleter(this);
        getServer().getPluginManager().registerEvents(this, this);
        for (Player player : Bukkit.getOnlinePlayers()) economy.createPlayerAccount(player);
        getLogger().info("DuneEss enabled as the Solaris Vault provider.");
    }

    @Override public void onDisable() {
        getServer().getServicesManager().unregister(Economy.class, economy);
    }

    public Economy economy() { return economy; }

    /** Free faction selection arrival, routed through DuneEss so Core owns no player-facing teleport command logic. */
    public void factionArrival(Player player, String planet) {
        planet = planet.toLowerCase(Locale.ROOT);
        if (!PLANETS.contains(planet)) return;
        if (planet.equals("arrakis") && !callCoreArrakisAuthorization(player)) {
            player.sendMessage(ChatColor.RED + "Arrakis travel was not authorized.");
            return;
        }
        if (networkEnabled && !planet.equalsIgnoreCase(localPlanet)) {
            String server = getConfig().getString("network.servers." + planet, "");
            if (server.isBlank()) server = YamlConfiguration.loadConfiguration(
                new File(getDataFolder().getParentFile(), "DuneCore/config.yml")).getString("network.servers." + planet, "");
            if (server.isBlank()) { player.sendMessage(ChatColor.RED + "The Guild server for " + planet + " is not configured."); return; }
            sendToServer(player, server, planet);
            return;
        }
        World world = Bukkit.getWorld(planet);
        if (world == null) { player.sendMessage(ChatColor.RED + "That planet is not loaded on this server."); return; }
        if (player.teleport(world.getSpawnLocation())) {
            player.sendMessage(ChatColor.AQUA + "Faction arrival: " + planet);
            if (planet.equals("arrakis")) callCoreArrakisArrival(player);
        }
    }

    private void loadCoreSettings() {
        File coreFile = new File(getDataFolder().getParentFile(), "DuneCore/config.yml");
        YamlConfiguration core = YamlConfiguration.loadConfiguration(coreFile);
        if (getConfig().getBoolean("database.use-core-database", true) && core.getBoolean("database.enabled", false)) {
            jdbcUrl = core.getString("database.jdbc-url", "");
            dbUser = core.getString("database.username", "");
            dbPassword = core.getString("database.password", "");
        }
        boolean useCore = getConfig().getBoolean("network.use-core-settings", true);
        networkEnabled = useCore ? core.getBoolean("network.enabled", getConfig().getBoolean("network.enabled", false)) : getConfig().getBoolean("network.enabled", false);
        localPlanet = useCore ? core.getString("network.local-planet", getConfig().getString("network.local-planet", "arrakis")) : getConfig().getString("network.local-planet", "arrakis");
    }

    Connection connectEconomyDatabase() throws Exception {
        if (jdbcUrl.isBlank()) throw new IllegalStateException("No shared economy database configured");
        return DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
    }

    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            int page = 1;
            if (args.length > 1 && args[1].equalsIgnoreCase("menu")) {
                if (sender instanceof Player player) openHelpMenu(player, 1);
                else sender.sendMessage("The visual guide is available in-game: /duneess help menu");
                return true;
            }
            if (args.length > 1) {
                if (args[1].equalsIgnoreCase("next")) page = (sender instanceof Player p ? helpPageByPlayer.getOrDefault(p.getUniqueId(), 1) : 1) + 1;
                else if (args[1].equalsIgnoreCase("previous") || args[1].equalsIgnoreCase("prev")) page = (sender instanceof Player p ? helpPageByPlayer.getOrDefault(p.getUniqueId(), 1) : 1) - 1;
                else try { page = Integer.parseInt(args[1]); } catch (NumberFormatException ignored) { }
            }
            if (sender instanceof Player player) sendHelpPage(player, page);
            else help(sender, page);
            return true;
        }
        String root = args[0].toLowerCase(Locale.ROOT);
        if (root.equals("balance")) {
            Player target = args.length > 1 && sender.hasPermission("dune.admin") ? Bukkit.getPlayerExact(args[1]) : sender instanceof Player p ? p : null;
            if (target == null) { sender.sendMessage("Usage: /duneess balance [online player]"); return true; }
            sender.sendMessage(ChatColor.GOLD + target.getName() + " has " + economy.format(economy.getBalance(target)) + ".");
            return true;
        }
        if (root.equals("sell")) { if (sender instanceof Player player) sellSpice(player); else sender.sendMessage("Run this command in-game."); return true; }
        if (root.equals("travel")) {
            if (!(sender instanceof Player player)) { sender.sendMessage("Run this command in-game."); return true; }
            if (args.length == 1) { openTravelMenu(player); return true; }
            travel(player, args[1]); return true;
        }
        if (root.equals("admin")) return admin(sender, args);
        sender.sendMessage(ChatColor.YELLOW + "Use /duneess help.");
        return true;
    }

    private void help(CommandSender sender, int page) {
        int index = Math.max(0, Math.min(HELP_PAGES.size() - 1, page - 1));
        sender.sendMessage(ChatColor.DARK_RED + "+" + "-".repeat(58) + "+");
        sendBoxLine(sender, ChatColor.GOLD + "DUNE FIELD GUIDE" + ChatColor.GRAY + "        PAGE " + (index + 1) + " OF " + HELP_PAGES.size());
        sender.sendMessage(ChatColor.DARK_RED + "+" + "-".repeat(58) + "+");
        for (HelpEntry entry : HELP_PAGES.get(index)) {
            sendBoxLine(sender, ChatColor.YELLOW + entry.command());
            for (String descriptionLine : wrap(entry.description(), 50))
                sendBoxLine(sender, ChatColor.GRAY + "  " + descriptionLine);
            sendBoxLine(sender, " ");
        }
        sender.sendMessage(ChatColor.DARK_RED + "+" + "-".repeat(58) + "+");
        sendBoxLine(sender, ChatColor.GRAY + "Use /duneess help menu for the visual guide.");
        sendBoxLine(sender, ChatColor.GRAY + "DuneEss: Solaris and Guild travel");
        sendBoxLine(sender, ChatColor.GRAY + "DuneCore: factions and Arrakis");
        sender.sendMessage(ChatColor.DARK_RED + "+" + "-".repeat(58) + "+");
        if (sender instanceof Player player) {
            helpPageByPlayer.put(player.getUniqueId(), index + 1);
            TextComponent nav = new TextComponent("§8[ " + (index == 0 ? "§8Previous Page" : "§ePrevious Page") + " §8]     ");
            if (index > 0) nav.setClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/duneess help previous"));
            TextComponent next = new TextComponent("§8[ " + (index == HELP_PAGES.size() - 1 ? "§8Next Page" : "§eNext Page") + " §8]");
            if (index < HELP_PAGES.size() - 1) next.setClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/duneess help next"));
            TextComponent pages = new TextComponent("§7   (page " + (index + 1) + "/" + HELP_PAGES.size() + ")");
            player.spigot().sendMessage(nav, next, pages);
        } else {
            sender.sendMessage(ChatColor.GRAY + "Page " + (index + 1) + " of " + HELP_PAGES.size() + " - /duneess help previous or next");
        }
    }

    private void sendHelpPage(Player player, int page) {
        int boundedPage = Math.max(1, Math.min(HELP_PAGES.size(), page));
        help(player, boundedPage);
    }

    private void sendBoxLine(CommandSender sender, String text) {
        String plain = ChatColor.stripColor(text);
        if (plain.length() > 56) plain = plain.substring(0, 53) + "...";
        String padding = " ".repeat(Math.max(0, 56 - plain.length()));
        sender.sendMessage(ChatColor.DARK_RED + "| " + text + padding + " " + ChatColor.DARK_RED + "|");
    }

    private List<String> wrap(String text, int width) {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split("\\s+")) {
            if (line.length() > 0 && line.length() + 1 + word.length() > width) {
                lines.add(line.toString());
                line.setLength(0);
            }
            if (line.length() > 0) line.append(' ');
            line.append(word);
        }
        if (line.length() > 0) lines.add(line.toString());
        return lines;
    }

    private void openHelpMenu(Player player, int page) {
        int index = Math.max(0, Math.min(HELP_PAGES.size() - 1, page - 1));
        Inventory menu = Bukkit.createInventory(null, 54, HELP_TITLE + ChatColor.DARK_GRAY + "  Page " + (index + 1) + " of " + HELP_PAGES.size());
        ItemStack frame = helpItem(Material.BLACK_STAINED_GLASS_PANE, ChatColor.DARK_GRAY + " ", null);
        for (int slot = 0; slot < 9; slot++) { menu.setItem(slot, frame); menu.setItem(45 + slot, frame); }
        for (int row = 1; row <= 4; row++) { menu.setItem(row * 9, frame); menu.setItem(row * 9 + 8, frame); }
        ItemStack heading = helpItem(Material.WRITABLE_BOOK, ChatColor.GOLD + "Dune Field Guide",
            List.of(ChatColor.GRAY + "Page " + (index + 1) + " of " + HELP_PAGES.size(), ChatColor.DARK_GRAY + "Click a command to run it."));
        menu.setItem(4, heading);
        int[] slots = {10, 12, 14, 16, 28, 30, 32};
        int n = 0;
        for (HelpEntry entry : HELP_PAGES.get(index)) {
            ItemStack item = helpItem(entry.icon(), ChatColor.YELLOW + entry.command(),
                List.of(ChatColor.GRAY + entry.description(), ChatColor.GREEN + "Click to run"));
            ItemMeta itemMeta = item.getItemMeta();
            if (!entry.command().endsWith(" player amount") && !entry.command().contains("["))
                itemMeta.getPersistentDataContainer().set(helpActionKey, PersistentDataType.STRING, entry.command());
            item.setItemMeta(itemMeta);
            menu.setItem(slots[n++], item);
        }
        ItemStack previous = helpItem(index == 0 ? Material.GRAY_STAINED_GLASS_PANE : Material.BOOK,
            ChatColor.YELLOW + "Previous page", List.of(ChatColor.GRAY + (index == 0 ? "You are on the first page." : "Go to page " + index)));
        ItemMeta previousMeta = previous.getItemMeta();
        previousMeta.getPersistentDataContainer().set(helpPageKey, PersistentDataType.INTEGER, index);
        previous.setItemMeta(previousMeta);
        menu.setItem(45, previous);
        menu.setItem(49, helpItem(Material.BARRIER, ChatColor.RED + "Close", List.of(ChatColor.GRAY + "Close this guide.")));
        ItemStack next = helpItem(index == HELP_PAGES.size() - 1 ? Material.GRAY_STAINED_GLASS_PANE : Material.WRITABLE_BOOK,
            ChatColor.YELLOW + "Next page", List.of(ChatColor.GRAY + (index == HELP_PAGES.size() - 1 ? "You are on the last page." : "Go to page " + (index + 2))));
        ItemMeta nextMeta = next.getItemMeta();
        nextMeta.getPersistentDataContainer().set(helpPageKey, PersistentDataType.INTEGER, index + 2);
        next.setItemMeta(nextMeta);
        menu.setItem(53, next);
        player.openInventory(menu);
    }

    private ItemStack helpItem(Material material, String name, List<String> lore) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(name);
        if (lore != null) meta.setLore(lore);
        item.setItemMeta(meta);
        return item;
    }

    @EventHandler public void onHelpMenuClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player) || !event.getView().getTitle().startsWith(HELP_TITLE)) return;
        event.setCancelled(true);
        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || !clicked.hasItemMeta()) return;
        ItemMeta meta = clicked.getItemMeta();
        Integer page = meta.getPersistentDataContainer().get(helpPageKey, PersistentDataType.INTEGER);
        if (page != null) { openHelpMenu(player, page); return; }
        if (clicked.getType() == Material.BARRIER) { player.closeInventory(); return; }
        String action = meta.getPersistentDataContainer().get(helpActionKey, PersistentDataType.STRING);
        if (action != null) { player.closeInventory(); player.performCommand(action.substring(1)); }
    }

    @EventHandler public void onHelpMenuDrag(org.bukkit.event.inventory.InventoryDragEvent event) {
        if (event.getView().getTitle().startsWith(HELP_TITLE)) event.setCancelled(true);
    }

    @EventHandler public void onPlayerJoin(PlayerJoinEvent event) {
        economy.createPlayerAccount(event.getPlayer());
    }

    private void sellSpice(Player player) {
        int amount = 0;
        for (ItemStack item : player.getInventory().getStorageContents()) {
            if (isSpice(item)) { amount += item.getAmount(); item.setAmount(0); }
        }
        if (amount == 0) { player.sendMessage(ChatColor.RED + "You have no tagged spice to sell."); return; }
        int price = Math.max(1, getConfig().getInt("currency.spice-price", 15));
        int gross = Math.multiplyExact(amount, price);
        int net = callCoreSaleAdjustment(player, gross);
        economy.depositPlayer(player, net);
        player.sendMessage(ChatColor.GOLD + "Sold " + amount + " spice for " + economy.format(net) + ".");
    }

    private boolean isSpice(ItemStack item) {
        return item != null && item.hasItemMeta()
            && "spice".equals(item.getItemMeta().getPersistentDataContainer().get(spiceKey, PersistentDataType.STRING));
    }

    private int callCoreSaleAdjustment(Player player, int gross) {
        Plugin core = Bukkit.getPluginManager().getPlugin("DuneCore");
        if (core == null || !core.isEnabled()) return gross;
        try {
            Method method = core.getClass().getMethod("processSpiceSale", Player.class, int.class);
            Object value = method.invoke(core, player, gross);
            if (value instanceof Number n) return Math.max(0, n.intValue());
        } catch (ReflectiveOperationException ex) { getLogger().warning("Could not apply DuneCore spice trade rules: " + ex.getMessage()); }
        return gross;
    }

    private void openTravelMenu(Player player) {
        Inventory inventory = Bukkit.createInventory(null, 9, ChatColor.DARK_AQUA + "Spacing Guild Travel");
        for (int i = 0; i < PLANETS.size(); i++) {
            String planet = PLANETS.get(i);
            ItemStack item = new ItemStack(Material.ENDER_PEARL);
            ItemMeta meta = item.getItemMeta();
            meta.setDisplayName(ChatColor.GOLD + planet + " — " + getConfig().getInt("currency.travel-price", 100) + " Solaris");
            meta.getPersistentDataContainer().set(new NamespacedKey(this, "planet"), PersistentDataType.STRING, planet);
            item.setItemMeta(meta);
            inventory.setItem(i, item);
        }
        player.openInventory(inventory);
    }

    @EventHandler public void onTravelMenuClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player) || !event.getView().getTitle().equals(ChatColor.DARK_AQUA + "Spacing Guild Travel")) return;
        event.setCancelled(true);
        ItemStack item = event.getCurrentItem();
        if (item == null || !item.hasItemMeta()) return;
        String planet = item.getItemMeta().getPersistentDataContainer().get(new NamespacedKey(this, "planet"), PersistentDataType.STRING);
        if (planet == null) return;
        player.closeInventory();
        travel(player, planet);
    }

    private void travel(Player player, String planet) {
        planet = planet.toLowerCase(Locale.ROOT);
        if (!PLANETS.contains(planet)) { player.sendMessage(ChatColor.RED + "Unknown planet."); return; }
        if (planet.equals("arrakis") && !callCoreArrakisAuthorization(player)) { player.sendMessage(ChatColor.RED + "Arrakis travel was not authorized."); return; }
        if (networkEnabled && !planet.equalsIgnoreCase(localPlanet)) {
            String server = getConfig().getString("network.servers." + planet, "");
            if (server.isBlank()) {
                YamlConfiguration core = YamlConfiguration.loadConfiguration(new File(getDataFolder().getParentFile(), "DuneCore/config.yml"));
                server = core.getString("network.servers." + planet, "");
            }
            if (server.isBlank()) { player.sendMessage(ChatColor.RED + "The Guild server for " + planet + " is not configured."); return; }
            int fare = travelFare(player, planet);
            if (fare > 0 && !economy.has(player, fare)) { player.sendMessage(ChatColor.RED + "Not enough Solaris for the Guild fare."); return; }
            if (fare > 0) economy.withdrawPlayer(player, fare);
            if (!sendToServer(player, server, planet) && fare > 0) economy.depositPlayer(player, fare);
            return;
        }
        World world = Bukkit.getWorld(planet);
        if (world == null) { player.sendMessage(ChatColor.RED + "That planet is not loaded on this server."); return; }
        int fare = travelFare(player, planet);
        if (fare > 0 && !economy.has(player, fare)) { player.sendMessage(ChatColor.RED + "Not enough Solaris for the Guild fare."); return; }
        if (fare > 0) economy.withdrawPlayer(player, fare);
        if (!player.teleport(world.getSpawnLocation())) {
            if (fare > 0) economy.depositPlayer(player, fare);
            player.sendMessage(ChatColor.RED + "Guild travel failed. Your fare was returned.");
        } else {
            player.sendMessage(ChatColor.AQUA + "Spacing Guild arrival: " + planet);
            if (planet.equals("arrakis")) callCoreArrakisArrival(player);
        }
    }

    private boolean sendToServer(Player player, String server, String planet) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            DataOutputStream data = new DataOutputStream(bytes);
            data.writeUTF("Connect"); data.writeUTF(server);
            player.sendPluginMessage(this, "BungeeCord", bytes.toByteArray());
            player.sendMessage(ChatColor.AQUA + "Spacing Guild transfer requested: " + planet);
            return true;
        } catch (Exception ex) {
            player.sendMessage(ChatColor.RED + "Guild transfer failed. Your fare was returned.");
            return false;
        }
    }

    private boolean callCoreArrakisAuthorization(Player player) {
        Plugin core = Bukkit.getPluginManager().getPlugin("DuneCore");
        if (core == null || !core.isEnabled()) return true;
        try {
            Method method = core.getClass().getMethod("authorizeArrakisTravel", Player.class);
            return Boolean.TRUE.equals(method.invoke(core, player));
        } catch (ReflectiveOperationException ex) { getLogger().warning("Could not authorize Arrakis travel with DuneCore: " + ex.getMessage()); return false; }
    }

    private void callCoreArrakisArrival(Player player) {
        Plugin core = Bukkit.getPluginManager().getPlugin("DuneCore");
        if (core == null || !core.isEnabled()) return;
        try { core.getClass().getMethod("enforceArrakisArrival", Player.class).invoke(core, player); }
        catch (ReflectiveOperationException ex) { getLogger().warning("Could not enforce Arrakis arrival rules: " + ex.getMessage()); }
    }

    private int travelFare(Player player, String planet) {
        if (planet.equals("arrakis")) {
            Plugin core = Bukkit.getPluginManager().getPlugin("DuneCore");
            if (core != null && core.isEnabled()) try {
                Method method = core.getClass().getMethod("hasFreeArrakisTravel", Player.class);
                if (Boolean.TRUE.equals(method.invoke(core, player))) return 0;
            } catch (ReflectiveOperationException ex) { getLogger().warning("Could not check Arrakis travel rights: " + ex.getMessage()); }
        }
        return Math.max(0, getConfig().getInt("currency.travel-price", 100));
    }

    private boolean admin(CommandSender sender, String[] args) {
        if (!sender.hasPermission("dune.admin")) { sender.sendMessage(ChatColor.RED + "Admin only."); return true; }
        if (args.length < 2) { sender.sendMessage("Usage: /duneess admin <solari|teleport|spicebloom> ..."); return true; }
        if (args[1].equalsIgnoreCase("solari")) {
            if (args.length != 4) { sender.sendMessage("Usage: /duneess admin solari <player> <amount>"); return true; }
            Player target = Bukkit.getPlayerExact(args[2]);
            if (target == null) { sender.sendMessage(ChatColor.RED + "That player must be online."); return true; }
            try {
                double amount = Double.parseDouble(args[3]);
                if (amount <= 0 || !Double.isFinite(amount)) throw new NumberFormatException();
                economy.depositPlayer(target, amount);
                sender.sendMessage(ChatColor.GREEN + "Added " + economy.format(amount) + " to " + target.getName() + ".");
                target.sendMessage(ChatColor.GOLD + "An admin added " + economy.format(amount) + " to your balance.");
            } catch (NumberFormatException ex) { sender.sendMessage(ChatColor.RED + "Enter a positive Solaris amount."); }
            return true;
        }
        if (args[1].equalsIgnoreCase("spicebloom")) {
            Player bloomTarget = args.length > 2 ? Bukkit.getPlayerExact(args[2]) : sender instanceof Player p ? p : null;
            if (bloomTarget == null) { sender.sendMessage("Usage: /duneess admin spicebloom [online player]"); return true; }
            World arrakisWorld = Bukkit.getWorld("arrakis");
            if (arrakisWorld == null) { sender.sendMessage(ChatColor.RED + "Arrakis is not loaded on this server."); return true; }
            spawnSpiceBloom(sender, bloomTarget, arrakisWorld);
            return true;
        }
        if (!args[1].equalsIgnoreCase("teleport")) { sender.sendMessage("Usage: /duneess admin teleport <arrakis|sietch|spiceblow> [player]"); return true; }
        if (args.length < 3) { sender.sendMessage("Usage: /duneess admin teleport <arrakis|sietch|spiceblow> [player]"); return true; }
        Player target = args.length > 3 ? Bukkit.getPlayerExact(args[3]) : sender instanceof Player p ? p : null;
        if (target == null) { sender.sendMessage(ChatColor.RED + "Specify an online player from console."); return true; }
        World arrakis = Bukkit.getWorld("arrakis");
        if (arrakis == null) { sender.sendMessage(ChatColor.RED + "Arrakis is not loaded on this server."); return true; }
        switch (args[2].toLowerCase(Locale.ROOT)) {
            case "arrakis" -> finishTeleport(sender, target, arrakis.getSpawnLocation(), "Arrakis spawn");
            case "sietch" -> teleportToSietch(sender, target, arrakis);
            case "spiceblow" -> teleportToSpiceBlow(sender, target, arrakis);
            default -> sender.sendMessage("Usage: /duneess admin teleport <arrakis|sietch|spiceblow> [player]");
        }
        return true;
    }

    private void finishTeleport(CommandSender sender, Player target, Location location, String label) {
        if (target.teleport(location)) { target.sendMessage(ChatColor.AQUA + "An admin sent you to " + label + "."); sender.sendMessage(ChatColor.GREEN + "Teleported " + target.getName() + " to " + label + "."); }
        else sender.sendMessage(ChatColor.RED + "Teleport failed.");
    }

    private void teleportToSietch(CommandSender sender, Player target, World world) {
        Location origin = target.getWorld().equals(world) ? target.getLocation() : world.getSpawnLocation();
        for (long[] c : candidates(origin, 0x534945544348L)) {
            int x=(int)c[0], z=(int)c[1];
            world.getChunkAt(x >> 4, z >> 4).load(true);
            int chestX=x, chestZ=z-10, estimate=world.getHighestBlockYAt(x+12,z+12);
            for (int y=Math.max(world.getMinHeight()+1,estimate-80); y<=Math.min(world.getMaxHeight()-1,estimate+5); y++) {
                Block b=world.getBlockAt(chestX,y,chestZ);
                if (b.getType()==Material.CHEST && b.getState() instanceof org.bukkit.block.Chest chest && "Personal Sietch Cache".equals(chest.getCustomName())) {
                    finishTeleport(sender,target,new Location(world,x+.5,y+14,z+.5),"a sietch"); return;
                }
            }
        }
        sender.sendMessage(ChatColor.RED+"No generated sietch was found nearby. Explore new Arrakis terrain, then retry.");
    }

    private void teleportToSpiceBlow(CommandSender sender, Player target, World world) {
        for (long[] c : candidates(target.getWorld().equals(world)?target.getLocation():world.getSpawnLocation(),0x5350494345424c4fL)) {
            int x=(int)c[0],z=(int)c[1]; world.getChunkAt(x>>4,z>>4).load(true);
            int top=world.getHighestBlockYAt(x,z); Material marker=world.getBlockAt(x,top,z).getType();
            if(marker==Material.MAGMA_BLOCK||marker==Material.GLOWSTONE) {
                int sx=x+4,sz=z+4; finishTeleport(sender,target,new Location(world,sx+.5,world.getHighestBlockYAt(sx,sz)+1,sz+.5),"a spice blow"); return;
            }
        }
        sender.sendMessage(ChatColor.RED+"No spice blow was found nearby. Explore new Arrakis terrain, then retry.");
    }

    private List<long[]> candidates(Location origin,long salt) {
        int spacing=2000; long gx0=Math.floorDiv(origin.getBlockX(),spacing),gz0=Math.floorDiv(origin.getBlockZ(),spacing);
        List<long[]> points=new ArrayList<>();
        for(long gx=gx0-2;gx<=gx0+2;gx++)for(long gz=gz0-2;gz<=gz0+2;gz++){
            long h1=mix64(gx*0x9E3779B97F4A7C15L^gz*0xC2B2AE3D27D4EB4FL^salt);
            long h2=mix64(gz*0x165667B19E3779F9L^gx*0x85EBCA77C2B2AE63L^~salt);
            long x=gx*spacing+8+Math.floorMod(h1,spacing-16),z=gz*spacing+8+Math.floorMod(h2,spacing-16);
            long dx=x-origin.getBlockX(),dz=z-origin.getBlockZ();points.add(new long[]{x,z,dx*dx+dz*dz});
        }
        points.sort(Comparator.comparingLong(point->point[2]));return points;
    }
    private static long mix64(long value){value=(value^(value>>>30))*0xBF58476D1CE4E5B9L;value=(value^(value>>>27))*0x94D049BB133111EBL;return value^(value>>>31);}

    private void spawnSpiceBloom(CommandSender sender, Player target, World world) {
        if(!target.getWorld().equals(world)){sender.sendMessage(ChatColor.RED+"The target must be on Arrakis.");return;}
        double base=Math.toRadians(90.0-target.getLocation().getYaw()); Block center=null;
        for(int offset=-12;offset<=12;offset++){
            double angle=base+Math.toRadians(offset*15.0);int x=target.getLocation().getBlockX()+(int)Math.round(Math.cos(angle)*50),z=target.getLocation().getBlockZ()+(int)Math.round(Math.sin(angle)*50),y=world.getHighestBlockYAt(x,z);boolean ok=true;
            for(int dx=-1;dx<=1&&ok;dx++)for(int dz=-1;dz<=1;dz++){Block b=world.getBlockAt(x+dx,y,z+dz);if((b.getType()!=Material.SAND&&b.getType()!=Material.RED_SAND)||!world.getBlockAt(x+dx,y+1,z+dz).isPassable()){ok=false;break;}}
            if(ok&&world.getBlockAt(x,y+2,z).isPassable()){center=world.getBlockAt(x,y,z);break;}
        }
        if(center==null){sender.sendMessage(ChatColor.RED+"No clear sand patch was found 50 blocks ahead.");return;}
        int x=center.getX(),y=center.getY(),z=center.getZ();for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)world.getBlockAt(x+dx,y,z+dz).setType(Material.MAGMA_BLOCK,false);world.getBlockAt(x,y+1,z).setType(Material.MAGMA_BLOCK,false);
        sender.sendMessage(ChatColor.GREEN+"Placed a spice bloom near "+x+", "+z+".");target.sendMessage(ChatColor.GOLD+"A spice bloom appeared about 50 blocks ahead.");
    }

    @Override public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if(args.length==1)return complete(List.of("help","balance","sell","travel","admin"),args[0]);
        if(args[0].equalsIgnoreCase("help")&&args.length==2)return complete(List.of("1","2","3","4","next","previous","menu"),args[1]);
        if(args[0].equalsIgnoreCase("travel")&&args.length==2)return complete(PLANETS,args[1]);
        if(args[0].equalsIgnoreCase("admin")&&sender.hasPermission("dune.admin")){
            if(args.length==2)return complete(List.of("solari","teleport","spicebloom"),args[1]);
            if(args[1].equalsIgnoreCase("teleport")&&args.length==3)return complete(List.of("arrakis","sietch","spiceblow"),args[2]);
            if(args[1].equalsIgnoreCase("spicebloom")&&args.length==3)return complete(Bukkit.getOnlinePlayers().stream().map(Player::getName).toList(),args[2]);
            if((args[1].equalsIgnoreCase("teleport")||args[1].equalsIgnoreCase("solari"))&&args.length==4)return complete(Bukkit.getOnlinePlayers().stream().map(Player::getName).toList(),args[3]);
        }
        if(args[0].equalsIgnoreCase("balance")&&args.length==2&&sender.hasPermission("dune.admin"))return complete(Bukkit.getOnlinePlayers().stream().map(Player::getName).toList(),args[1]);
        return List.of();
    }
    private List<String> complete(Collection<String> options,String prefix){return options.stream().filter(s->s.toLowerCase(Locale.ROOT).startsWith(prefix.toLowerCase(Locale.ROOT))).sorted(String.CASE_INSENSITIVE_ORDER).toList();}
}

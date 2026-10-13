package com.example.dunenpc;

import com.example.dunerealms.Politics;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.EntityTeleportEvent;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import java.io.File;
import java.io.IOException;
import java.util.*;

/** Local Arrakis delivery contracts; cargo is the existing tagged trade items. */
final class Smugglers implements Listener {
    private final DuneNPC plugin;
    private final Economy economy;
    private final Politics politics;
    private final NamespacedKey traderKey, spiceKey, waterKey;
    private final File file;
    private final YamlConfiguration data;
    private final Map<UUID, Contract> contracts = new HashMap<>();
    private final Random random = new Random();
    private final SmugglerCamps camps;
    static final long MISSION_MILLIS = 30 * 60 * 1000L;
    record Contract(String commodity, int amount, int reward, UUID source, double x, double z, long expiresAt) {
        Contract(String commodity, int amount, int reward, UUID source, double x, double z) {
            this(commodity, amount, reward, source, x, z, System.currentTimeMillis() + MISSION_MILLIS);
        }
        boolean expired(long now) { return now >= expiresAt; }
    }
    private static final class Menu implements InventoryHolder {
        private Inventory inventory;
        private final UUID trader;
        Menu(UUID trader) { this.trader = trader; }
        @Override public Inventory getInventory() { return inventory; }
    }

    Smugglers(DuneNPC plugin, Economy economy, Politics politics) {
        this.plugin = plugin; this.economy = economy; this.politics = politics;
        traderKey = new NamespacedKey("dunecore", "smuggler");
        spiceKey = new NamespacedKey("dunerealms", "item");
        waterKey = new NamespacedKey("dunerealms", "finite_arrakis_water");
        file = new File(plugin.getDataFolder(), "smuggling.yml");
        data = YamlConfiguration.loadConfiguration(file);
        boolean migrated = false;
        for (String key : data.getKeys(false)) try {
            String commodity = data.getString(key + ".commodity", "");
            int amount = data.getInt(key + ".amount"), reward = data.getInt(key + ".reward");
            if (!Set.of("spice", "water").contains(commodity) || amount < 1 || reward < 1) continue;
            contracts.put(UUID.fromString(key), new Contract(commodity, amount, reward,
                UUID.fromString(data.getString(key + ".source", "")), data.getDouble(key + ".x"), data.getDouble(key + ".z"),
                data.getLong(key + ".expires-at", System.currentTimeMillis() + MISSION_MILLIS)));
            if (!data.contains(key + ".expires-at")) migrated = true;
        } catch (IllegalArgumentException ignored) { }
        if (migrated) save();
        camps = new SmugglerCamps(plugin);
        Bukkit.getPluginManager().registerEvents(this, plugin);
        Bukkit.getScheduler().runTaskTimer(plugin, this::populate, 100L, 1200L);
        Bukkit.getScheduler().runTaskTimer(plugin, this::updateCamps, 1L, 20L);
    }
    private Set<UUID> activeSources() {
        Set<UUID> ids = new HashSet<>();
        for (Contract contract : contracts.values()) ids.add(contract.source());
        return ids;
    }
    private void updateCamps() {
        expireContracts();
        Set<UUID> active = plugin.getConfig().getBoolean("smugglers.enabled", true) ? activeSources() : Set.of();
        camps.sync(active);
        if (!plugin.getConfig().getBoolean("smugglers.enabled", true)) return;
        World world = Bukkit.getWorld("arrakis");
        if (world == null) return;
        for (WanderingTrader trader : world.getEntitiesByClass(WanderingTrader.class)) if (tagged(trader)) {
            Color color = active.contains(trader.getUniqueId()) ? Color.fromRGB(170, 60, 230) : Color.fromRGB(50, 220, 80);
            world.spawnParticle(Particle.DUST, trader.getLocation().add(0, 2.1, 0), 8, .35, .25, .35, 0,
                new Particle.DustOptions(color, 1.2f));
        }
    }
    private void expireContracts() {
        long now = System.currentTimeMillis();
        Map<UUID, Contract> expired = new HashMap<>();
        contracts.forEach((id, contract) -> { if (contract.expired(now)) expired.put(id, contract); });
        if (expired.isEmpty()) return;
        expired.keySet().forEach(contracts::remove);
        if (!save()) { contracts.putAll(expired); return; }
        for (UUID id : expired.keySet()) {
            Player player = Bukkit.getPlayer(id);
            if (player != null) player.sendMessage(ChatColor.GOLD + "Smuggler: 'The patrols have changed. Your 30-minute window is gone.' Mission expired; cargo kept, no reward.");
        }
    }
    private String timeLeft(Contract contract) {
        long seconds = Math.max(0, (contract.expiresAt() - System.currentTimeMillis() + 999) / 1000);
        return "Time left: " + seconds / 60 + "m " + seconds % 60 + "s (real time, including offline).";
    }
    void shutdown() { camps.sync(Set.of()); }
    @EventHandler public void teleport(EntityTeleportEvent event) {
        if (activeSources().contains(event.getEntity().getUniqueId())) event.setCancelled(true);
    }

    private boolean sanctioned(Player player) {
        String house = plugin.core().factionOf(player);
        return politics.isAuthorizedSpice(house) || politics.isAuthorizedWater(house);
    }
    int activeCount() { expireContracts(); return contracts.size(); }
    void spawnAt(Location location) {
        if (!plugin.getConfig().getBoolean("smugglers.enabled", true)) return;
        location.getWorld().spawn(location, WanderingTrader.class, this::mark);
    }
    private boolean tagged(Entity entity) {
        return entity instanceof WanderingTrader && entity.getPersistentDataContainer().has(traderKey, PersistentDataType.BYTE);
    }
    private void mark(WanderingTrader trader) {
        trader.getPersistentDataContainer().set(traderKey, PersistentDataType.BYTE, (byte) 1);
        trader.setCustomName(ChatColor.GOLD + "Arrakis Smuggler");
        trader.setCustomNameVisible(true);
        trader.setRecipes(List.of());
        trader.setAI(true);
        trader.setCanDrinkPotion(false);
        trader.setDespawnDelay(48000);
    }
    @EventHandler(ignoreCancelled = true) public void spawn(CreatureSpawnEvent event) {
        if (plugin.getConfig().getBoolean("smugglers.enabled", true)
            && event.getLocation().getWorld().getName().equalsIgnoreCase("arrakis")
            && event.getEntity() instanceof WanderingTrader trader) mark(trader);
    }
    private void populate() {
        if (!plugin.getConfig().getBoolean("smugglers.enabled", true)) return;
        World world = Bukkit.getWorld("arrakis");
        if (world == null || world.getPlayers().isEmpty()) return;
        int count = 0;
        for (WanderingTrader trader : world.getEntitiesByClass(WanderingTrader.class)) {
            if (!tagged(trader)) mark(trader);
            roam(trader);
            count++;
        }
        int maximum = Math.max(2, Math.min(20, plugin.getConfig().getInt("smugglers.max-traders", 6)));
        // At most two new traders per minute, only in already-loaded chunks near players.
        for (int attempt = 0, added = 0; attempt < 20 && count < maximum && added < 2; attempt++) {
            Player player = world.getPlayers().get(random.nextInt(world.getPlayers().size()));
            double angle = random.nextDouble() * Math.PI * 2;
            int radius = 24 + random.nextInt(25);
            int x = player.getLocation().getBlockX() + (int) (Math.cos(angle) * radius);
            int z = player.getLocation().getBlockZ() + (int) (Math.sin(angle) * radius);
            if (!world.isChunkLoaded(x >> 4, z >> 4)) continue;
            int y = world.getHighestBlockYAt(x, z);
            Location location = new Location(world, x + .5, y + 1, z + .5);
            if (y + 2 >= world.getMaxHeight() || !world.getBlockAt(x, y, z).getType().isSolid()
                || !world.getBlockAt(x, y + 1, z).isPassable() || !world.getBlockAt(x, y + 2, z).isPassable()
                || !world.getWorldBorder().isInside(location)) continue;
            WanderingTrader trader = world.spawn(location, WanderingTrader.class, this::mark);
            roam(trader);
            if (trader.isValid()) { count++; added++; }
        }
    }
    private void roam(WanderingTrader trader) {
        if (activeSources().contains(trader.getUniqueId())) return;
        Location here = trader.getLocation();
        int x = here.getBlockX() + random.nextInt(49) - 24;
        int z = here.getBlockZ() + random.nextInt(49) - 24;
        World world = trader.getWorld();
        if (!world.isChunkLoaded(x >> 4, z >> 4)) return;
        int y = world.getHighestBlockYAt(x, z);
        Location destination = new Location(world, x + .5, y + 1, z + .5);
        if (y + 2 < world.getMaxHeight() && world.getBlockAt(x, y, z).getType().isSolid()
            && world.getBlockAt(x, y + 1, z).isPassable() && world.getWorldBorder().isInside(destination))
            trader.setWanderingTowards(destination);
    }

    @EventHandler(ignoreCancelled = true) public void interact(PlayerInteractEntityEvent event) {
        if (!tagged(event.getRightClicked())) return;
        event.setCancelled(true);
        if (!plugin.getConfig().getBoolean("smugglers.enabled", true)) return;
        if (event.getHand() != EquipmentSlot.HAND) return;
        Player player = event.getPlayer();
        if (sanctioned(player)) {
            player.sendMessage(ChatColor.GOLD + "Smuggler: 'The Emperor's seal is on your house. I won't risk my routes for an Imperial agent. Sell through your charter: /duneess sell pays +33% before the Trust levy.'");
            return;
        }
        open(player, event.getRightClicked());
    }
    private ItemStack icon(Material type, String title, String... lines) {
        ItemStack item = new ItemStack(type);
        ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(ChatColor.GOLD + title);
        meta.setLore(Arrays.stream(lines).map(line -> ChatColor.GRAY + line).toList());
        item.setItemMeta(meta); return item;
    }
    private void open(Player player, Entity trader) {
        Menu holder = new Menu(trader.getUniqueId());
        holder.inventory = Bukkit.createInventory(holder, 27, ChatColor.GOLD + "Arrakis | Smuggler Contracts");
        for (int i = 0; i < 27; i++) holder.inventory.setItem(i, icon(Material.BROWN_STAINED_GLASS_PANE, " "));
        Contract active = contracts.get(player.getUniqueId());
        if (active == null) {
            Contract spice = offer("spice", trader), water = offer("water", trader);
            holder.inventory.setItem(11, icon(Material.ORANGE_DYE, "The Unmarked Spice Run",
                "'Imperial patrols count every grain of melange.'",
                "'Our hidden buyers need a shipment without a seal.'",
                "Deliver " + spice.amount() + " tagged spice to another smuggler.", "Reward: " + spice.reward() + " Solaris before levy.", "Deadline: 30 real minutes, including offline time."));
            holder.inventory.setItem(15, icon(Material.WATER_BUCKET, "Water for the Hidden Sietch",
                "'A sietch beyond the patrol routes is running dry.'",
                "'Carry its water quietly. On Arrakis, water is life.'",
                "Deliver " + water.amount() + " finite-source water buckets.", "Reward: " + water.reward() + " Solaris before levy.", "Deadline: 30 real minutes, including offline time."));
        } else {
            holder.inventory.setItem(13, icon(Material.CHEST, "Deliver " + active.commodity(),
                "Required cargo: " + active.amount(), "Reward: " + active.reward() + " Solaris before levy.",
                timeLeft(active),
                "Use a different smuggler, 64+ blocks from the starting point.",
                "Departure: X " + (int) active.x() + " / Z " + (int) active.z(),
                active.commodity().equals("spice") ? "'Keep the melange beyond the Emperor's ledgers.'" : "'The hidden sietch is counting on you.'",
                "Illegal delivery triggers the existing bounty system."));
            holder.inventory.setItem(22, icon(Material.BARRIER, "Cancel Contract", "No cargo or Solaris is taken."));
        }
        player.openInventory(holder.inventory);
    }
    private Contract offer(String commodity, Entity trader) {
        int amount = Math.max(1, Math.min(commodity.equals("spice") ? 4096 : 36,
            plugin.getConfig().getInt("smugglers." + commodity + "-amount", commodity.equals("spice") ? 64 : 4)));
        int base = commodity.equals("spice") ? plugin.core().spiceSellPrice() : Math.max(1, plugin.core().spiceSellPrice() / 2);
        int reward = (int) Math.min(Integer.MAX_VALUE, Math.round((double) amount * base * 1.45));
        return new Contract(commodity, amount, reward, trader.getUniqueId(), trader.getLocation().getX(), trader.getLocation().getZ());
    }

    @EventHandler public void click(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder() instanceof Menu menu)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player) || event.getClickedInventory() != event.getView().getTopInventory()) return;
        int slot = event.getRawSlot();
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!player.isOnline()) return;
            player.closeInventory();
            expireContracts();
            if (!plugin.getConfig().getBoolean("smugglers.enabled", true)) return;
            if (sanctioned(player)) { player.sendMessage(ChatColor.RED + "Imperial sanction: smuggling contracts are unavailable."); return; }
            Entity trader = Bukkit.getEntity(menu.trader);
            if (trader == null || !trader.isValid() || !tagged(trader)
                || !trader.getWorld().getName().equalsIgnoreCase("arrakis") || player.getWorld() != trader.getWorld()
                || player.getLocation().distanceSquared(trader.getLocation()) > 64) {
                player.sendMessage(ChatColor.RED + "Return to the smuggler to trade."); return;
            }
            Contract active = contracts.get(player.getUniqueId());
            if (active == null && (slot == 11 || slot == 15)) {
                contracts.put(player.getUniqueId(), offer(slot == 11 ? "spice" : "water", trader));
                if (!save()) { contracts.remove(player.getUniqueId()); player.sendMessage("Contract could not be saved. Try again."); return; }
                updateCamps();
                player.sendMessage(ChatColor.GOLD + (slot == 11
                    ? "Smuggler: 'The melange must vanish from the Imperial ledger. My distant contact will pay for your silence.'"
                    : "Smuggler: 'The hidden sietch has no water to spare. Reach my distant contact, and its people will remember.'"));
                player.sendMessage("Carry the cargo to another smuggler 64+ blocks from here. /dune smuggle status shows your contract.");
                player.sendMessage("You have 30 real minutes, including offline time. Your contact will wait at this lit camp until the contract ends.");
            } else if (active != null && slot == 22) {
                contracts.remove(player.getUniqueId());
                if (!save()) contracts.put(player.getUniqueId(), active);
                else { updateCamps(); player.sendMessage("Smuggling contract cancelled."); }
            } else if (active != null && slot == 13) deliver(player, trader, active);
        });
    }
    @EventHandler public void drag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof Menu) event.setCancelled(true);
    }
    static boolean validDestination(Contract contract, UUID trader, double x, double z) {
        return !contract.source().equals(trader) && Math.pow(x - contract.x(), 2) + Math.pow(z - contract.z(), 2) >= 4096;
    }
    private boolean cargo(ItemStack item, String commodity) {
        if (item == null || !item.hasItemMeta()) return false;
        if (commodity.equals("spice")) return "spice".equals(item.getItemMeta().getPersistentDataContainer().get(spiceKey, PersistentDataType.STRING));
        return item.getType() == Material.WATER_BUCKET && item.getItemMeta().getPersistentDataContainer().has(waterKey, PersistentDataType.BYTE);
    }
    private void deliver(Player player, Entity trader, Contract contract) {
        if (contract.expired(System.currentTimeMillis())) { updateCamps(); player.sendMessage("The 30-minute delivery window has expired."); return; }
        if (!validDestination(contract, trader.getUniqueId(), trader.getLocation().getX(), trader.getLocation().getZ())) {
            player.sendMessage("Find a different smuggler at least 64 blocks from the starting point."); return;
        }
        ItemStack[] original = player.getInventory().getStorageContents();
        ItemStack[] remaining = Arrays.stream(original).map(item -> item == null ? null : item.clone()).toArray(ItemStack[]::new);
        int needed = contract.amount();
        for (int i = 0; i < remaining.length && needed > 0; i++) if (cargo(remaining[i], contract.commodity())) {
            int taken = Math.min(needed, remaining[i].getAmount());
            needed -= taken;
            if (remaining[i].getAmount() == taken) remaining[i] = null;
            else remaining[i].setAmount(remaining[i].getAmount() - taken);
        }
        if (needed > 0) { player.sendMessage("You still need " + needed + " tagged " + contract.commodity() + "."); return; }
        // Persist completion before paying, preventing replay of a completed contract after restart.
        contracts.remove(player.getUniqueId());
        if (!save()) { contracts.put(player.getUniqueId(), contract); player.sendMessage("Delivery could not be saved. Try again."); return; }
        int net = Math.max(0, contract.reward() - politics.levyAmount(contract.reward()));
        if (!economy.depositPlayer(player, net).transactionSuccess()) {
            contracts.put(player.getUniqueId(), contract); save();
            player.sendMessage("Payment failed. Cargo kept; try delivery again."); return;
        }
        politics.levy(player.getUniqueId(), contract.reward());
        updateCamps();
        player.getInventory().setStorageContents(remaining);
        if (contract.commodity().equals("water")) {
            for (ItemStack bucket : player.getInventory().addItem(new ItemStack(Material.BUCKET, contract.amount())).values())
                player.getWorld().dropItemNaturally(player.getLocation(), bucket);
        }
        plugin.core().reportSmuggling(player, contract.commodity().toUpperCase(Locale.ROOT), contract.reward());
        player.sendMessage(ChatColor.GOLD + (contract.commodity().equals("spice")
            ? "Smuggler: 'No seal, no names. The melange is already on its way. The Emperor's men may have noticed you.'"
            : "Smuggler: 'Tonight the sietch drinks. Keep your route secret; the water monopoly has long eyes.'"));
        player.sendMessage(ChatColor.GOLD + "Smuggling delivery complete: " + net + " Solaris after the Trust levy.");
    }
    void command(Player player, String[] args) {
        expireContracts();
        Contract contract = contracts.get(player.getUniqueId());
        if (contract == null) { player.sendMessage("No smuggling contract. Seek a roaming Arrakis Smuggler."); return; }
        if (args.length > 1 && args[1].equalsIgnoreCase("cancel")) {
            contracts.remove(player.getUniqueId());
            if (!save()) contracts.put(player.getUniqueId(), contract);
            else { updateCamps(); player.sendMessage("Contract cancelled. Cargo kept."); }
            return;
        }
        player.sendMessage(ChatColor.GOLD + (contract.commodity().equals("spice") ? "The Unmarked Spice Run" : "Water for the Hidden Sietch"));
        player.sendMessage(timeLeft(contract));
        player.sendMessage("Deliver " + contract.amount() + " tagged " + contract.commodity() + " to another Arrakis Smuggler, 64+ blocks from X "
            + (int) contract.x() + " / Z " + (int) contract.z() + ". Reward: " + contract.reward() + " Solaris before levy. /dune smuggle cancel abandons it.");
        if (sanctioned(player)) player.sendMessage("Your Imperial sanction blocks delivery. Cancel the contract or wait for the appointment to expire.");
    }
    private boolean save() {
        for (String key : new HashSet<>(data.getKeys(false))) data.set(key, null);
        contracts.forEach((id, contract) -> {
            String key = id.toString();
            data.set(key + ".commodity", contract.commodity()); data.set(key + ".amount", contract.amount());
            data.set(key + ".reward", contract.reward()); data.set(key + ".source", contract.source().toString());
            data.set(key + ".x", contract.x()); data.set(key + ".z", contract.z());
            data.set(key + ".expires-at", contract.expiresAt());
        });
        try { data.save(file); return true; }
        catch (IOException exception) { plugin.getLogger().severe("Cannot save smuggling contracts: " + exception.getMessage()); return false; }
    }
}

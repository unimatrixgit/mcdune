package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import java.util.List;
import java.util.Map;

/** Operator-only controls. The persistent tag, rather than the display name, identifies the rod. */
final class AdminGui implements Listener {
    private final DuneCore plugin;
    private final NamespacedKey rodKey;
    private static final Map<Integer, String> COMMANDS = Map.of(
        10, "summon sandworm", 12, "guildnpc", 14, "givespice",
        16, "guireload", 20, "kit", 22, "npcadmin", 24, "politics status");

    private static final class Menu implements InventoryHolder {
        private Inventory inventory;
        @Override public Inventory getInventory() { return inventory; }
    }

    AdminGui(DuneCore plugin) {
        this.plugin = plugin;
        rodKey = new NamespacedKey(plugin, "admin_rod");
        Bukkit.getPluginManager().registerEvents(this, plugin);
        // Also handles newly opped online players and retries when an inventory was full.
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            for (Player player : Bukkit.getOnlinePlayers()) {
                if (player.isOp()) giveRod(player);
                else if (player.getOpenInventory().getTopInventory().getHolder() instanceof Menu)
                    player.closeInventory();
            }
        }, 1L, 100L);
    }

    boolean isRod(ItemStack item) {
        return item != null && item.getType() == Material.BLAZE_ROD && item.hasItemMeta()
            && item.getItemMeta().getPersistentDataContainer().has(rodKey, PersistentDataType.BYTE);
    }

    void giveRod(Player player) {
        if (!player.isOp()) return;
        for (ItemStack item : player.getInventory().getContents()) if (isRod(item)) return;
        if (player.getInventory().firstEmpty() < 0) return;
        ItemStack rod = icon(Material.BLAZE_ROD, "Imperial Admin Scepter",
            "Right-click to open the admin controls.", "Operators only.");
        ItemMeta meta = rod.getItemMeta();
        meta.getPersistentDataContainer().set(rodKey, PersistentDataType.BYTE, (byte) 1);
        meta.setEnchantmentGlintOverride(true);
        meta.setCustomModelData(1006);
        rod.setItemMeta(meta);
        player.getInventory().addItem(rod);
    }

    void open(Player player) {
        if (!player.isOp()) { player.sendMessage(ChatColor.RED + "Operators only."); return; }
        Menu holder = new Menu();
        holder.inventory = Bukkit.createInventory(holder, 36, ChatColor.GOLD + "Dune | Imperial Administration");
        for (int slot = 0; slot < 36; slot++) holder.inventory.setItem(slot, icon(Material.BLACK_STAINED_GLASS_PANE, " "));
        holder.inventory.setItem(10, icon(Material.SNIFFER_SPAWN_EGG, "Summon Shai-Hulud", "Spawn a sandworm at your position on Arrakis."));
        holder.inventory.setItem(12, icon(Material.VILLAGER_SPAWN_EGG, "Place Guild Navigator", "Spawn a Guild NPC at your position."));
        holder.inventory.setItem(14, icon(Material.ORANGE_DYE, "Give Test Spice", "Receive one tagged spice item."));
        holder.inventory.setItem(16, icon(Material.COMPARATOR, "Reload Menus", "Reload gui.yml from disk."));
        holder.inventory.setItem(20, icon(Material.NETHERITE_CHESTPLATE, "Receive Faction Kit", "Receive your selected faction's kit."));
        holder.inventory.setItem(22, icon(Material.WANDERING_TRADER_SPAWN_EGG, "DuneNPC Management", "Open NPC spawning and mission status controls."));
        holder.inventory.setItem(24, icon(Material.WRITABLE_BOOK, "Imperial Status", "View politics, appointments and Trust status."));
        holder.inventory.setItem(31, icon(Material.BARRIER, "Close"));
        player.openInventory(holder.inventory);
    }

    private ItemStack icon(Material material, String name, String... lore) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(ChatColor.GOLD + name);
        meta.setLore(List.of(lore).stream().map(line -> ChatColor.GRAY + line).toList());
        item.setItemMeta(meta);
        return item;
    }

    @EventHandler public void interact(PlayerInteractEvent event) {
        if (!isRod(event.getItem())) return;
        event.setCancelled(true);
        if (event.getHand() != EquipmentSlot.HAND) return;
        if (event.getAction() == Action.RIGHT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_BLOCK)
            open(event.getPlayer());
    }

    @EventHandler public void click(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder() instanceof Menu)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player)) return;
        if (!player.isOp()) { player.closeInventory(); return; }
        if (event.getClickedInventory() != event.getView().getTopInventory()) return;
        String command = COMMANDS.get(event.getRawSlot());
        if (command == null && event.getRawSlot() != 31) return;
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!player.isOnline()) return;
            player.closeInventory();
            if (player.isOp() && command != null) plugin.runGuiCommand(player, command);
        });
    }

    @EventHandler public void drag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof Menu) event.setCancelled(true);
    }
}

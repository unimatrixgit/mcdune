package com.example.duneterrain;

import org.bukkit.*;
import org.bukkit.block.Biome;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.block.Chest;
import org.bukkit.block.BlockState;
import org.bukkit.block.data.type.Bed;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Arrow;
import org.bukkit.entity.Trident;
import org.bukkit.entity.Villager;
import io.papermc.paper.event.entity.EntityMoveEvent;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.generator.*;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.server.ServerLoadEvent;
import org.bukkit.event.world.ChunkLoadEvent;
import java.io.File;
import java.util.*;

public final class DuneTerrain extends JavaPlugin implements Listener {
    private static final String[] PLANETS = {"arrakis", "giedi_prime", "kaitain", "caladan", "sigma_draconis_iv"};
    private NamespacedKey guildKey;
    private NamespacedKey sietchLootIdKey;
    private final Map<UUID, PersonalLoot> openSietchLoot = new HashMap<>();
    private record PersonalLoot(Inventory inventory, String id) {}

    public void announceSpiceBloom(Location location) {
        org.bukkit.plugin.Plugin core = Bukkit.getPluginManager().getPlugin("DuneCore");
        if (core == null || !core.isEnabled()) return;
        try {
            String id = "bloom:" + location.getWorld().getUID() + ":" + location.getBlockX() + ":" + location.getBlockY() + ":" + location.getBlockZ();
            core.getClass().getMethod("announceArrakisEvent", String.class, Location.class, String.class)
                .invoke(core, "spicebloom", location, id);
        } catch (ReflectiveOperationException ex) { getLogger().warning("Spice bloom announcement failed: " + ex.getMessage()); }
    }

    @EventHandler public void onBloomChunkLoad(ChunkLoadEvent event) {
        if (!event.getWorld().getName().equalsIgnoreCase("arrakis")) return;
        Chunk chunk = event.getChunk();
        Bukkit.getScheduler().runTask(this, () -> inspectBlooms(chunk));
    }

    private void inspectBlooms(Chunk chunk) {
        World world = chunk.getWorld();
        if (!chunk.isLoaded()) return;
        for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) {
            int wx = chunk.getX() * 16 + x, wz = chunk.getZ() * 16 + z;
            int y = world.getHighestBlockYAt(wx, wz);
            // The raised marker sits above a 3x3 magma patch; no neighbouring chunk access.
            if (y > world.getMinHeight() && chunk.getBlock(x, y, z).getType() == Material.MAGMA_BLOCK
                && chunk.getBlock(x, y - 1, z).getType() == Material.MAGMA_BLOCK)
                announceSpiceBloom(new Location(world, wx, y, wz));
        }
    }

    @EventHandler public void onSpiceBlowProjectile(ProjectileHitEvent event) {
        if (!(event.getEntity() instanceof Arrow) && !(event.getEntity() instanceof Trident)) return;
        if (event.getHitBlock() != null) triggerSpiceBlowAt(event.getHitBlock().getLocation());
        else if (event.getHitEntity() != null) triggerSpiceBlowAt(event.getHitEntity().getLocation());
    }

    @EventHandler public void onSpiceBlowPlayerMove(PlayerMoveEvent event) {
        if (event.getTo() == null || (event.getFrom().getBlockX() == event.getTo().getBlockX()
            && event.getFrom().getBlockY() == event.getTo().getBlockY()
            && event.getFrom().getBlockZ() == event.getTo().getBlockZ())) return;
        triggerSpiceBlowAt(event.getTo());
    }

    @EventHandler public void onSpiceBlowEntityMove(EntityMoveEvent event) {
        if (event.hasChangedBlock() && event.getTo() != null) triggerSpiceBlowAt(event.getTo());
    }

    private void triggerSpiceBlowAt(Location location) {
        if (location == null || location.getWorld() == null || !location.getWorld().getName().equalsIgnoreCase("arrakis")) return;
        int x = location.getBlockX(), y = location.getBlockY(), z = location.getBlockZ();
        for (int dy = -1; dy <= 0; dy++) for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) {
            Block block = location.getWorld().getBlockAt(x + dx, y + dy, z + dz);
            if (block.getType() != Material.MAGMA_BLOCK) continue;
            Block center = findSpiceBlowCenter(block);
            if (center != null) detonateSpiceBlow(center);
        }
    }

    private Block findSpiceBlowCenter(Block touched) {
        World world = touched.getWorld();
        for (int cx = touched.getX() - 1; cx <= touched.getX() + 1; cx++)
            for (int cz = touched.getZ() - 1; cz <= touched.getZ() + 1; cz++)
                for (int topY = touched.getY() - 1; topY <= touched.getY() + 1; topY++) {
                    if (world.getBlockAt(cx, topY, cz).getType() != Material.MAGMA_BLOCK
                        || world.getBlockAt(cx, topY - 1, cz).getType() != Material.MAGMA_BLOCK) continue;
                    boolean patch = true;
                    for (int dx = -1; dx <= 1 && patch; dx++) for (int dz = -1; dz <= 1; dz++)
                        if (world.getBlockAt(cx + dx, topY - 1, cz + dz).getType() != Material.MAGMA_BLOCK) { patch = false; break; }
                    if (patch) return world.getBlockAt(cx, topY, cz);
                }
        return null;
    }

    private void detonateSpiceBlow(Block center) {
        if (center.getType() != Material.MAGMA_BLOCK) return;
        World world = center.getWorld();
        int x = center.getX(), z = center.getZ(), baseY = center.getY() - 1;
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++)
            world.getBlockAt(x + dx, baseY, z + dz).setType(Material.AIR, false);
        center.setType(Material.GLOWSTONE, false);
        world.playSound(center.getLocation(), Sound.ENTITY_GENERIC_EXPLODE, 1.5f, 0.7f);
        world.spawnParticle(Particle.EXPLOSION, center.getLocation().add(0.5, 0.5, 0.5), 1);

        String path = "spice-blow.";
        int targetValue = Math.max(1, getConfig().getInt(path + "target-value", 15000));
        int unitPrice = Math.max(1, getConfig().getInt(path + "unit-price", 15));
        org.bukkit.plugin.Plugin economy = Bukkit.getPluginManager().getPlugin("DuneEss");
        if (economy instanceof JavaPlugin economyPlugin)
            unitPrice = Math.max(1, economyPlugin.getConfig().getInt("currency.spice-price", unitPrice));
        int targetDeposits = (int)Math.ceil(targetValue / (double)unitPrice);
        int radius = Math.max(12, getConfig().getInt(path + "radius", 24));
        List<Block> candidates = new ArrayList<>();
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radius * radius) continue;
            int bx = x + dx, bz = z + dz;
            int surfaceY = world.getHighestBlockYAt(bx, bz);
            Material surface = world.getBlockAt(bx, surfaceY, bz).getType();
            if (surface == Material.SAND || surface == Material.RED_SAND) candidates.add(world.getBlockAt(bx, surfaceY, bz));
        }
        candidates.sort(Comparator.comparingLong(block -> mix64((long)block.getX() * 0x9E3779B97F4A7C15L
            ^ (long)block.getZ() * 0xC2B2AE3D27D4EB4FL ^ world.getSeed() ^ 0x5350494345424c4fL)));
        int placed = 0;
        for (Block block : candidates) {
            if (placed >= targetDeposits) break;
            block.setType(Material.SUSPICIOUS_SAND, false);
            placed++;
        }
        announceSpiceBloom(center.getLocation());
        for (org.bukkit.entity.Player player : world.getPlayers()) player.sendMessage(ChatColor.GOLD + "A spice blow erupted at X " + x + ", Y " + center.getY() + ", Z " + z + " on Arrakis! " + placed + " deposits surfaced.");
        getLogger().info("Spice blow at " + x + ", " + z + " deployed " + placed + " spice deposits (target value " + targetValue + " Solaris).");
    }

    @EventHandler public void onSietchChestOpen(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || event.getClickedBlock() == null) return;
        if (event.getHand() != org.bukkit.inventory.EquipmentSlot.HAND) return;
        BlockState state = event.getClickedBlock().getState();
        if (!(state instanceof Chest chest)) return;
        String id = chest.getPersistentDataContainer().get(sietchLootIdKey, PersistentDataType.STRING);
        if (id == null) return;
        event.setCancelled(true);
        org.bukkit.entity.Player player = event.getPlayer();
        NamespacedKey claimedKey = new NamespacedKey(this, "sietch_claim_" + id);
        if (player.getPersistentDataContainer().has(claimedKey, PersistentDataType.BYTE)) {
            player.sendMessage(ChatColor.YELLOW + "You have already claimed this sietch cache.");
            return;
        }
        Inventory inventory = Bukkit.createInventory(null, 27, ChatColor.DARK_GRAY + "Sietch Cache");
        addLoot(inventory, spiceItem(64)); addLoot(inventory, spiceItem(64)); addLoot(inventory, spiceItem(64)); addLoot(inventory, spiceItem(58));
        addLoot(inventory, enchantedGold(Material.GOLDEN_HELMET));
        addLoot(inventory, enchantedGold(Material.GOLDEN_CHESTPLATE));
        addLoot(inventory, enchantedGold(Material.GOLDEN_LEGGINGS));
        addLoot(inventory, enchantedGold(Material.GOLDEN_BOOTS));
        addLoot(inventory, new ItemStack(Material.OAK_PLANKS, 32));
        addLoot(inventory, new ItemStack(Material.BREAD, 16));
        openSietchLoot.put(player.getUniqueId(), new PersonalLoot(inventory, id));
        player.openInventory(inventory);
        player.sendMessage(ChatColor.GOLD + "This personal cache contains supplies for you.");
    }

    @EventHandler public void onSietchLootClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof org.bukkit.entity.Player player)) return;
        PersonalLoot loot = openSietchLoot.get(player.getUniqueId());
        if (loot == null || event.getView().getTopInventory() != loot.inventory()) return;
        if (event.getClickedInventory() != loot.inventory()) return;
        event.setCancelled(true);
        ItemStack item = event.getCurrentItem();
        if (item == null || item.getType().isAir()) return;
        Map<Integer, ItemStack> leftovers = player.getInventory().addItem(item.clone());
        if (leftovers.isEmpty()) loot.inventory().setItem(event.getSlot(), null);
        else {
            loot.inventory().setItem(event.getSlot(), leftovers.values().iterator().next());
            player.sendMessage(ChatColor.RED + "Your inventory only had room for part of that stack.");
        }
    }

    @EventHandler public void onSietchLootDrag(InventoryDragEvent event) {
        if (!(event.getWhoClicked() instanceof org.bukkit.entity.Player player)) return;
        PersonalLoot loot = openSietchLoot.get(player.getUniqueId());
        if (loot != null && event.getView().getTopInventory() == loot.inventory()) event.setCancelled(true);
    }

    @EventHandler public void onSietchLootClose(InventoryCloseEvent event) {
        if (!(event.getPlayer() instanceof org.bukkit.entity.Player player)) return;
        PersonalLoot loot = openSietchLoot.get(player.getUniqueId());
        if (loot == null || event.getView().getTopInventory() != loot.inventory()) return;
        openSietchLoot.remove(player.getUniqueId());
        for (ItemStack item : loot.inventory().getContents()) if (item != null && !item.getType().isAir()) {
            Map<Integer, ItemStack> leftovers = player.getInventory().addItem(item);
            leftovers.values().forEach(left -> player.getWorld().dropItemNaturally(player.getLocation(), left));
        }
        player.getPersistentDataContainer().set(new NamespacedKey(this, "sietch_claim_" + loot.id()), PersistentDataType.BYTE, (byte) 1);
    }

    private static void addLoot(Inventory inventory, ItemStack item) {
        for (int slot = 0; slot < inventory.getSize(); slot++) if (inventory.getItem(slot) == null) {
            inventory.setItem(slot, item);
            return;
        }
    }

    private static ItemStack spiceItem(int amount) {
        ItemStack item = new ItemStack(Material.ORANGE_DYE, amount);
        ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(ChatColor.GOLD + "Melange Spice");
        meta.getPersistentDataContainer().set(new NamespacedKey("dunerealms", "item"), PersistentDataType.STRING, "spice");
        item.setItemMeta(meta);
        return item;
    }

    private static ItemStack enchantedGold(Material material) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.addEnchant(Enchantment.PROTECTION, 2, true);
        meta.addEnchant(Enchantment.UNBREAKING, 2, true);
        item.setItemMeta(meta);
        return item;
    }

    @Override public ChunkGenerator getDefaultWorldGenerator(String worldName, String id) {
        String planet = id == null || id.isBlank()
            ? getConfig().getString("server.planet", "arrakis")
            : id;
        planet = planet.toLowerCase(Locale.ROOT);
        if (!Arrays.asList(PLANETS).contains(planet)) {
            getLogger().severe("Invalid generator planet '" + planet + "' for world '" + worldName + "'.");
            return null;
        }
        if (!getConfig().getBoolean("planets." + planet + ".enabled", true)) {
            getLogger().severe("Generator planet '" + planet + "' is disabled in config.yml.");
            return null;
        }
        return new PlanetChunkGenerator(this, planet);
    }

    @Override public BiomeProvider getDefaultBiomeProvider(String worldName, String id) {
        String planet = id == null || id.isBlank()
            ? getConfig().getString("server.planet", "arrakis")
            : id;
        planet = planet.toLowerCase(Locale.ROOT);
        if (!Arrays.asList(PLANETS).contains(planet)) {
            getLogger().severe("Invalid biome-provider planet '" + planet + "' for world '" + worldName + "'.");
            return null;
        }
        return new PlanetBiomeProvider(this, planet);
    }

    @Override public void onEnable() {
        saveDefaultConfig();
        getServer().getPluginManager().registerEvents(this, this);
        guildKey = new NamespacedKey("dunerealms", "guild");
        sietchLootIdKey = new NamespacedKey(this, "sietch-loot-id");
        String planet = getConfig().getString("server.planet", "arrakis").toLowerCase(Locale.ROOT);
        if (!Arrays.asList(PLANETS).contains(planet)) {
            getLogger().severe("Invalid server.planet '" + planet + "'. Choose one of: " + String.join(", ", PLANETS));
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        if (!getConfig().getBoolean("planets." + planet + ".enabled", true)) {
            getLogger().severe("Planet '" + planet + "' is disabled in config.yml.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        getLogger().info("DuneTerrain registered the " + planet + " generator. World setup will run after Paper finishes loading worlds.");
    }

    @EventHandler public void onServerLoad(ServerLoadEvent event) {
        World arrakis = Bukkit.getWorld("arrakis");
        if (arrakis != null) for (Chunk chunk : arrakis.getLoadedChunks())
            Bukkit.getScheduler().runTask(this, () -> inspectBlooms(chunk));
        String planet = getConfig().getString("server.planet", "arrakis").toLowerCase(Locale.ROOT);
        World world = Bukkit.getWorld(planet);
        if (world == null) {
            File worldFolder = new File(getServer().getWorldContainer(), planet);
            boolean existingWorld = worldFolder.isDirectory();
            world = Bukkit.createWorld(new WorldCreator(planet)
                .environment(World.Environment.NORMAL)
                .generator(new PlanetChunkGenerator(this, planet)));
            if (world == null) {
                getLogger().severe("Could not create or load world '" + planet + "'.");
                return;
            }
            if (existingWorld) getLogger().warning("Loaded existing world '" + planet + "'. Existing chunks remain unchanged; move the world folder after backing it up to regenerate terrain.");
            else getLogger().info("Created world '" + planet + "' with DuneTerrain.");
        } else if (!(world.getGenerator() instanceof PlanetChunkGenerator)) {
            getLogger().severe("World '" + planet + "' was loaded without DuneTerrain's generator. Configure bukkit.yml worlds." + planet + ".generator: DuneTerrain:" + planet + " and worlds." + planet + ".biome-provider: DuneTerrain:" + planet + ". Existing chunks remain unchanged.");
        } else {
            getLogger().info("World '" + planet + "' was loaded with DuneTerrain's configured generator.");
        }
        world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, !planet.equals("arrakis"));
        world.setTime(planet.equals("giedi_prime") ? 18000 : 6000);
        setupPlanetSpawn(world, planet);
    }

    private void setupPlanetSpawn(World world, String planet) {
        String path = "planets." + planet + ".spawn.";
        int x = getConfig().getInt(path + "x", 0), z = getConfig().getInt(path + "z", 0);
        world.getChunkAt(x >> 4, z >> 4).load(true);
        Location spawn = findSafeSpawn(world, x, z);
        world.setSpawnLocation(spawn);
        if (getConfig().getBoolean("guild-npc.enabled", true)) ensureGuildNpc(world, spawn);
    }

    private Location findSafeSpawn(World world, int x, int z) {
        for (int radius = 0; radius <= 12; radius++) {
            for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                if (radius > 0 && Math.abs(dx) != radius && Math.abs(dz) != radius) continue;
                int bx = x + dx, bz = z + dz;
                int y = world.getHighestBlockYAt(bx, bz);
                Material ground = world.getBlockAt(bx, y, bz).getType();
                if (!ground.isSolid() || ground == Material.MAGMA_BLOCK || ground == Material.CACTUS || ground == Material.POWDER_SNOW) continue;
                if (world.getBlockAt(bx, y + 1, bz).isLiquid() || world.getBlockAt(bx, y + 2, bz).isLiquid()) continue;
                return new Location(world, bx + 0.5, y + 1, bz + 0.5);
            }
        }
        int y = Math.max(world.getMinHeight() + 2, world.getHighestBlockYAt(x, z) + 1);
        return new Location(world, x + 0.5, y, z + 0.5);
    }

    private void ensureGuildNpc(World world, Location spawn) {
        Location at = findSafeSpawn(world, spawn.getBlockX() + 2, spawn.getBlockZ());
        for (Entity entity : world.getNearbyEntities(at, 8, 5, 8)) {
            if (entity instanceof Villager villager && villager.getPersistentDataContainer().has(guildKey, PersistentDataType.BYTE)) {
                villager.teleport(at);
                return;
            }
        }
        Villager villager = world.spawn(at, Villager.class);
        villager.setCustomName(ChatColor.LIGHT_PURPLE + "Spacing Guild Navigator");
        villager.setCustomNameVisible(true);
        villager.setProfession(Villager.Profession.CLERIC);
        villager.setAI(false);
        villager.setInvulnerable(true);
        villager.setSilent(true);
        villager.setPersistent(true);
        villager.getPersistentDataContainer().set(guildKey, PersistentDataType.BYTE, (byte) 1);
    }

    private static class PlanetChunkGenerator extends ChunkGenerator {
        private final DuneTerrain plugin;
        private final String planet;
        PlanetChunkGenerator(DuneTerrain plugin, String planet) { this.plugin = plugin; this.planet = planet; }
        @Override public List<BlockPopulator> getDefaultPopulators(World world) {
            return planet.equals("arrakis") && world.getName().equalsIgnoreCase("arrakis")
                ? List.of(new SietchPopulator(plugin), new SpiceBlowPopulator(plugin)) : List.of();
        }
        @Override public void generateNoise(WorldInfo world, Random random, int chunkX, int chunkZ, ChunkData data) {
            String path = "planets." + planet + ".";
            int minY = world.getMinHeight(), maxY = world.getMaxHeight() - 1;
            int baseHeight = plugin.getConfig().getInt(path + "terrain.base-height", 68);
            double variation = plugin.getConfig().getDouble(path + "terrain.height-variation", 8);
            double scale = Math.max(0.001, plugin.getConfig().getDouble(path + "terrain.noise-scale", 0.02));
            int waterLevel = plugin.getConfig().getInt(path + "water.level", 63);
            Material surface = configuredMaterial(path + "surface", Material.GRASS_BLOCK);
            Material filler = configuredMaterial(path + "filler", Material.DIRT);
            Material core = planet.equals("giedi_prime") || planet.equals("sigma_draconis_iv") ? Material.DEEPSLATE : Material.STONE;
            double flowers = Math.max(0, plugin.getConfig().getDouble(path + "vegetation.flowers-per-chunk", 0));
            double treeChance = Math.max(0, plugin.getConfig().getDouble(path + "vegetation.tree-chance", 0));
            int[][] heights = new int[16][16];
            for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) {
                int gx = chunkX * 16 + x, gz = chunkZ * 16 + z;
                double n = Math.sin(gx * scale) * Math.cos(gz * scale * 1.13)
                    + Math.sin(gx * scale * 2.7 + gz * scale * 1.45) * 0.35;
                int h = Math.max(minY + 8, Math.min(maxY - 8, baseHeight + (int) Math.round(n * variation)));
                heights[x][z] = h;
                data.setBlock(x, minY, z, Material.BEDROCK);
                for (int y = minY + 1; y < h - 3; y++) data.setBlock(x, y, z, core);
                for (int y = h - 3; y < h; y++) data.setBlock(x, y, z, filler);
                data.setBlock(x, h, z, surface);

                if (plugin.getConfig().getBoolean(path + "water.swamp-pools", false) && h < waterLevel) {
                    double poolNoise = Math.sin(gx * 0.035) * Math.cos(gz * 0.031);
                    double coverage = Math.max(0, Math.min(1, plugin.getConfig().getDouble(path + "water.coverage", 0.18)));
                    if (poolNoise > 0.72 - coverage * 0.75) {
                        for (int y = h + 1; y <= Math.min(waterLevel, maxY); y++) data.setBlock(x, y, z, Material.WATER);
                    }
                }
                if (flowers > 0 && surface == Material.GRASS_BLOCK && random.nextDouble() < Math.min(1, flowers / 256.0)) {
                    Material[] flowerTypes = {Material.POPPY, Material.DANDELION, Material.CORNFLOWER,
                        Material.AZURE_BLUET, Material.ALLIUM, Material.OXEYE_DAISY};
                    data.setBlock(x, h + 1, z, flowerTypes[random.nextInt(flowerTypes.length)]);
                }
                if (plugin.getConfig().getBoolean(path + "vegetation.trees", false)
                    && surface == Material.GRASS_BLOCK && random.nextDouble() < treeChance && x >= 3 && x <= 12 && z >= 3 && z <= 12) {
                    placeJungleTree(data, x, h + 1, z, random, maxY);
                }
            }
            boolean arrakisWorld = planet.equals("arrakis") && world.getName().equalsIgnoreCase("arrakis");
            if (arrakisWorld) placeOasisTree(data, chunkX, chunkZ, heights, minY, maxY);
            if (arrakisWorld) {
                placeDarkstoneIsland(data, chunkX, chunkZ, heights, minY, maxY);
                placeSpiceDeposits(data, heights, random, minY, maxY);
                placeRandomSpicePatch(data, chunkX, chunkZ, heights);
            }
            placeOres(data, random, path, minY, maxY);
        }
        @Override public BiomeProvider getDefaultBiomeProvider(WorldInfo worldInfo) {
            return new PlanetBiomeProvider(plugin, planet);
        }
        private void placeOasisTree(ChunkData data, int chunkX, int chunkZ, int[][] heights, int minY, int maxY) {
            String path = "planets.arrakis.oasis-trees.";
            if (!plugin.getConfig().getBoolean(path + "enabled", true)) return;
            int spacing = Math.max(64, plugin.getConfig().getInt(path + "spacing", 300));
            long[] anchor = gridAnchor(chunkX, chunkZ, spacing, 0x4f41534953545245L);
            if (Math.floorDiv(anchor[0], 16) != chunkX || Math.floorDiv(anchor[1], 16) != chunkZ) return;
            int x = Math.floorMod(anchor[0], 16), z = Math.floorMod(anchor[1], 16);
            int y = heights[x][z] + 1;
            int height = Math.max(4, plugin.getConfig().getInt(path + "trunk-height", 7));
            if (y + height + 3 >= maxY || data.getType(x, y - 1, z) != Material.SAND) return;
            for (int dy = 0; dy < height; dy++) data.setBlock(x, y + dy, z, Material.OAK_LOG);
            for (int dy = height - 3; dy <= height + 2; dy++) {
                int radius = dy >= height + 1 ? 2 : 3;
                for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) == radius && Math.abs(dz) == radius && Math.floorMod(dx * 31 + dz * 17, 3) == 0) continue;
                    int lx = x + dx, lz = z + dz, ly = y + dy;
                    if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly >= maxY || !data.getType(lx, ly, lz).isAir()) continue;
                    org.bukkit.block.data.type.Leaves leaves = (org.bukkit.block.data.type.Leaves) Bukkit.createBlockData(Material.OAK_LEAVES);
                    leaves.setPersistent(true);
                    data.setBlock(lx, ly, lz, leaves);
                }
            }
        }
        private long[] gridAnchor(int chunkX, int chunkZ, int spacing, long salt) {
            int centerX = chunkX * 16 + 8, centerZ = chunkZ * 16 + 8;
            long cellX = Math.floorDiv(centerX, spacing), cellZ = Math.floorDiv(centerZ, spacing);
            long h1 = mix64(cellX * 0x9E3779B97F4A7C15L ^ cellZ * 0xC2B2AE3D27D4EB4FL ^ salt);
            long h2 = mix64(cellZ * 0x165667B19E3779F9L ^ cellX * 0x85EBCA77C2B2AE63L ^ ~salt);
            long x = cellX * spacing + 8 + Math.floorMod(h1, spacing - 16);
            long z = cellZ * spacing + 8 + Math.floorMod(h2, spacing - 16);
            if (Math.floorDiv(x, spacing) != cellX || Math.floorDiv(z, spacing) != cellZ) return new long[]{Long.MIN_VALUE, Long.MIN_VALUE};
            return new long[]{x, z};
        }
        private void placeDarkstoneIsland(ChunkData data, int chunkX, int chunkZ, int[][] heights, int minY, int maxY) {
            String path = "planets.arrakis.darkstone-islands.";
            if (!plugin.getConfig().getBoolean(path + "enabled", true)) return;
            int spacing = Math.max(128, plugin.getConfig().getInt(path + "spacing", 750));
            int minRadius = Math.max(6, plugin.getConfig().getInt(path + "min-radius", 10));
            int maxRadius = Math.max(minRadius, plugin.getConfig().getInt(path + "max-radius", 18));
            int maxRise = Math.max(1, plugin.getConfig().getInt(path + "max-height", 14));
            int baseHeight = plugin.getConfig().getInt("planets.arrakis.terrain.base-height", 70);
            double variation = plugin.getConfig().getDouble("planets.arrakis.terrain.height-variation", 11);
            double scale = Math.max(0.001, plugin.getConfig().getDouble("planets.arrakis.terrain.noise-scale", 0.02));
            int worldMinX = chunkX * 16, worldMinZ = chunkZ * 16;
            int firstCellX = Math.floorDiv(worldMinX - maxRadius - 3, spacing), lastCellX = Math.floorDiv(worldMinX + 15 + maxRadius + 3, spacing);
            int firstCellZ = Math.floorDiv(worldMinZ - maxRadius - 3, spacing), lastCellZ = Math.floorDiv(worldMinZ + 15 + maxRadius + 3, spacing);
            long salt = 0x4441524B49534C41L;
            for (int cellX = firstCellX; cellX <= lastCellX; cellX++) for (int cellZ = firstCellZ; cellZ <= lastCellZ; cellZ++) {
                long seed = mix64((long) cellX * 0x9E3779B97F4A7C15L ^ (long) cellZ * 0xC2B2AE3D27D4EB4FL ^ salt);
                long centerX = (long) cellX * spacing + Math.floorMod(mix64(seed ^ 0x165667B19E3779F9L), spacing);
                long centerZ = (long) cellZ * spacing + Math.floorMod(mix64(seed ^ 0x85EBCA77C2B2AE63L), spacing);
                int radius = minRadius + (int) Math.floorMod(seed >>> 1, maxRadius - minRadius + 1L);
                int highestGround = Integer.MIN_VALUE;
                for (int sampleX = (int)centerX - radius - 2; sampleX <= centerX + radius + 2; sampleX++)
                    for (int sampleZ = (int)centerZ - radius - 2; sampleZ <= centerZ + radius + 2; sampleZ++) {
                        if (Math.hypot(sampleX - centerX, sampleZ - centerZ) > radius + 2) continue;
                        double noise = Math.sin(sampleX * scale) * Math.cos(sampleZ * scale * 1.13)
                            + Math.sin(sampleX * scale * 2.7 + sampleZ * scale * 1.45) * 0.35;
                        highestGround = Math.max(highestGround, baseHeight + (int)Math.round(noise * variation));
                    }
                int plateauCount = RockPlateaus.count(seed, Math.min(maxRise, plugin.getConfig().getInt(path + "max-plateaus", 3)));
                int interval = RockPlateaus.interval(plugin.getConfig().getInt(path + "plateau-interval", 5), maxRise, plateauCount);
                int plateauY = highestGround + plateauCount * interval;
                for (int lx = 0; lx < 16; lx++) for (int lz = 0; lz < 16; lz++) {
                    long gx = (long) worldMinX + lx, gz = (long) worldMinZ + lz;
                    long dx = gx - centerX, dz = gz - centerZ;
                    long rough = mix64(gx * 0x9E3779B97F4A7C15L ^ gz * 0xC2B2AE3D27D4EB4FL ^ seed);
                    double edge = radius + (((rough >>> 11) * 0x1.0p-53) - 0.5) * 3.0;
                    double distance = Math.sqrt(dx * dx + dz * dz);
                    if (distance > edge) continue;
                    int baseY = heights[lx][lz];
                    if (plateauY + 2 >= maxY || baseY <= minY + 1) continue;
                    int level = RockPlateaus.level(distance, radius, plateauCount);
                    boolean plateau = level > 0;
                    int terraceY = highestGround + level * interval;
                    double slope = Math.max(0.0, Math.min(1.0, (edge - distance) / Math.max(1.0, edge - radius * 0.9)));
                    int sideTop = highestGround + (int)Math.floor(slope * interval);
                    Material[] darkRock = {Material.BLACKSTONE, Material.BASALT, Material.POLISHED_BLACKSTONE};
                    if (plateau) {
                        for (int y = baseY + 1; y < terraceY; y++) {
                            int hashIndex = (int)Math.floorMod(mix64(rough + y * 0x9E3779B97F4A7C15L), darkRock.length);
                            data.setBlock(lx, y, lz, darkRock[hashIndex]);
                        }
                        data.setBlock(lx, terraceY, lz, Material.SAND);
                    } else {
                        int sideSurface = Math.max(baseY, sideTop);
                        for (int y = baseY; y <= sideSurface; y++) {
                            int hashIndex = (int)Math.floorMod(mix64(rough + y * 0x9E3779B97F4A7C15L), darkRock.length);
                            data.setBlock(lx, y, lz, darkRock[hashIndex]);
                        }
                    }
                }
            }
        }
        private Material configuredMaterial(String path, Material fallback) {
            String name = plugin.getConfig().getString(path, fallback.name());
            Material material = Material.matchMaterial(name == null ? "" : name);
            return material == null ? fallback : material;
        }
        private void placeSpiceDeposits(ChunkData data, int[][] heights, Random random, int minY, int maxY) {
            int count = Math.max(0, plugin.getConfig().getInt("spice-deposits.per-chunk", 2));
            for (int i = 0; i < count; i++) {
                int x = random.nextInt(16), z = random.nextInt(16), y = heights[x][z];
                Material surface = data.getType(x, y, z);
                if (y + 1 < maxY && y > minY && (surface == Material.SAND || surface == Material.RED_SAND))
                    data.setBlock(x, y, z, Material.SUSPICIOUS_SAND);
            }
        }
        private void placeRandomSpicePatch(ChunkData data, int chunkX, int chunkZ, int[][] heights) {
            String path = "spice-deposits.patches.";
            if (!plugin.getConfig().getBoolean(path + "enabled", true)) return;
            int spacing = Math.max(128, plugin.getConfig().getInt(path + "region-spacing", 600));
            int radius = Math.max(2, plugin.getConfig().getInt(path + "radius", 12));
            int targetValue = Math.max(1, plugin.getConfig().getInt(path + "target-value", 5000));
            int unitPrice = Math.max(1, plugin.getConfig().getInt(path + "unit-price", 15));
            double density = Math.min(1.0, Math.ceil(targetValue / (double) unitPrice) / (Math.PI * radius * radius));
            double chance = Math.max(0, Math.min(1, plugin.getConfig().getDouble(path + "chance-per-region", 0.35)));
            int worldMinX = chunkX * 16, worldMinZ = chunkZ * 16;
            int firstCellX = Math.floorDiv(worldMinX - radius, spacing), lastCellX = Math.floorDiv(worldMinX + 15 + radius, spacing);
            int firstCellZ = Math.floorDiv(worldMinZ - radius, spacing), lastCellZ = Math.floorDiv(worldMinZ + 15 + radius, spacing);
            long salt = 0x5350494345504154L;
            for (int cellX = firstCellX; cellX <= lastCellX; cellX++) for (int cellZ = firstCellZ; cellZ <= lastCellZ; cellZ++) {
                long cellSeed = mix64((long) cellX * 0x9E3779B97F4A7C15L ^ (long) cellZ * 0xC2B2AE3D27D4EB4FL ^ salt);
                if (hashUnit(cellSeed) >= chance) continue;
                long offsetX = Math.floorMod(mix64(cellSeed ^ 0x165667B19E3779F9L), spacing - radius * 2L);
                long offsetZ = Math.floorMod(mix64(cellSeed ^ 0x85EBCA77C2B2AE63L), spacing - radius * 2L);
                long centerX = (long) cellX * spacing + radius + offsetX;
                long centerZ = (long) cellZ * spacing + radius + offsetZ;
                for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) {
                    long gx = (long) worldMinX + x, gz = (long) worldMinZ + z;
                    long dx = gx - centerX, dz = gz - centerZ;
                    if (dx * dx + dz * dz > (long) radius * radius) continue;
                    long blockSeed = mix64(gx * 0x9E3779B97F4A7C15L ^ gz * 0xC2B2AE3D27D4EB4FL ^ salt);
                    if (hashUnit(blockSeed) >= density) continue;
                    int y = heights[x][z];
                    if (data.getType(x, y, z) == Material.SAND || data.getType(x, y, z) == Material.RED_SAND)
                        data.setBlock(x, y, z, Material.SUSPICIOUS_SAND);
                }
            }
        }
        private static double hashUnit(long hash) { return (hash >>> 11) * 0x1.0p-53; }
        private void placeOres(ChunkData data, Random random, String path, int minWorldY, int maxWorldY) {
            org.bukkit.configuration.ConfigurationSection ores = plugin.getConfig().getConfigurationSection(path + "ores");
            if (ores == null) return;
            int minY = Math.max(minWorldY + 1, plugin.getConfig().getInt(path + "ores.min-y", -48));
            int maxY = Math.min(maxWorldY - 4, plugin.getConfig().getInt(path + "ores.max-y", 48));
            int veinSize = Math.max(1, Math.min(16, plugin.getConfig().getInt(path + "ores.vein-size", 5)));
            if (maxY < minY) return;
            for (String key : ores.getKeys(false)) {
                Material ore = Material.matchMaterial(key);
                if (ore == null || !key.endsWith("_ORE")) continue;
                int attempts = Math.max(0, Math.min(64, ores.getInt(key, 0)));
                for (int attempt = 0; attempt < attempts; attempt++) {
                    int x = random.nextInt(16), z = random.nextInt(16), y = minY + random.nextInt(maxY - minY + 1);
                    for (int n = 0; n < veinSize; n++) {
                        int vx = Math.max(0, Math.min(15, x + random.nextInt(3) - 1));
                        int vz = Math.max(0, Math.min(15, z + random.nextInt(3) - 1));
                        int vy = Math.max(minY, Math.min(maxY, y + random.nextInt(3) - 1));
                        Material existing = data.getType(vx, vy, vz);
                        if (existing == Material.STONE || existing == Material.DEEPSLATE || existing == Material.TUFF) data.setBlock(vx, vy, vz, ore);
                    }
                }
            }
        }
        private void placeJungleTree(ChunkData data, int x, int y, int z, Random random, int maxY) {
            int height = 4 + random.nextInt(4);
            if (y + height + 2 >= maxY || data.getType(x, y - 1, z) != Material.GRASS_BLOCK) return;
            for (int dy = 0; dy < height; dy++) data.setBlock(x, y + dy, z, Material.JUNGLE_LOG);
            for (int dy = height - 2; dy <= height + 1; dy++) {
                int radius = dy >= height ? 1 : 2;
                for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) == radius && Math.abs(dz) == radius && random.nextBoolean()) continue;
                    int lx = x + dx, lz = z + dz, ly = y + dy;
                    if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && data.getType(lx, ly, lz).isAir()) data.setBlock(lx, ly, lz, Material.JUNGLE_LEAVES);
                }
            }
        }
    }
    private static final class PlanetBiomeProvider extends BiomeProvider {
        private final Biome biome;
        PlanetBiomeProvider(DuneTerrain plugin, String planet) {
            String configured = planet.equals("arrakis") ? "DESERT" : plugin.getConfig().getString("planets." + planet + ".biome", "PLAINS");
            Biome selected;
            try { selected = Biome.valueOf(configured.toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException ex) { selected = Biome.DESERT; }
            this.biome = selected;
        }
        @Override public Biome getBiome(WorldInfo info, int x, int y, int z) { return biome; }
        @Override public List<Biome> getBiomes(WorldInfo info) { return List.of(biome); }
    }

    private static long mix64(long value) {
        value = (value ^ (value >>> 30)) * 0xBF58476D1CE4E5B9L;
        value = (value ^ (value >>> 27)) * 0x94D049BB133111EBL;
        return value ^ (value >>> 31);
    }

    private static final class SietchPopulator extends BlockPopulator {
        private final DuneTerrain plugin;
        private SietchPopulator(DuneTerrain plugin) { this.plugin = plugin; }
        @Override public void populate(WorldInfo world, Random random, int cx, int cz, LimitedRegion region) {
            if (!world.getName().equalsIgnoreCase("arrakis")) return;
            if (!plugin.getConfig().getBoolean("sietches.enabled", true)) return;
            int spacing = Math.max(256, plugin.getConfig().getInt("sietches.spacing", 2000));
            int centerX = cx * 16 + 8, centerZ = cz * 16 + 8;
            long cellX = Math.floorDiv(centerX, spacing), cellZ = Math.floorDiv(centerZ, spacing);
            long h1 = mix64(cellX * 0x9E3779B97F4A7C15L ^ cellZ * 0xC2B2AE3D27D4EB4FL ^ 0x534945544348L);
            long h2 = mix64(cellZ * 0x165667B19E3779F9L ^ cellX * 0x85EBCA77C2B2AE63L ^ ~0x534945544348L);
            long anchorX = cellX * spacing + 8 + Math.floorMod(h1, spacing - 16);
            long anchorZ = cellZ * spacing + 8 + Math.floorMod(h2, spacing - 16);
            if (Math.floorDiv(anchorX, 16) != cx || Math.floorDiv(anchorZ, 16) != cz) return;
            int x = (int) anchorX, z = (int) anchorZ;
            int y = region.getHighestBlockYAt(x, z);
            if (y < world.getMinHeight() + 40 || y > world.getMaxHeight() - 4 || y - 36 < world.getMinHeight()) return;

            // Enlarged hub, side chambers, cache chamber, and reservoir. The surface entrance stays compact.
            int hy = y - 11;
            carveRoom(region, x, hy, z, 10, 6, 10);
            carveTunnelNetwork(region, new int[][]{
                {x - 8, hy - 3, z - 2}, {x - 12, hy - 4, z - 2}, {x - 16, hy - 5, z - 2}
            });
            carveRoom(region, x - 18, hy - 6, z - 2, 8, 4, 8);
            carveTunnelNetwork(region, new int[][]{
                {x + 8, hy - 3, z + 2}, {x + 12, hy - 4, z + 2}, {x + 16, hy - 5, z + 2}
            });
            carveRoom(region, x + 18, hy - 6, z + 2, 8, 4, 8);
            carveTunnelNetwork(region, new int[][]{
                {x, hy - 3, z - 3}, {x - 3, hy - 4, z - 5}, {x - 6, hy - 5, z - 8},
                {x - 4, hy - 6, z - 11}, {x, hy - 7, z - 12}, {x + 3, hy - 8, z - 11},
                {x, hy - 10, z - 10}
            });
            carveRoom(region, x, hy - 12, z - 10, 8, 4, 8);
            carveRoom(region, x, hy - 23, z + 8, 14, 10, 14);

            // A broad, rough cave mouth opens from the surface and slopes down into the hub.
            carveCaveEntrance(region, x, z, hy);

            // Long switchbacks keep the descent gradual from the hub to the enlarged reservoir.
            carveTunnelNetwork(region, new int[][]{
                {x, hy - 3, z + 3}, {x - 4, hy - 4, z + 5}, {x - 8, hy - 5, z + 8},
                {x - 10, hy - 6, z + 12}, {x - 8, hy - 7, z + 14}, {x - 4, hy - 8, z + 14},
                {x - 2, hy - 9, z + 12}, {x - 5, hy - 10, z + 9}, {x - 8, hy - 11, z + 7},
                {x - 10, hy - 12, z + 9}, {x - 8, hy - 13, z + 12}, {x - 5, hy - 14, z + 13},
                {x - 3, hy - 15, z + 10}, {x - 5, hy - 16, z + 7}, {x - 7, hy - 17, z + 8},
                {x - 5, hy - 18, z + 10}, {x - 4, hy - 19, z + 9}, {x - 5, hy - 20, z + 8}
            });

            // The waterfall runs beside the ramp and feeds a broad pool at the bottom.
            for (int dy = -4; dy >= -25; dy--) {
                set(region, x + 3, hy + dy, z + 5, Material.WATER);
                set(region, x + 2, hy + dy, z + 5, Material.STONE);
                set(region, x + 4, hy + dy, z + 5, Material.STONE);
                set(region, x + 3, hy + dy, z + 4, Material.STONE);
                set(region, x + 3, hy + dy, z + 6, Material.STONE);
            }
            for (int dx = -5; dx <= 5; dx++) for (int dz = -5; dz <= 5; dz++) {
                if (dx * dx + dz * dz > 25) continue;
                set(region, x + dx, hy - 29, z + 8 + dz, Material.STONE);
                for (int waterY = hy - 28; waterY <= hy - 25; waterY++)
                    set(region, x + dx, waterY, z + 8 + dz, Material.WATER);
            }

            furnishSleepingHall(region, x - 18, hy - 6, z - 2);
            furnishKitchen(region, x + 18, hy - 6, z + 2);
            placePersonalChest(region, x, hy - 14, z - 10, cellX, cellZ);
            for (int[] lamp : new int[][]{{0,-1,0},{-20,-5,-2},{20,-5,2},{0,-11,-11}})
                set(region, x + lamp[0], hy + lamp[1], z + lamp[2], Material.TORCH);
        }

        private static void carveRoom(LimitedRegion region, int cx, int cy, int cz, int rx, int ry, int rz) {
            for (int dx = -rx; dx <= rx; dx++) for (int dy = -ry; dy <= ry; dy++) for (int dz = -rz; dz <= rz; dz++) {
                double outer = dx * dx / (double)(rx * rx) + dy * dy / (double)(ry * ry) + dz * dz / (double)(rz * rz);
                if (outer > 1.15) continue;
                int x = cx + dx, y = cy + dy, z = cz + dz;
                if (outer >= 0.58) {
                    long variation = mix64((long)x * 341873128712L ^ (long)y * 132897987541L ^ z);
                    Material wall = switch ((int)Math.floorMod(variation, 10)) {
                        case 0, 1 -> Material.TUFF;
                        case 2 -> Material.ANDESITE;
                        case 3 -> Material.COBBLED_DEEPSLATE;
                        case 4 -> Material.COBBLESTONE;
                        case 5 -> Material.MOSSY_COBBLESTONE;
                        default -> Material.STONE;
                    };
                    set(region, x, y, z, wall);
                } else set(region, x, y, z, Material.AIR);
            }
        }

        private static void carveCaveEntrance(LimitedRegion region, int x, int z, int hubY) {
            int entryX = x + 6, entryZ = z - 7;
            int outsideX = x + 11;
            int surfaceY = region.getHighestBlockYAt(outsideX, entryZ);
            int mouthY = Math.max(hubY + 4, surfaceY - 3);

            // Hollow a rough chamber just behind the stone arch, then connect it to the hub.
            carveRoom(region, entryX, mouthY, entryZ, 3, 2, 3);
            carveCaveTunnel(region, outsideX, surfaceY - 1, entryZ, x + 6, mouthY, entryZ);
            carveTunnelNetwork(region, new int[][]{
                {x + 6, mouthY, entryZ}, {x + 3, mouthY - 1, z - 9}, {x, mouthY - 2, z - 11},
                {x - 4, mouthY - 3, z - 10}, {x - 6, mouthY - 4, z - 7},
                {x - 5, mouthY - 5, z - 3}, {x - 2, mouthY - 6, z - 1}, {x, hubY + 1, z}
            });

            // Irregular stone and tuff form a visible cave arch around the entrance.
            int faceX = x + 7;
            for (int dy = -3; dy <= 3; dy++) for (int dz = -4; dz <= 4; dz++) {
                double arch = dy * dy / 16.0 + dz * dz / 25.0;
                if (arch > 1.35) continue;
                if (arch < 0.72) {
                    set(region, faceX, mouthY + dy, entryZ + dz, Material.AIR);
                    continue;
                }
                long variation = mix64((long)(faceX + dz) * 341873128712L ^ (long)(mouthY + dy) * 132897987541L ^ 0x4341564541524348L);
                Material rock = switch ((int)Math.floorMod(variation, 5)) {
                    case 0 -> Material.TUFF;
                    case 1 -> Material.ANDESITE;
                    case 2 -> Material.COBBLED_DEEPSLATE;
                    default -> Material.STONE;
                };
                set(region, faceX, mouthY + dy, entryZ + dz, rock);
            }
        }

        private static void carveTunnel(LimitedRegion region, double ax, double ay, double az, double bx, double by, double bz) {
            int steps = (int)Math.ceil(Math.sqrt((bx-ax)*(bx-ax) + (by-ay)*(by-ay) + (bz-az)*(bz-az)) * 1.5);
            for (int i = 0; i <= steps; i++) {
                double t = i / (double)Math.max(1, steps);
                int cx = (int)Math.round(ax + (bx-ax)*t), cy = (int)Math.round(ay + (by-ay)*t), cz = (int)Math.round(az + (bz-az)*t);
                for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) for (int dz = -1; dz <= 1; dz++)
                    if (dx*dx + dy*dy + dz*dz <= 2) set(region, cx+dx, cy+dy, cz+dz, Material.AIR);
            }
        }

        private static void carveTunnelNetwork(LimitedRegion region, int[][] points) {
            for (int i = 1; i < points.length; i++) {
                int[] from = points[i - 1], to = points[i];
                carveTunnel(region, from[0], from[1], from[2], to[0], to[1], to[2]);
            }
        }

        private static void carveCaveTunnel(LimitedRegion region, double ax, double ay, double az, double bx, double by, double bz) {
            int steps = (int)Math.ceil(Math.sqrt((bx-ax)*(bx-ax) + (by-ay)*(by-ay) + (bz-az)*(bz-az)) * 1.5);
            for (int i = 0; i <= steps; i++) {
                double t = i / (double)Math.max(1, steps);
                int cx = (int)Math.round(ax + (bx-ax)*t), cy = (int)Math.round(ay + (by-ay)*t), cz = (int)Math.round(az + (bz-az)*t);
                for (int dx = -2; dx <= 2; dx++) for (int dy = -2; dy <= 2; dy++) for (int dz = -2; dz <= 2; dz++)
                    if (dx*dx + dy*dy + dz*dz <= 4) set(region, cx+dx, cy+dy, cz+dz, Material.AIR);
            }
        }

        private static void furnishSleepingHall(LimitedRegion r, int x, int y, int z) {
            for (int i = -1; i <= 1; i++) {
                set(r, x+i, y-1, z, Material.POLISHED_ANDESITE);
                set(r, x+i, y, z, Material.RED_CARPET);
                set(r, x+i, y+1, z, Material.AIR);
            }
            set(r, x-1, y, z, Material.WHITE_CARPET);
            set(r, x+1, y, z, Material.WHITE_CARPET);
            set(r, x-2, y-1, z+2, Material.BARREL);
        }

        private static void furnishKitchen(LimitedRegion r, int x, int y, int z) {
            set(r, x-2, y-1, z, Material.STONE_BRICKS);
            set(r, x-2, y, z, Material.FURNACE);
            set(r, x-1, y-1, z, Material.STONE_BRICKS);
            set(r, x-1, y, z, Material.SMOKER);
            set(r, x, y-1, z, Material.STONE_BRICKS);
            set(r, x, y, z, Material.CRAFTING_TABLE);
            set(r, x+2, y-1, z+1, Material.BARREL);
            set(r, x+2, y, z+1, Material.CAULDRON);
        }

        private void placePersonalChest(LimitedRegion r, int x, int y, int z, long cellX, long cellZ) {
            set(r, x, y-1, z, Material.CHISELED_STONE_BRICKS);
            set(r, x, y, z, Material.CHEST);
            BlockState state = r.getBlockState(x, y, z);
            if (state instanceof Chest chest) {
                String id = Long.toUnsignedString(mix64(cellX * 0x9E3779B97F4A7C15L ^ cellZ * 0xC2B2AE3D27D4EB4FL ^ 0x534945544348L), 16);
                chest.setCustomName("Personal Sietch Cache");
                chest.getPersistentDataContainer().set(plugin.sietchLootIdKey, PersistentDataType.STRING, id);
                chest.update(true, false);
            }
        }

        private static void set(LimitedRegion region, int x, int y, int z, Material material) {
            if (region.isInRegion(x, y, z)) region.setType(x, y, z, material);
        }
    }

    private static final class SpiceBlowPopulator extends BlockPopulator {
        private static final long SALT = 0x5350494345424c4fL;
        private final DuneTerrain plugin;
        private SpiceBlowPopulator(DuneTerrain plugin) { this.plugin = plugin; }

        @Override public void populate(WorldInfo world, Random random, int chunkX, int chunkZ, LimitedRegion region) {
            if (!world.getName().equalsIgnoreCase("arrakis") || !plugin.getConfig().getBoolean("spice-blow.enabled", true)) return;
            int spacing = Math.max(256, plugin.getConfig().getInt("spice-blow.spacing", 2000));
            long centerX = chunkX * 16L + 8, centerZ = chunkZ * 16L + 8;
            long cellX = Math.floorDiv(centerX, spacing), cellZ = Math.floorDiv(centerZ, spacing);
            long h1 = mix64(cellX * 0x9E3779B97F4A7C15L ^ cellZ * 0xC2B2AE3D27D4EB4FL ^ SALT);
            long h2 = mix64(cellZ * 0x165667B19E3779F9L ^ cellX * 0x85EBCA77C2B2AE63L ^ ~SALT);
            long anchorX = cellX * spacing + 8 + Math.floorMod(h1, spacing - 16);
            long anchorZ = cellZ * spacing + 8 + Math.floorMod(h2, spacing - 16);
            if (Math.floorDiv(anchorX, 16) != chunkX || Math.floorDiv(anchorZ, 16) != chunkZ) return;
            int x = (int)anchorX, z = (int)anchorZ, y = region.getHighestBlockYAt(x, z);
            if (y < world.getMinHeight() + 2 || y + 2 >= world.getMaxHeight()) return;
            if (!region.isInRegion(x, y, z) || region.getType(x, y, z) != Material.SAND) return;
            for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++)
                if (region.isInRegion(x + dx, y, z + dz)) region.setType(x + dx, y, z + dz, Material.MAGMA_BLOCK);
            if (region.isInRegion(x, y + 1, z)) region.setType(x, y + 1, z, Material.MAGMA_BLOCK);
        }
    }
}

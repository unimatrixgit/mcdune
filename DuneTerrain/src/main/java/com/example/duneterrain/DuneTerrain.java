package com.example.duneterrain;

import org.bukkit.*;
import org.bukkit.block.Biome;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Villager;
import org.bukkit.generator.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import java.io.File;
import java.util.*;

public final class DuneTerrain extends JavaPlugin {
    private static final String[] PLANETS = {"arrakis", "giedi_prime", "kaitain", "caladan", "sigma_draconis_iv"};
    private NamespacedKey guildKey;

    @Override public void onEnable() {
        saveDefaultConfig();
        guildKey = new NamespacedKey("dunerealms", "guild");
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
        File worldFolder = new File(getServer().getWorldContainer(), planet);
        boolean existingWorld = worldFolder.isDirectory();
        World world = Bukkit.createWorld(new WorldCreator(planet)
            .environment(World.Environment.NORMAL)
            .generator(new PlanetChunkGenerator(this, planet)));
        if (world == null) {
            getLogger().severe("Could not create or load world '" + planet + "'.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, !planet.equals("arrakis"));
        world.setTime(planet.equals("giedi_prime") ? 18000 : 6000);
        setupPlanetSpawn(world, planet);
        if (existingWorld) {
            getLogger().warning("Loaded existing world '" + planet + "'. DuneTerrain only generates new chunks; existing terrain will remain unchanged. Back up and move the world folder, then restart, to regenerate it.");
        } else {
            getLogger().info("Created world '" + planet + "' with DuneTerrain.");
        }
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
            return planet.equals("arrakis") ? List.of(new SietchPopulator()) : List.of();
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
            if (planet.equals("arrakis")) placeSpiceDeposits(data, heights, random, minY, maxY);
            placeOres(data, random, path, minY, maxY);
        }
        @Override public BiomeProvider getDefaultBiomeProvider(WorldInfo worldInfo) {
            return new BiomeProvider() {
                @Override public Biome getBiome(WorldInfo info, int x, int y, int z) {
                    String configured = plugin.getConfig().getString("planets." + planet + ".biome", "PLAINS");
                    try { return Biome.valueOf(configured.toUpperCase(Locale.ROOT)); }
                    catch (IllegalArgumentException ex) { return Biome.PLAINS; }
                }
                @Override public List<Biome> getBiomes(WorldInfo info) { return List.of(getBiome(info, 0, 64, 0)); }
            };
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
                if (y + 1 < maxY && y > minY) data.setBlock(x, y, z, Material.SUSPICIOUS_SAND);
            }
        }
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
    private static final class SietchPopulator extends BlockPopulator {
        @Override public void populate(WorldInfo world, Random random, int cx, int cz, LimitedRegion region) {
            if (!world.getName().equalsIgnoreCase("arrakis") || random.nextInt(90) != 0) return;
            int x = cx * 16 + 4 + random.nextInt(8), z = cz * 16 + 4 + random.nextInt(8);
            int y = region.getHighestBlockYAt(x, z);
            if (y < 65 || y > world.getMaxHeight() - 12 || y - 12 < world.getMinHeight()) return;
            for (int dx = -4; dx <= 4; dx++) for (int dz = -4; dz <= 4; dz++) for (int dy = -10; dy <= 3; dy++) {
                int ax = x + dx, az = z + dz, ay = y + dy;
                if (!region.isInRegion(ax, ay, az)) continue;
                boolean cave = dy >= -9 && dy <= -5 && Math.abs(dx) <= 3 && Math.abs(dz) <= 3;
                if (cave) region.setType(ax, ay, az, dy <= -8 ? Material.WATER : Material.AIR);
                else if (dy >= 0 && dy <= 3 && Math.abs(dx) <= 3 && Math.abs(dz) <= 3) {
                    boolean wall = Math.abs(dx) == 3 || Math.abs(dz) == 3 || dy == 3;
                    region.setType(ax, ay, az, wall ? Material.SANDSTONE : Material.AIR);
                }
            }
            for (int dy = -7; dy <= 2; dy++) {
                if (region.isInRegion(x, y + dy, z)) region.setType(x, y + dy, z, Material.AIR);
                if (region.isInRegion(x + 1, y + dy, z)) region.setType(x + 1, y + dy, z, Material.LADDER);
            }
            if (region.isInRegion(x, y + 4, z)) region.setType(x, y + 4, z, Material.ORANGE_BANNER);
        }
    }
}

package com.example.dunenpc;

import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.block.data.type.Light;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.util.Vector;
import java.io.File;
import java.io.IOException;
import java.util.*;

/** Journals temporary camp lighting before changing blocks; never overwrites terrain. */
final class SmugglerCamps {
    private final DuneNPC plugin;
    private final File file;
    private final YamlConfiguration journal;
    private final Map<UUID, Camp> camps = new HashMap<>();
    private final Map<String, Lamp> lamps = new HashMap<>();
    private boolean pendingSave;
    private record Camp(UUID world, boolean ai, boolean gravity, boolean collidable,
                        boolean invulnerable, int despawn) {}
    private record Lamp(UUID world, int x, int y, int z, String original, Set<UUID> owners) {}

    SmugglerCamps(DuneNPC plugin) {
        this.plugin = plugin;
        file = new File(plugin.getDataFolder(), "smuggler-camps.yml");
        journal = YamlConfiguration.loadConfiguration(file);
        var section = journal.getConfigurationSection("camps");
        if (section != null) for (String key : section.getKeys(false)) try {
            String path = "camps." + key + ".";
            camps.put(UUID.fromString(key), new Camp(UUID.fromString(journal.getString(path + "world", "")),
                journal.getBoolean(path + "ai"), journal.getBoolean(path + "gravity"),
                journal.getBoolean(path + "collidable"), journal.getBoolean(path + "invulnerable"),
                journal.getInt(path + "despawn", 48000)));
        } catch (IllegalArgumentException ignored) { }
        section = journal.getConfigurationSection("lamps");
        if (section != null) for (String key : section.getKeys(false)) try {
            String path = "lamps." + key + ".";
            Set<UUID> owners = new HashSet<>();
            for (String owner : journal.getStringList(path + "owners")) owners.add(UUID.fromString(owner));
            lamps.put(key, new Lamp(UUID.fromString(journal.getString(path + "world", "")),
                journal.getInt(path + "x"), journal.getInt(path + "y"), journal.getInt(path + "z"),
                journal.getString(path + "original", "minecraft:air"), owners));
        } catch (IllegalArgumentException ignored) { }
    }

    void sync(Set<UUID> active) {
        boolean changed = false;
        for (UUID id : active) {
            Entity entity = Bukkit.getEntity(id);
            if (!(entity instanceof WanderingTrader trader)) continue;
            if (!camps.containsKey(id)) {
                camps.put(id, new Camp(trader.getWorld().getUID(), trader.hasAI(), trader.hasGravity(),
                    trader.isCollidable(), trader.isInvulnerable(), trader.getDespawnDelay()));
                planLights(id, trader.getLocation());
                changed = true;
            }
        }
        // Save the restoration journal before applying any new lighting or entity changes.
        if (changed) pendingSave = true;
        if (pendingSave && !save()) return;
        for (UUID id : active) {
            if (!camps.containsKey(id)) continue;
            Entity entity = Bukkit.getEntity(id);
            if (entity instanceof WanderingTrader trader) {
                trader.setAI(false);
                trader.setGravity(false);
                trader.setCollidable(false);
                trader.setInvulnerable(true);
                trader.setVelocity(new Vector());
                trader.setDespawnDelay(Integer.MAX_VALUE);
            }
        }
        for (var iterator = camps.entrySet().iterator(); iterator.hasNext();) {
            var entry = iterator.next();
            if (active.contains(entry.getKey())) continue;
            Entity entity = Bukkit.getEntity(entry.getKey());
            if (entity instanceof WanderingTrader trader) {
                Camp camp = entry.getValue();
                trader.setAI(camp.ai()); trader.setGravity(camp.gravity()); trader.setCollidable(camp.collidable());
                trader.setInvulnerable(camp.invulnerable()); trader.setDespawnDelay(camp.despawn());
                iterator.remove(); changed = true;
            }
            // Keep unloaded trader records until its chunk is loaded, so AI can be restored then.
        }
        for (var iterator = lamps.entrySet().iterator(); iterator.hasNext();) {
            Lamp lamp = iterator.next().getValue();
            World world = Bukkit.getWorld(lamp.world());
            if (world == null || !world.isChunkLoaded(lamp.x() >> 4, lamp.z() >> 4)) continue;
            Block block = world.getBlockAt(lamp.x(), lamp.y(), lamp.z());
            boolean inUse = lamp.owners().stream().anyMatch(active::contains);
            if (inUse) {
                if (block.isEmpty()) {
                    Light light = (Light) Bukkit.createBlockData(Material.LIGHT);
                    light.setLevel(15);
                    block.setBlockData(light, true);
                }
            } else {
                if (isCampLight(block.getBlockData())) block.setBlockData(Bukkit.createBlockData(lamp.original()), true);
                // If another system/player changed the block, keep that new block intact.
                iterator.remove(); changed = true;
            }
        }
        if (changed) { pendingSave = true; save(); }
    }

    static boolean isCampLight(org.bukkit.block.data.BlockData data) {
        return data instanceof Light light && light.getLevel() == 15 && !light.isWaterlogged();
    }

    private void planLights(UUID owner, Location location) {
        World world = location.getWorld();
        int y = location.getBlockY() + 2;
        if (y >= world.getMaxHeight()) return;
        int[][] offsets = {{0, 0}, {-4, -4}, {-4, 4}, {4, -4}, {4, 4}};
        for (int[] offset : offsets) {
            int x = location.getBlockX() + offset[0], z = location.getBlockZ() + offset[1];
            if (!world.isChunkLoaded(x >> 4, z >> 4)) continue;
            Block block = world.getBlockAt(x, y, z);
            String key = world.getUID() + "_" + x + "_" + y + "_" + z;
            Lamp existing = lamps.get(key);
            if (existing != null) existing.owners().add(owner);
            else if (block.isEmpty()) lamps.put(key, new Lamp(world.getUID(), x, y, z,
                block.getBlockData().getAsString(), new HashSet<>(Set.of(owner))));
        }
    }

    private boolean save() {
        journal.set("camps", null); journal.set("lamps", null);
        camps.forEach((id, camp) -> {
            String path = "camps." + id + ".";
            journal.set(path + "world", camp.world().toString()); journal.set(path + "ai", camp.ai());
            journal.set(path + "gravity", camp.gravity()); journal.set(path + "collidable", camp.collidable());
            journal.set(path + "invulnerable", camp.invulnerable()); journal.set(path + "despawn", camp.despawn());
        });
        lamps.forEach((id, lamp) -> {
            String path = "lamps." + id + ".";
            journal.set(path + "world", lamp.world().toString()); journal.set(path + "x", lamp.x());
            journal.set(path + "y", lamp.y()); journal.set(path + "z", lamp.z()); journal.set(path + "original", lamp.original());
            journal.set(path + "owners", lamp.owners().stream().map(UUID::toString).toList());
        });
        try { journal.save(file); pendingSave = false; return true; }
        catch (IOException exception) { plugin.getLogger().severe("Cannot save smuggler camp restoration journal: " + exception.getMessage()); return false; }
    }
}

package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.entity.*;
import org.bukkit.persistence.PersistentDataType;
import java.util.*;

/** A damageable Sniffer body following an invisible Husk with native zombie AI. */
final class SandwormMobs implements Listener {
    private final DuneCore plugin;
    private final NamespacedKey wormKey, bodyKey, brainKey;
    private final Map<UUID, UUID> pairs = new HashMap<>(); // body -> brain

    SandwormMobs(DuneCore plugin, NamespacedKey wormKey) {
        this.plugin = plugin;
        this.wormKey = wormKey;
        bodyKey = new NamespacedKey(plugin, "sandworm_body");
        brainKey = new NamespacedKey(plugin, "sandworm_brain");
        Bukkit.getPluginManager().registerEvents(this, plugin);
        Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 1L, 1L);
        World world = Bukkit.getWorld("arrakis");
        if (world != null) for (Entity entity : new ArrayList<>(world.getEntities())) restore(entity);
    }

    Sniffer spawn(Location location, Player target) {
        Husk brain = spawnBrain(location, target);
        try {
            Sniffer body = spawnBody(location, plugin.getConfig().getDouble("sandworms.health", 500.0));
            link(body, brain);
            return body;
        } catch (RuntimeException ex) { brain.remove(); throw ex; }
    }

    private Husk spawnBrain(Location location, Player target) {
        return location.getWorld().spawn(location, Husk.class, brain -> {
            brain.setAdult(); brain.setInvisible(true); brain.setSilent(true);
            brain.setCanPickupItems(false); brain.setRemoveWhenFarAway(true);
            brain.setCollidable(false); brain.getEquipment().clear();
            brain.getPersistentDataContainer().set(bodyKey, PersistentDataType.STRING, "pending");
            brain.getAttribute(Attribute.MAX_HEALTH).setBaseValue(500.0); brain.setHealth(500.0);
            brain.getAttribute(Attribute.ATTACK_DAMAGE).setBaseValue(plugin.getConfig().getDouble("sandworms.attack-damage", 8.0));
            brain.getAttribute(Attribute.MOVEMENT_SPEED).setBaseValue(plugin.getConfig().getDouble("sandworms.movement-speed", 0.33));
            if (target != null) brain.setTarget(target);
        });
    }

    private Sniffer spawnBody(Location location, double health) {
        return location.getWorld().spawn(location, Sniffer.class, body -> {
            body.getPersistentDataContainer().set(wormKey, PersistentDataType.BYTE, (byte)1);
            body.setAdult(); body.setAI(false); body.setGravity(false); body.setCollidable(false);
            body.setSilent(true); body.setRemoveWhenFarAway(false);
            body.setCustomName(ChatColor.GOLD + "Shai-Hulud | Sandworm"); body.setCustomNameVisible(true);
            body.getAttribute(Attribute.MAX_HEALTH).setBaseValue(plugin.getConfig().getDouble("sandworms.health", 500.0));
            body.setHealth(Math.max(1.0, Math.min(health, body.getAttribute(Attribute.MAX_HEALTH).getValue())));
            body.getAttribute(Attribute.SCALE).setBaseValue(plugin.getConfig().getDouble("sandworms.scale", 3.5));
        });
    }

    private void link(Sniffer body, Husk brain) {
        body.getPersistentDataContainer().set(brainKey, PersistentDataType.STRING, brain.getUniqueId().toString());
        brain.getPersistentDataContainer().set(bodyKey, PersistentDataType.STRING, body.getUniqueId().toString());
        pairs.put(body.getUniqueId(), brain.getUniqueId());
    }

    private UUID id(Entity entity, NamespacedKey key) {
        String text = entity.getPersistentDataContainer().get(key, PersistentDataType.STRING);
        try { return text == null ? null : UUID.fromString(text); }
        catch (IllegalArgumentException ex) { return null; }
    }

    @EventHandler public void onLoad(com.destroystokyo.paper.event.entity.EntityAddToWorldEvent event) {
        Entity entity = event.getEntity();
        if (!entity.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE)
            && !entity.getPersistentDataContainer().has(bodyKey, PersistentDataType.STRING)) return;
        // Both saved entities may load in different order. Wait before repairing a pair.
        Bukkit.getScheduler().runTaskLater(plugin, () -> { if (entity.isValid()) restore(entity); }, 20L);
    }

    private void restore(Entity entity) {
        if (!entity.getWorld().getName().equalsIgnoreCase("arrakis")) return;
        if (entity instanceof Husk legacy && legacy.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE)) {
            // Upgrade existing 1.0.4 sandworms without healing them or generating death rewards.
            Sniffer body = spawnBody(legacy.getLocation(), legacy.getHealth());
            legacy.getPersistentDataContainer().remove(wormKey);
            legacy.setInvisible(true); legacy.setSilent(true); legacy.setCollidable(false);
            legacy.setCustomNameVisible(false); legacy.getEquipment().clear();
            legacy.getAttribute(Attribute.SCALE).setBaseValue(1.0);
            link(body, legacy);
        } else if (entity instanceof Sniffer body && body.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE)) {
            UUID brainId = id(body, brainKey);
            Entity candidate = brainId == null ? null : Bukkit.getEntity(brainId);
            if (candidate instanceof Husk brain && body.getUniqueId().equals(id(brain, bodyKey))) link(body, brain);
            else if (brainId == null || body.getTicksLived() >= 20) link(body, spawnBrain(body.getLocation(), null));
        } else if (entity instanceof Husk brain && brain.getPersistentDataContainer().has(bodyKey, PersistentDataType.STRING)) {
            UUID bodyId = id(brain, bodyKey);
            Entity candidate = bodyId == null ? null : Bukkit.getEntity(bodyId);
            if (candidate instanceof Sniffer body && brain.getUniqueId().equals(id(body, brainKey))) link(body, brain);
            else if (brain.getTicksLived() >= 20) brain.remove();
        }
    }

    private void tick() {
        for (var entry : new ArrayList<>(pairs.entrySet())) {
            Entity bodyEntity = Bukkit.getEntity(entry.getKey()), brainEntity = Bukkit.getEntity(entry.getValue());
            if (!(bodyEntity instanceof Sniffer body)) {
                if (brainEntity != null && brainEntity.isValid()) brainEntity.remove();
                pairs.remove(entry.getKey()); continue;
            }
            if (!(brainEntity instanceof Husk brain)) {
                // On despawn remove the visual; chunk unload is handled by the delayed load repair.
                if (body.isValid()) body.remove();
                pairs.remove(entry.getKey()); continue;
            }
            if (!body.isValid() || body.isDead() || !brain.isValid() || brain.isDead()) continue;
            if (!brain.getWorld().getName().equalsIgnoreCase("arrakis")) { brain.remove(); body.remove(); pairs.remove(entry.getKey()); continue; }
            body.teleport(brain.getLocation());
            body.setRotation(brain.getLocation().getYaw(), 0);
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST) public void onBrainDamage(EntityDamageEvent event) {
        if (event.getEntity().getPersistentDataContainer().has(bodyKey, PersistentDataType.STRING)) event.setCancelled(true);
    }

    @EventHandler public void onBrainCombust(EntityCombustEvent event) {
        if (event.getEntity().getPersistentDataContainer().has(bodyKey, PersistentDataType.STRING)) event.setCancelled(true);
    }

    @EventHandler public void onBrainTarget(EntityTargetLivingEntityEvent event) {
        if (!event.getEntity().getPersistentDataContainer().has(bodyKey, PersistentDataType.STRING)) return;
        if (event.getTarget() != null && (!(event.getTarget() instanceof Player)
            || !event.getTarget().getWorld().getName().equalsIgnoreCase("arrakis"))) event.setCancelled(true);
    }

    @EventHandler public void onDeath(EntityDeathEvent event) {
        Entity entity = event.getEntity();
        UUID partner = entity instanceof Sniffer ? id(entity, brainKey) : id(entity, bodyKey);
        if (partner == null) return;
        event.getDrops().clear(); event.setDroppedExp(0);
        Entity other = Bukkit.getEntity(partner);
        if (other != null) other.remove();
        pairs.remove(entity instanceof Sniffer ? entity.getUniqueId() : partner);
    }
}

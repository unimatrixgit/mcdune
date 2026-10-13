package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.event.entity.*;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.persistence.*;
import org.bukkit.plugin.PluginManager;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import java.util.*;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SandwormMobsTest {
    private PersistentDataContainer tags() {
        PersistentDataContainer tags = mock(PersistentDataContainer.class);
        Map<NamespacedKey, Object> values = new HashMap<>();
        doAnswer(call -> { values.put(call.getArgument(0), call.getArgument(2)); return null; }).when(tags).set(any(), any(), any());
        when(tags.get(any(), any())).thenAnswer(call -> values.get(call.getArgument(0)));
        when(tags.has(any(), any())).thenAnswer(call -> values.containsKey(call.getArgument(0)));
        doAnswer(call -> { values.remove(call.getArgument(0)); return null; }).when(tags).remove(any());
        return tags;
    }

    @Test void snifferBodyLinksToHuskBrainAndOnlyBodyDeathRemovesPartner() {
        DuneCore plugin = mock(DuneCore.class);
        when(plugin.getName()).thenReturn("DuneCore");
        when(plugin.getConfig()).thenReturn(new YamlConfiguration());
        World world = mock(World.class); when(world.getName()).thenReturn("arrakis");
        Location location = new Location(world, 12, 75, 34);
        Husk brain = mock(Husk.class); Sniffer body = mock(Sniffer.class); Player target = mock(Player.class);
        when(brain.getUniqueId()).thenReturn(UUID.randomUUID()); when(body.getUniqueId()).thenReturn(UUID.randomUUID());
        when(brain.getWorld()).thenReturn(world); when(brain.getLocation()).thenReturn(location);
        when(body.isValid()).thenReturn(true); when(brain.isValid()).thenReturn(true);
        PersistentDataContainer brainTags = tags(), bodyTags = tags();
        when(brain.getPersistentDataContainer()).thenReturn(brainTags); when(body.getPersistentDataContainer()).thenReturn(bodyTags);
        when(brain.getEquipment()).thenReturn(mock(EntityEquipment.class));
        AttributeInstance attribute = mock(AttributeInstance.class); when(attribute.getValue()).thenReturn(500.0);
        when(brain.getAttribute(any(Attribute.class))).thenReturn(attribute);
        when(body.getAttribute(any(Attribute.class))).thenReturn(attribute);
        // Paper applies these configuration callbacks inside the live server registry.
        // This unit test exercises pairing, following, damage routing and cleanup.
        when(world.spawn(any(Location.class), eq(Husk.class), any(Consumer.class))).thenReturn(brain);
        when(world.spawn(any(Location.class), eq(Sniffer.class), any(Consumer.class))).thenReturn(body);
        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(scheduler);
            bukkit.when(Bukkit::getPluginManager).thenReturn(mock(PluginManager.class));
            bukkit.when(() -> Bukkit.getEntity(body.getUniqueId())).thenReturn(body);
            bukkit.when(() -> Bukkit.getEntity(brain.getUniqueId())).thenReturn(brain);
            NamespacedKey wormKey = new NamespacedKey("dunerealms", "sandworm");
            bodyTags.set(wormKey, PersistentDataType.BYTE, (byte)1);
            SandwormMobs service = new SandwormMobs(plugin, wormKey);
            assertSame(body, service.spawn(location, target));
            verify(world).spawn(eq(location), eq(Sniffer.class), any(Consumer.class));
            verify(world).spawn(eq(location), eq(Husk.class), any(Consumer.class));
            assertTrue(body.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE));
            assertFalse(brain.getPersistentDataContainer().has(wormKey, PersistentDataType.BYTE));
            org.mockito.ArgumentCaptor<Runnable> tick = org.mockito.ArgumentCaptor.forClass(Runnable.class);
            verify(scheduler).runTaskTimer(eq(plugin), tick.capture(), eq(1L), eq(1L));
            tick.getValue().run(); verify(body).teleport(location);
            EntityDamageEvent damage = mock(EntityDamageEvent.class); when(damage.getEntity()).thenReturn(brain);
            service.onBrainDamage(damage); verify(damage).setCancelled(true);
            EntityDamageEvent bodyDamage = mock(EntityDamageEvent.class); when(bodyDamage.getEntity()).thenReturn(body);
            service.onBrainDamage(bodyDamage); verify(bodyDamage, never()).setCancelled(true);
            EntityDeathEvent death = mock(EntityDeathEvent.class); when(death.getEntity()).thenReturn(body);
            when(death.getDrops()).thenReturn(new ArrayList<>());
            service.onDeath(death); verify(brain).remove(); verify(death).setDroppedExp(0);
        }
    }
}

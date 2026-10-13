package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.messaging.Messenger;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;
import java.io.*;
import java.nio.file.Path;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ArrakisAnnouncementsTest {
    @TempDir Path directory;

    @Test void embargoSurvivesRestartAndRetriesWhenNoPlayerCanCarryMessage() throws Exception {
        DuneCore plugin = mock(DuneCore.class);
        Server server = mock(Server.class);
        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        when(plugin.getDataFolder()).thenReturn(directory.toFile());
        when(plugin.getServer()).thenReturn(server);
        when(server.getMessenger()).thenReturn(mock(Messenger.class));
        YamlConfiguration config = new YamlConfiguration(); config.set("network.enabled", true);
        when(plugin.getConfig()).thenReturn(config);
        World world = mock(World.class); when(world.getName()).thenReturn("arrakis");
        Player carrier = mock(Player.class);
        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(scheduler);
            bukkit.when(Bukkit::getOnlinePlayers).thenReturn(List.of(carrier));
            ArrakisAnnouncements announcements = new ArrakisAnnouncements(plugin);
            Location location = new Location(world, -123, 76, 456);
            long before = System.currentTimeMillis();
            announcements.announce("spicebloom", location, "same-bloom");
            announcements.announce("spicebloom", location, "same-bloom");
            bukkit.verify(() -> Bukkit.broadcastMessage(contains("X -123, Y 76, Z 456")), times(1));
            File file = directory.resolve("arrakis-announcements.yml").toFile();
            YamlConfiguration state = YamlConfiguration.loadConfiguration(file);
            assertEquals(1, state.getKeys(false).size());
            String key = state.getKeys(false).iterator().next();
            assertTrue(state.getLong(key + ".due") >= before + 900000L);
            org.mockito.ArgumentCaptor<Runnable> callback = org.mockito.ArgumentCaptor.forClass(Runnable.class);
            verify(scheduler).runTaskTimer(eq(plugin), callback.capture(), eq(20L), eq(20L));
            callback.getValue().run();
            verify(carrier, never()).sendPluginMessage(any(), anyString(), any());
            state.set(key + ".due", 0L); state.save(file);
            new ArrakisAnnouncements(plugin).announce("spicebloom", location, "same-bloom");
            verify(scheduler, times(2)).runTaskTimer(eq(plugin), callback.capture(), eq(20L), eq(20L));
            Runnable restarted = callback.getValue();
            bukkit.when(Bukkit::getOnlinePlayers).thenReturn(List.of());
            restarted.run();
            assertFalse(YamlConfiguration.loadConfiguration(file).getBoolean(key + ".sent"));
            bukkit.when(Bukkit::getOnlinePlayers).thenReturn(List.of(carrier));
            restarted.run(); restarted.run();
            org.mockito.ArgumentCaptor<byte[]> packet = org.mockito.ArgumentCaptor.forClass(byte[].class);
            verify(carrier, times(1)).sendPluginMessage(eq(plugin), eq("BungeeCord"), packet.capture());
            DataInputStream input = new DataInputStream(new ByteArrayInputStream(packet.getValue()));
            assertEquals("Message", input.readUTF()); assertEquals("ALL", input.readUTF());
            assertTrue(input.readUTF().contains("Spacing Guild"));
            assertTrue(YamlConfiguration.loadConfiguration(file).getBoolean(key + ".sent"));
        }
    }
}

package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.command.CommandSender;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SandwormCommandTest {
    @Test void permissionIsRequiredBeforeLookingUpArrakis() {
        DuneCore plugin = mock(DuneCore.class);
        CommandSender sender = mock(CommandSender.class);
        when(plugin.onCommand(any(), any(), anyString(), any())).thenCallRealMethod();
        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            plugin.onCommand(sender, null, "dune", new String[]{"summon", "sandworm"});
            verify(sender).sendMessage(contains("dune.admin"));
            bukkit.verifyNoInteractions();
        }
    }

    @Test void invalidArgumentsAndNonFiniteCoordinatesNeverSpawnAnEntity() {
        DuneCore plugin = mock(DuneCore.class);
        CommandSender sender = mock(CommandSender.class);
        when(sender.hasPermission("dune.admin")).thenReturn(true);
        when(plugin.onCommand(any(), any(), anyString(), any())).thenCallRealMethod();
        World world = mock(World.class);
        when(world.getMinHeight()).thenReturn(-64);
        when(world.getMaxHeight()).thenReturn(320);
        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(() -> Bukkit.getWorld("arrakis")).thenReturn(world);
            for (String[] args : new String[][]{
                {"summon"}, {"summon", "other"}, {"summon", "sandworm", "1"},
                {"summon", "sandworm", "NaN", "70", "0"},
                {"summon", "sandworm", "Infinity", "70", "0"},
                {"summon", "sandworm", "0", "320", "0"},
                {"summon", "sandworm", "0", "-65", "0"},
                {"summon", "sandworm", "not-a-number", "70", "0"},
                {"summon", "sandworm"}
            }) plugin.onCommand(sender, null, "dune", args);
            verify(sender, atLeastOnce()).sendMessage(contains("Usage:"));
            verify(sender, times(4)).sendMessage(contains("world border and build height"));
            verify(sender).sendMessage(contains("Coordinates must be numbers"));
            verify(sender).sendMessage(contains("otherwise supply x y z"));
            verify(world, never()).spawn(any(Location.class), any(Class.class), any(java.util.function.Consumer.class));
        }
    }
}

package com.example.dunenpc;

import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.type.Light;
import org.bukkit.entity.WanderingTrader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class SmugglerCampsTest {
    @TempDir Path directory;

    @Test void overlappingCampsKeepLightsUntilLastQuestEndsAndRestoreNpcState() {
        DuneNPC plugin = mock(DuneNPC.class);
        when(plugin.getDataFolder()).thenReturn(directory.toFile());
        World world = mock(World.class);
        UUID worldId = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
        when(world.getUID()).thenReturn(worldId);
        when(world.getMaxHeight()).thenReturn(320);
        when(world.isChunkLoaded(anyInt(), anyInt())).thenReturn(true);
        BlockData air = mock(BlockData.class);
        when(air.getAsString()).thenReturn("minecraft:air");
        Light light = mock(Light.class);
        when(light.getLevel()).thenReturn(15);
        Map<String, AtomicReference<BlockData>> states = new HashMap<>();
        when(world.getBlockAt(anyInt(), anyInt(), anyInt())).thenAnswer(call -> {
            String key = call.getArgument(0) + "/" + call.getArgument(1) + "/" + call.getArgument(2);
            AtomicReference<BlockData> state = states.computeIfAbsent(key, ignored -> new AtomicReference<>(air));
            Block block = mock(Block.class);
            when(block.getType()).thenAnswer(ignored -> state.get() == air ? Material.AIR : Material.LIGHT);
            when(block.isEmpty()).thenAnswer(ignored -> state.get() == air);
            when(block.getBlockData()).thenAnswer(ignored -> state.get());
            doAnswer(change -> { state.set(change.getArgument(0)); return null; }).when(block).setBlockData(any(), eq(true));
            return block;
        });
        WanderingTrader traderA = trader(world), traderB = trader(world);
        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(() -> Bukkit.getEntity(first)).thenReturn(traderA);
            bukkit.when(() -> Bukkit.getEntity(second)).thenReturn(traderB);
            bukkit.when(() -> Bukkit.getWorld(worldId)).thenReturn(world);
            bukkit.when(() -> Bukkit.createBlockData(Material.LIGHT)).thenReturn(light);
            bukkit.when(() -> Bukkit.createBlockData("minecraft:air")).thenReturn(air);
            SmugglerCamps camps = new SmugglerCamps(plugin);
            camps.sync(Set.of(first, second));
            assertEquals(5, states.size());
            assertTrue(states.values().stream().allMatch(state -> state.get() == light));
            verify(traderA).setAI(false);
            verify(traderA).setDespawnDelay(Integer.MAX_VALUE);
            camps.sync(Set.of(second));
            assertTrue(states.values().stream().allMatch(state -> state.get() == light));
            verify(traderA).setAI(true);
            verify(traderA).setGravity(true);
            verify(traderA).setInvulnerable(false);
            // Reloading the journal retains both ownership and the original air blocks.
            camps = new SmugglerCamps(plugin);
            camps.sync(Set.of());
            assertTrue(states.values().stream().allMatch(state -> state.get() == air));
            verify(traderB).setAI(true);
            verify(traderB).setDespawnDelay(12345);
        }
    }

    @Test void restorationOnlyRecognizesOwnedLevelFifteenUnwaterloggedLights() {
        assertFalse(SmugglerCamps.isCampLight(mock(BlockData.class)));
        Light light = mock(Light.class);
        when(light.getLevel()).thenReturn(14);
        assertFalse(SmugglerCamps.isCampLight(light));
        when(light.getLevel()).thenReturn(15);
        assertTrue(SmugglerCamps.isCampLight(light));
        when(light.isWaterlogged()).thenReturn(true);
        assertFalse(SmugglerCamps.isCampLight(light));
    }

    private WanderingTrader trader(World world) {
        WanderingTrader trader = mock(WanderingTrader.class);
        when(trader.getWorld()).thenReturn(world);
        when(trader.getLocation()).thenReturn(new Location(world, 100, 70, 100));
        when(trader.hasAI()).thenReturn(true);
        when(trader.hasGravity()).thenReturn(true);
        when(trader.isCollidable()).thenReturn(true);
        when(trader.getDespawnDelay()).thenReturn(12345);
        return trader;
    }
}

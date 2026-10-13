package com.example.dunenpc;

import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class NpcAdminTest {
    @Test void npcManagementGuiRequiresOperatorStatusEvenWithDuneAdminPermission() {
        DuneNPC plugin = mock(DuneNPC.class);
        Player player = mock(Player.class);
        when(player.hasPermission("dune.admin")).thenReturn(true);
        doCallRealMethod().when(plugin).openAdmin(player);
        plugin.openAdmin(player);
        verify(player).sendMessage(contains("Operators only"));
        verify(player, never()).openInventory(any(org.bukkit.inventory.Inventory.class));
    }
}

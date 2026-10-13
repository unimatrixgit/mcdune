package com.example.dunerealms;

import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AdminGuiTest {
    @Test void nonOperatorsCannotOpenMenuEvenWithAdminPermission() {
        AdminGui gui = mock(AdminGui.class);
        Player player = mock(Player.class);
        when(player.hasPermission("dune.admin")).thenReturn(true);
        doCallRealMethod().when(gui).open(player);
        gui.open(player);
        verify(player).sendMessage(contains("Operators only"));
        verify(player, never()).openInventory(any(org.bukkit.inventory.Inventory.class));
    }

    @Test void nonOperatorsNeverReceiveAutomaticRod() {
        AdminGui gui = mock(AdminGui.class);
        Player player = mock(Player.class);
        doCallRealMethod().when(gui).giveRod(player);
        gui.giveRod(player);
        verify(player, never()).getInventory();
    }
}

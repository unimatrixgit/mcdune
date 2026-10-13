package com.example.dunerealms;

import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class SpiceSaleTest {
    @Test void ordinarySaleOnlyBonusesSanctionedPlayersAndHandlesRoundingAndOverflow() {
        assertEquals(1995, DuneCore.sanctionedSpiceGross(1500, true));
        assertEquals(1500, DuneCore.sanctionedSpiceGross(1500, false));
        assertEquals(20, DuneCore.sanctionedSpiceGross(15, true));
        assertEquals(0, DuneCore.sanctionedSpiceGross(-100, true));
        assertEquals(Integer.MAX_VALUE, DuneCore.sanctionedSpiceGross(Integer.MAX_VALUE, true));
    }
    @Test void sanctionedNormalSaleAppliesBonusBeforeLevyAndDoesNotReportSmuggling() throws Exception {
        for (boolean spiceAppointment : new boolean[]{true, false}) {
            DuneCore plugin = mock(DuneCore.class);
            Player player = mock(Player.class);
            Politics politics = mock(Politics.class);
            when(plugin.factionOf(player)).thenReturn("Atreides");
            when(politics.isAuthorizedSpice("Atreides")).thenReturn(spiceAppointment);
            when(politics.isAuthorizedWater("Atreides")).thenReturn(!spiceAppointment);
            when(politics.levy(player.getUniqueId(), 1995)).thenReturn(25);
            Field field = DuneCore.class.getDeclaredField("politics");
            field.setAccessible(true); field.set(plugin, politics);
            when(plugin.processSpiceSale(player, 1500)).thenCallRealMethod();
            assertEquals(1970, plugin.processSpiceSale(player, 1500));
            verify(plugin, never()).reportSmuggling(any(), anyString(), anyInt());
            verify(politics).levy(player.getUniqueId(), 1995);
        }
    }
}

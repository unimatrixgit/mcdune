package com.example.dunenpc;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class SmugglerMissionsTest {
    @Test void realTimeDeadlineExpiresAtThirtyMinutesAndSurvivesOfflineElapsedTime() {
        long start = 1000000L;
        Smugglers.Contract contract = new Smugglers.Contract("water", 4, 41, UUID.randomUUID(), 0, 0,
            start + Smugglers.MISSION_MILLIS);
        assertFalse(contract.expired(start + 29 * 60 * 1000L));
        assertFalse(contract.expired(start + Smugglers.MISSION_MILLIS - 1));
        assertTrue(contract.expired(start + Smugglers.MISSION_MILLIS));
        assertTrue(contract.expired(start + 24 * 60 * 60 * 1000L));
    }
    @Test void deliveryNeedsDifferentTraderAndSixtyFourBlockRoute() {
        UUID source = UUID.randomUUID(), other = UUID.randomUUID();
        Smugglers.Contract contract = new Smugglers.Contract("spice", 64, 1392, source, 10, -20);
        assertFalse(Smugglers.validDestination(contract, source, 1000, 1000));
        assertFalse(Smugglers.validDestination(contract, other, 73, -20));
        assertTrue(Smugglers.validDestination(contract, other, 74, -20));
        assertTrue(Smugglers.validDestination(contract, other, 10, -84));
    }
}

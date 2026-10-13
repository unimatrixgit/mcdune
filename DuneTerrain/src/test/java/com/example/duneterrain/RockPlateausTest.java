package com.example.duneterrain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RockPlateausTest {
    @Test void capsHoldEvenWithInvalidConfigurationAndNegativeSeeds() {
        for (int maximum : new int[]{-10, 0, 1, 2, 3, 100}) {
            for (long seed = -100; seed <= 100; seed++) {
                int count = RockPlateaus.count(seed, maximum);
                assertTrue(count >= 1 && count <= 3);
                for (int configured : new int[]{-5, 0, 1, 5, 100}) {
                    int interval = RockPlateaus.interval(configured, 14, count);
                    assertTrue(interval >= 1 && interval <= 5);
                    assertTrue(count * interval <= 14);
                }
            }
        }
    }

    @Test void terracesAreFlatAndStepDownTowardEdge() {
        for (int count = 1; count <= 3; count++) {
            assertEquals(count, RockPlateaus.level(0, 18, count));
            assertEquals(0, RockPlateaus.level(18, 18, count));
            int previous = count;
            java.util.Set<Integer> levels = new java.util.HashSet<>();
            for (int sample = 0; sample <= 1800; sample++) {
                int level = RockPlateaus.level(sample / 100.0, 18, count);
                assertTrue(level <= previous && previous - level <= 1);
                levels.add(level);
                previous = level;
            }
            assertEquals(count + 1, levels.size());
        }
    }
}

package com.example.duneterrain;

/** Deterministic nested terraces shared by every chunk intersecting a formation. */
final class RockPlateaus {
    static int count(long seed, int configuredMaximum) {
        return 1 + (int)Math.floorMod(seed, Math.max(1, Math.min(3, configuredMaximum)));
    }

    static int interval(int configuredInterval, int maximumHeight, int count) {
        return Math.max(1, Math.min(5, Math.min(configuredInterval, Math.max(1, maximumHeight / count))));
    }

    static int level(double distance, double radius, int count) {
        double fraction = distance / radius;
        if (fraction > 0.9) return 0;
        return Math.min(count, 1 + (int)Math.floor((0.9 - fraction) / (0.9 / count)));
    }
}

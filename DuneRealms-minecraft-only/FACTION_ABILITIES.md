# Faction full-set bonuses

Full set = faction-tagged stillsuit helmet, leggings and boots plus either a faction-tagged stillsuit chestplate or the faction's merged Elytra-stillsuit in the chest slot. Mixed house sets do not qualify.

- Fremen: base Unbreaking III on all four pieces, Swift Sneak III on leggings (these are permanent item enchantments).
- Corrino: base Protection III on all four pieces.
- Harkonnen: full-set Strength II potion effect (amplifier 1); refreshed every second while equipped.
- Ordos: with a full set, right-clicking an Ender Pearl grants five seconds of invisibility and still throws the pearl.
- Atreides: full set adds eight maximum health points (+4 hearts) through a player attribute modifier, removed when the set breaks.

This is source-only, not compiled or tested. Important: the current `onOrdosPearl` activation may not fire in all interaction contexts (e.g. cancelled interaction); verify on Paper 1.21.4. Harkonnen Strength may persist up to ~1.25 seconds after removal due to potion refresh. Existing network synchronization limitations remain.

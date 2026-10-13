# Project Dune — Session 2

The repository contains independent Gradle projects: `DuneTerrain` (world generation), `DuneRealms-minecraft-only` (DuneCore gameplay), and `DuneEss` (economy and travel). All three require Java 21 and target Paper 1.21.4.

## Rock formations

New Arrakis darkstone formations have one to three concentric, sand-topped flat plateaus. Heights between plateaus are at most five blocks. The count and shape are deterministic across chunk boundaries. Configure `planets.arrakis.darkstone-islands.max-plateaus` and `plateau-interval` in DuneTerrain; the hard caps still apply to larger values. The existing `max-height` also limits total rise above the surrounding high ground. Existing generated chunks retain their terrain.

## Arrakis sightings

Generated spice bloom markers announce when their chunk loads. Admin-placed markers, erupted blooms, sandworm spawns/loads, and worm-death spice fields use the same announcement service. Arrakis receives a lore message with X/Y/Z and a fifteen-minute warning. After fifteen real minutes, the Spacing Guild informs all online players across the proxy. A bloom already announced at those coordinates or a worm with the same UUID does not restart the countdown on chunk reload.

Timers and sighting identities persist in `plugins/DuneCore/arrakis-announcements.yml`. Restarting the server preserves deadlines. If no player is connected to the Arrakis backend when a Guild message is due, delivery waits for a player connection. This is required by plugin messaging. Delivery uses the standard BungeeCord `Message` subchannel with recipient `ALL`; Velocity must have `bungee-plugin-message-channel = true`. With DuneCore `network.enabled: false`, the Guild message is delivered locally instead. Install DuneCore alongside DuneTerrain and DuneEss for coordinated announcements. No proxy-side custom plugin is required.

## Admin summon

`/dune summon sandworm` summons at your current position on Arrakis. `/dune summon sandworm <x> <y> <z>` accepts absolute numeric coordinates on the loaded Arrakis world, including from console. Both require `dune.admin` (OP by default). Invalid, non-finite, obstructed, out-of-height, and out-of-border locations are rejected. Summoned worms use the natural worm's tags, attributes, hostile AI, effects, and death spice field. An explicit admin summon bypasses the automatic population limit and does not change the automatic hourly cooldown.

## Sniffer model update

DuneCore 1.0.5 uses a visible, damageable Sniffer body and an invisible Husk providing native zombie targeting, pursuit and melee attacks. Linked UUIDs persist on both entities. Existing loaded Husk sandworms are converted without resetting their remaining health. Only the visible body is tagged as the reward-bearing sandworm; killing it removes the controller and generates one spice field. Natural spawns and admin summons share this implementation. DuneResourcePack.zip includes the updated 192x192 Sniffer skin with desert-tan segments and toothlike head details. The texture changes the skin; the visible geometry remains the vanilla Sniffer.

## Build verification

Run `gradle clean build` separately in each plugin directory. Terrain tests cover plateau count/spacing hard caps, flat levels, and monotonic terrace boundaries. Core tests cover the fifteen-minute deadline, coordinate messages, reload deduplication, restart persistence, offline delivery retry, and a single correctly encoded global Guild message. A live Paper/Velocity network is still required to verify gameplay appearance and actual proxy delivery.

Protocol references: [BungeeCord plugin messaging](https://www.spigotmc.org/wiki/bukkit-bungee-plugin-messaging-channel/#message) and [Velocity channel compatibility](https://docs.papermc.io/velocity/dev/plugin-messaging/#bungeecord-channel-compatibility).

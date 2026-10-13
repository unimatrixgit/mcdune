# Project Dune

<img src="docs/artwork/arrakis-cover.png" alt="Illustrated Arrakis dunes and Shai-Hulud" width="240" align="right">

A Dune-themed Minecraft Java plugin suite for **Paper 1.21.4 and Java 21**. Explore Arrakis, harvest melange, join a faction, trade through the Spacing Guild, and encounter Shai-Hulud.

**[Project Dune website](https://project-dune.bonnystoat9.chatgpt.site)** — illustrated landing page, searchable online manual, Races & Houses, Exchange and News. The website is public; profiles and private support tickets require sign-in. Live feeds show “server not connected” until configured; see [DiscordSRV integration](website/DISCORD-FEEDS.md).

**[Read the illustrated user manual](docs/Dune-User-Manual.pdf)** for the complete player and administrator guide, command reference, default configuration, 77 pages, 68 illustrated item and interface icons, ornate Minecraft-inspired House and spice backgrounds, and reserved chapters for the other planets.

## Current modules

| Module | Version | Role |
| --- | --- | --- |
| DuneCore | 1.0.9 | Factions, stillsuits, sandworms, spice harvesting, sun exposure, water, politics, jobs, menus, Guild announcements, and optional DiscordSRV website feeds. |
| DuneTerrain | 1.0.7 | Planet generation, Arrakis formations and landmarks, spice deposits, personal sietch caches, and safe spawn. |
| DuneNPC | 1.0.0 | Guild Navigators, smuggler missions, stationary quest camps, timed deadlines, particles and NPC admin GUI. |
| DuneEss | 1.0.1 | Solaris economy through Vault, spice sales, Guild travel, help, and administrative travel/economy tools. |
| DuneResourcePack.zip | Minecraft Java 1.21.4 | Desert Sniffer skin, haunted Fremen zombies, spice-gold suspicious sand, and smuggler wandering traders. |

## Download and install

1. Open the latest successful [GitHub Actions build](https://github.com/unimatrixgit/mcdune/actions) and download **DuneRealms-Server-Package** from its artifacts. The server package includes Vault, all four project plugin JARs, the resource pack, and the manual. GitHub artifact downloads may require sign-in.
2. Stop the Paper server and back up its worlds, plugin data, and any shared database before replacing an existing release.
3. Put Vault, DuneCore, DuneNPC, DuneEss, and DuneTerrain JARs in `plugins/`. Keep only one JAR per plugin. Remove the legacy `DuneRealms.jar` if upgrading from that plugin.
4. Start once to create configuration files. Set the backend's `server.planet` in DuneTerrain and matching `network.local-planet` in DuneCore, then restart after edits.
5. Put `DuneResourcePack.zip` in the client's `.minecraft/resourcepacks` directory and enable it. Vanilla and Fabric clients use the same resource pack; it does not belong in `mods/`.

For a planet used as Paper's primary world, configure its generator and biome provider in `bukkit.yml` as explained in the [terrain guide](DuneTerrain/README.md). Existing chunks are preserved when generation settings change.

## What is implemented

- Five playable factions: Fremen, Harkonnen, Corrino, Atreides, and Ordos, with homeworlds, passive abilities, faction-colored stillsuits, and a paid winged-stillsuit upgrade.
- Arrakis dunes, sparse oasis trees, cave sietches with personal supplies, spice deposits, magma-marked blooms, and darkstone formations **about 100 blocks across, with up to three flat plateaus and at most five blocks between levels**. The old default sizes are automatically upgraded; already generated chunks keep their terrain.
- Tagged spice harvesting and Solaris sales; CHOAM hourly quota contracts and a player-sponsored spice exchange with a 15% worker / 85% sponsor split.
- Arrakis sun exposure, finite-water trading, imperial appointments, prototype politics and invasions, and optional PostgreSQL-backed permits and bounties.
- **Visible Sniffer sandworms with native zombie AI**, provided by invisible Husk controllers. The Sniffer body can be fought and killed; its death produces a rich spice field and removes its controller.
- Haunted Fremen zombie raiders, with an increased spawn chance near rich spice fields.
- Lore sightings with coordinates on Arrakis, followed by a **fifteen-minute Spacing Guild announcement** to online players across the proxy. Timers persist through restart and avoid repeating a sighting on ordinary chunk reload.
- Configurable Navigator menus, a Guild travel menu, and a paged in-game help guide.
- Operator-only Imperial Admin Scepters, automatically supplied to ops, with linked DuneNPC management controls.
- Roaming Arrakis smugglers with lore-based spice and water missions, a 30-minute real-time deadline, stationary illuminated quest camps and green/purple status particles.
- A 33% gross spice-sale bonus for Imperial appointees; those appointees use basic spice sales instead of smuggler missions.
- An opt-in DiscordSRV bridge for public announcements and read-only Arrakis exchange snapshots. Publication is disabled by default; the website never executes trades or accepts jobs.

The other planet terrain profiles already exist: Giedi Prime, Kaitain, Caladan, and Sigma Draconis IV. Their dedicated manual chapters reserve space for future planet-specific gameplay rather than describing unreleased quests or cities.

## Quick start

Use `/dune help` or `/duneess help menu`, choose a faction with `/dune choose <faction>`, and equip all four stillsuit pieces from the kit. Use the tagged Spice Harvest Shovel on Arrakis suspicious sand, then `/duneess sell` to sell the collected spice. `/dune` opens the Navigator; `/duneess balance` checks Solaris and `/duneess travel [planet]` opens or requests Guild travel.

The default spice price is 15 Solaris, normal Guild fare is 100, and starting balance is zero. Direct sales can incur the Spacing Trust levy and smuggling consequences. Server operators may change these values.

## Admin sandworm summon

Requires **`dune.admin`**, granted to operators by default.

```text
/dune summon sandworm
/dune summon sandworm 120 76 -240
```

Without coordinates, the player must be on Arrakis and the worm appears at their position. Explicit absolute X/Y/Z coordinates work from console as well; omit the leading slash in the console. Arrakis must be loaded on the current backend. Invalid numbers, blocked space, out-of-border positions, and invalid build heights are rejected.

Admin summons use the same Sniffer body, zombie AI, attributes, announcements, and death reward as natural worms. They bypass the automatic population cap and do not change the saved automatic spawn cooldown.

Other administrative commands include `/duneess admin solari <player> <amount>`, `/duneess admin teleport <arrakis|sietch|spiceblow> [player]`, `/duneess admin spicebloom [player]`, `/dune guireload`, and `/dune serverjobs reload`. See the manual for the full command reference.

## Networking and persistence

The intended network uses one Paper backend per planet behind Velocity. Match plugin world IDs to the backend's local planet and configure exact proxy server names in DuneCore. Enable Velocity's BungeeCord plugin-message compatibility. World IDs use underscores; proxy names may use hyphens.

Guild travel is an asynchronous transfer request without an arrival acknowledgment. The global Guild notice needs an online player connection on Arrakis; a due notice waits if that backend is empty. Use `network.enabled: false` for local delivery.

PostgreSQL optionally shares player faction/inventory, Solaris, politics, permits, and bounties. CHOAM state and Guild deadlines remain local files. Player exchange worker assignments are in memory, and shared-mode listing persistence is incomplete. Shared profiles do not synchronize every vanilla player property or plugin tag. This is a gameplay prototype; test multi-backend economics and transfer behavior before a public deployment.

## Build and verification

Use **Java 21 and Gradle 8.14**. Run `gradle clean build` separately in:

```text
DuneRealms-minecraft-only/
DuneTerrain/
DuneEss/
DuneNPC/
```

The existing workflow builds all four project modules and produces the downloadable server package. Automated tests cover plateau limits and boundaries, Guild deadlines/restart persistence/deduplication/offline retry, admin argument and permission checks, and sandworm pairing/following/damage routing/cleanup. The current plugin build passes; actual Minecraft rendering and live Paper/Velocity behavior still require staging-server verification.

## Documentation and artwork

- [Illustrated user manual](docs/Dune-User-Manual.pdf)
- [Plain-background illustrated manual](docs/Dune-Complete-Illustrated-Manual.pdf)
- [Compact decorated game poster](docs/posters/Dune-Compact-Decorated-Poster.png)
- [Worlds and mechanics poster](docs/posters/Dune-Illustrated-Worlds-and-Mechanics-Poster.png)
- [Editable manual sources](docs/manual-authoring/README.md)
- [DuneNPC commands and mission mechanics](DuneNPC/README.md)
- [Website source and build](website/README.md)
- [DiscordSRV exchange/news feed setup](website/DISCORD-FEEDS.md)
- [Session 2 changes](SESSION-2.md)
- [DuneTerrain setup](DuneTerrain/README.md)
- [DuneCore details](DuneRealms-minecraft-only/README.md)
- [Resource pack setup](DuneResourcePack/README.md)
- [Sandworm texture prompt and validation](DuneResourcePack/SANDWORM-TEXTURE.md)
- [Manual artwork and icon prompt notes](docs/artwork/README.md)

The manual's cover, sietch art, and item icons are thematic illustrations, not screenshots or new game models. Actual faction armor uses vanilla leather armor with custom attributes and tags, and the winged suits use Elytra geometry. Shai-Hulud uses the vanilla Sniffer model with the updated desert skin.

### Operator admin controls (DuneCore 1.0.6)
Operators automatically receive a glowing **Imperial Admin Scepter**, a tagged blaze rod.
Right-click it in your main hand to open the admin menu, or use `/dune admin`.
`/dune adminitem` recovers the rod; delivery retries every five seconds if your inventory is full.
The same check supplies newly opped online players and replacements after respawning. Existing rods are not duplicated.

The menu can summon a sandworm at your current Arrakis location, place a Guild Navigator NPC,
give one test spice item, reload `gui.yml`, issue your selected faction kit, and show politics status.
Actions use the existing command checks. Both opening the menu and clicking a control require operator status;
granting only `dune.admin` does not enable this menu. A deopped player cannot use a retained rod.
The blaze rod has custom model data 1006, a gold name and enchantment glint; its current appearance uses the vanilla blaze rod texture.

### Roaming smugglers and Imperial spice charter (DuneNPC 1.0.0 / DuneCore 1.0.8)
Arrakis wandering traders become **Arrakis Smugglers**. Their vanilla AI roams toward new
nearby destinations each minute; up to six are maintained in loaded chunks near players by default.
Right-click a smuggler to select one active delivery contract:

- **The Unmarked Spice Run**: carry 64 tagged spice to another smuggler, past the Imperial ledgers.
- **Water for the Hidden Sietch**: carry four tagged finite-source Arrakis water buckets to supply a hidden sietch.

The receiving trader must be a different entity and at least 64 horizontal blocks from the departure location.
Deliver by clicking the active contract in its menu. Default rewards are 1,392 Solaris for spice and
41 Solaris for water, before the existing Trust levy (45% above the commodity's normal base value, rounded).
Only the required cargo is consumed; water deliveries return empty buckets. The existing smuggling bounty
system is called after delivery and requires PostgreSQL to track bounties across servers.
The lore is in-game mission dialogue; these contracts do not generate additional sietch structures.

`/dune smuggle status` shows cargo, departure and reward; `/dune smuggle cancel` abandons a contract without taking cargo.
Contracts save to `plugins/DuneNPC/smuggling.yml` and survive restarts on the Arrakis backend; they do not transfer between backends.
Appointments are checked when opening, accepting and delivering. Members of the Emperor-appointed Spice Steward
or House of Water receive no smuggling offers. Their normal `/duneess sell` spice sales instead receive **+33% gross
value before the Trust levy**, rounded to the nearest Solaris. An appointment gained mid-contract blocks delivery;
the contract can still be cancelled. Expired appointments remove the bonus automatically.

`smugglers.enabled`, `smugglers.max-traders`, `smugglers.spice-amount`, and `smugglers.water-amount` control this system.
Existing config files use the defaults when these keys are missing. Restart after editing.
Enable the updated resource pack for the sand-tan smuggler robes, face covering and leather equipment.
Vanilla packs replace the texture of **all wandering traders**, including those on other planets; mission behavior is Arrakis-only.
Without the pack the same missions work with the vanilla trader appearance.

### Smuggler quest camps (DuneNPC 1.0.0)
A smuggler who issued an active contract stops moving, cannot be pushed or harmed,
and cannot naturally despawn while waiting. Invisible level-15 light blocks illuminate
its camp. Completing or cancelling the last contract restores the NPC's previous AI,
gravity, collision, vulnerability and despawn timer, and removes the temporary lights.
If several players use the same smuggler, its camp stays active until every contract ends.

Green dust particles mean no active contracts; purple particles mean at least one open contract
issued by that NPC. Delivery still goes to a different smuggler as described above.
Lighting replaces only air, preserves existing terrain and lights, and journals its original
block data to `smuggler-camps.yml`. Overlapping camps share light ownership. Restart recovery
and unloaded-chunk cleanup run automatically when the chunks are available, without forcing
chunks to load. Normal shutdown restores loaded camps; restarting reactivates outstanding contracts.

### DuneNPC installation and management
Install **DuneNPC-1.0.0.jar**, **DuneCore-1.0.8.jar** and **DuneTerrain-1.0.7.jar** together, alongside DuneEss and Vault.
DuneNPC now owns all Guild Navigator and smuggler NPC behavior; DuneTerrain only sets up terrain and safe world spawn.
Existing tagged NPCs are recognized. On first installation, DuneNPC copies `smuggling.yml` and
`smuggler-camps.yml` from DuneCore when its own copies are absent, leaving the originals as backups.
Old smuggler settings and the terrain's Guild NPC enabled setting are imported into `plugins/DuneNPC/config.yml` once.
Edit NPC settings there after migration. Do not downgrade to a Core version that still runs smuggler logic alongside DuneNPC.

Open the glowing admin rod, then **DuneNPC Management**, or run `/dunenpc admin`.
The operator GUI places Guild Navigators and Arrakis smugglers, displays NPC/contract counts,
and links back to the Dune admin menu. `/dunenpc smuggle status|cancel` is available to ordinary players;
`/dune smuggle status|cancel` remains an alias. `/dune guildnpc` remains an alias for the existing `dune.admin` command.
All missions last **30 real minutes**, including offline/server downtime. Older contracts receive
one 30-minute deadline on migration. Remaining time appears in the contract menu and status command.
Expiry pays nothing, keeps cargo, and clears the camp once its last contract ends.

Sietch Armoury now has its own page with all 68 item entries and full suit abilities. Diplomacy displays current leaders, Emperor, Spice Steward and House of Water through the opt-in DuneCore 1.0.10 DiscordSRV snapshot bridge. Configure the dedicated diplomacy channel as described in website/DISCORD-FEEDS.md.


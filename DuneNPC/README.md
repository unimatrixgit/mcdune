# DuneNPC for Paper 1.21.4

Install DuneNPC 1.0.0 alongside DuneCore 1.0.8, DuneTerrain 1.0.7, DuneEss and Vault on Java 21.
DuneNPC owns Guild Navigator placement/interactions and all Arrakis smuggler NPCs, missions,
quest camps, invisible lights, particles and mission deadlines. DuneCore retains politics,
faction rules, the sanctioned 33% spice-sale bonus, sandworms and hostile combat mobs.

## Admin GUI
Open the Imperial Admin Scepter's menu and choose **DuneNPC Management**, or use `/dunenpc admin`.
Operators can place a Guild Navigator, place an Arrakis Smuggler, view loaded NPC and contract
counts, and return to the Dune admin menu. GUI actions check operator status again when executed.
`/dunenpc guildnpc` preserves the existing `dune.admin` permission; `/dune guildnpc` is an alias.
`/dunenpc smuggler` spawns a smuggler at an operator's current Arrakis position.

## Missions and camps
Right-click an Arrakis Smuggler to accept **The Unmarked Spice Run** (64 tagged spice) or
**Water for the Hidden Sietch** (4 finite-source water buckets). Default gross rewards are
1,392 and 41 Solaris respectively, less the existing Trust levy. Deliver to a different
smuggler at least 64 horizontal blocks from the departure point. Only the required tagged
cargo is taken; water runs return empty buckets. Existing bounty rules apply on delivery.
Spice Steward and House of Water members cannot accept/deliver smuggling missions; they get
the 33% increase on ordinary spice sales instead. Appointments are rechecked at interaction.

- Green particles: no open contracts, NPC can roam.
- Purple particles: one or more open contracts issued by this NPC.
- During an open contract its source NPC stays stationary, cannot be pushed, is invulnerable,
  cannot naturally despawn, and has invisible level-15 lights around its camp.
- Completion, cancellation or expiry restores the NPC and clears the lights when its last contract ends.
- Every contract expires after **30 real minutes**, including offline time and server downtime.
- Expiry keeps cargo and pays no reward. Time remaining appears in the GUI and status command.

`/dunenpc smuggle status|cancel` and the legacy `/dune smuggle status|cancel` are player commands.
Contracts are local to the Arrakis backend and persist in `plugins/DuneNPC/smuggling.yml`.
Camp restoration is journaled in `smuggler-camps.yml`; only air is replaced, existing terrain
and light blocks are preserved, overlapping camps share ownership, and unloaded chunks are
cleaned when they become available. Normal shutdown clears loaded camps; outstanding
contracts reactivate on startup. Terrain is not force-loaded for temporary camp cleanup.

## Upgrade and configuration
Replace DuneCore and DuneTerrain with the matching versions and add DuneNPC, then restart.
Do not run an older Core's smuggler implementation alongside DuneNPC. The new plugin copies
legacy mission/camp files only when its own destination files are missing. Originals remain
as backups. Existing NPC tags are retained for compatibility. On first configuration it imports
legacy Core smuggler options and Terrain's Guild NPC enabled flag. Existing undated contracts
receive one initial 30-minute window; later restarts retain the saved deadline.

Edit `plugins/DuneNPC/config.yml` and restart:
`guild-npc.enabled`, `smugglers.enabled`, `smugglers.max-traders`, `smugglers.spice-amount`,
`smugglers.water-amount`. Mission duration is fixed at the requested 30 minutes.
Enable DuneResourcePack.zip for the smuggler skin. Standard resource packs change all wandering
trader appearances; NPC missions only run on Arrakis. Without the pack they look like vanilla traders.

## Build
Run `gradle clean build` in DuneNPC. Its Gradle project compiles the sibling DuneCore dependency;
DuneNPC's JAR contains only NPC classes, and DuneCore must also be installed on the server.
Run `gradle build :DuneCore:build` to include Core's tests in the same invocation.
Live Paper testing of NPC navigation, particles and block lighting remains required.

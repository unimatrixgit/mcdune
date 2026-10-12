# Shared PostgreSQL network prototype

Set `database.enabled: true` and identical JDBC settings on every Paper backend. Create a PostgreSQL database and user with schema privileges. The plugin creates `dune_players`, `dune_politics`, and `dune_bounties`.

`SharedDatabase` stores faction, Solaris and serialized full player inventory (including armor/offhand) across planetary servers. `Politics` loads and writes the common political YAML state. Bounties are issued on smuggler water COLLECTION, not sale, on any planet; online players in that planet receive the alert. Player kills claim the bounty once through an atomic SQL UPDATE.

**CRITICAL LIMITATIONS / NOT PRODUCTION READY**
- The politics YAML snapshot is NOT transactionally locked. Simultaneous votes/invasions from different servers can overwrite each other. Replace with normalized SQL tables and atomic transactions before public deployment.
- Player inventories are saved on quit and on `savePlayers()`. Concurrent sessions or a crashed backend can cause duplication or stale state. Implement proxy transfer handshakes, single-session leases, and atomic write/version checks.
- Database operations are synchronous on the Paper main thread. Move to async workers with safe main-thread inventory application.
- Smuggler career remains local-memory only; it must be persisted to shared storage.
- A water bucket on non-Arrakis worlds does not automatically become a tagged Arrakis water bucket and cannot be sold through the existing water seller mechanic.
- Bounty reward is based on ONE water bucket's smuggler gross proceeds, not total inventory; adjust for bulk smuggling contracts.
- Local NPC retaliation is immediate on collection; spawned Husks may be affected by local biome/daylight rules.
- The existing lobby routing and travel refund limitations remain.
- This source was not compiled or tested. Test against Paper 1.21.4 and PostgreSQL before deployment.

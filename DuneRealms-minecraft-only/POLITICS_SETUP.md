# Spacing Trust and Politics (prototype)

This release adds actual Paper plugin code (`Politics.java`) and `/dune politics` commands.

- Spice sales contribute 1.21% of gross Solaris earnings to the Spacing Trust (rounded up).
- `/dune politics deposit <amount>` deposits extra Solaris.
- `/dune politics status` shows treasury, current election winners and invasion.
- `/dune politics vote <online-player>` elects a faction leader, one vote per voter per UTC-based 7-day epoch window.
- `/dune politics emperorvote <online-player>` elects an Emperor, one vote per player per election window.
- `/dune politics invasion <faction>` allows current faction leader to spend a configurable Trust cost and open an invasion.
- `/dune politics defend` allows a defending faction member to contribute once; configured count repels the invasion.
- `/dune politics grantarrakis <faction>` lets the current Emperor issue one weekly temporary free-transport decree to Arrakis.

**IMPORTANT LIMITATIONS**
1. Politics state and player wallets are currently saved to local YAML files, not shared between servers. The system is NOT network-consistent and must not be used as-is for cross-server politics. Implement transactional MySQL/PostgreSQL shared storage and proxy routing first.
2. Invasion defense is a command-based contribution prototype, not objective-based PvP or territory capture.
3. Elections use a rolling epoch-aligned 7-day window; votes immediately influence winners, without nomination or election-close certification.
4. Arrakis free-travel decree applies to GUI command travel path; review all NPC travel paths before release.
5. There is no safe refund on failed proxy transfers in the pre-existing travel system.
6. Code is provided as source and has not been compiled/tested against a live Paper/Velocity network.

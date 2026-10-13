# Arrakis Water & Sietch prototype

New Arrakis chunks generate underground cave **sietches** at roughly 2,000-block spacing. Each has connected chambers for sleeping and cooking, a concealed surface entry, a descending waterfall, and a bottom water reservoir. A chest opens a personal cache for each player with at least 250 tagged spice, enchanted gold armor, planks, and bread. Existing chunks will not be retroactively populated. See `plugins/DuneTerrain/config.yml` (`sietches.spacing`) to change the interval.

- `/dune water guild` - become an official Spacing Guild water seller.
- `/dune water smuggler` - become a smuggler.
- `/dune water status` - show career and rates.
- `/dune water sell` - sell tagged Arrakis water buckets at half the configured spice unit price. Smugglers receive 45% more gross pay, but have a configurable 30% chance of angering locals and spawning hostile Husks if on Arrakis.
- All water sales contribute the same 1.21% Spacing Trust levy as spice sales.
- On Arrakis, water flow is canceled, bucket placement is blocked, and ice/cauldron water formation is limited. Collected water is tagged and source blocks are consumed.

## Limitations / unfinished
- This is an early prototype and is **not tested or compiled**.
- Careers are in memory and reset on server restart; make them persistent in a shared database.
- Water sold is separate from the existing CHOAM hourly contract templates. The water career system is available through `/dune water`, but water-collection quotas are not yet integrated into the CHOAM job rotation.
- Finite water is not fully enforced against every vanilla mechanism (dispensers, bottles, structure generation, commands, ice import, cross-server inventory transfers, etc.). Harden these before a production launch.
- No shared player inventory or balance across proxy servers yet.

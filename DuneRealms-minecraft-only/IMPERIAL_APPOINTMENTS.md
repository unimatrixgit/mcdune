# Imperial appointments

The elected Emperor may make **one appointment of each type per weekly election term**:
- `/dune politics steward <faction>`: appoints the Steward of Dune. Only this faction has legal spice-trading privileges; it is also the faction exempted from Arrakis travel-smuggling classification.
- `/dune politics houseofwater <faction>`: appoints the House of Water. Only this faction has legal water-selling privileges.

All other factions are treated as smugglers when selling the corresponding resource, with planet-wide warnings and bounty registration. Unauthorized Arrakis arrivals remain flagged as travel smugglers. Appointments expire when the weekly election changes or a different Emperor becomes the winner.

IMPORTANT: This is source-only, uncompiled and untested. The existing political YAML snapshot stored in PostgreSQL is not transaction-safe across concurrent servers. The existing water-career selection remains available but imperial appointment overrides its legal status. The plugin still requires reliable proxy transfer handling, inventory locking, and stronger anti-exploit protections.

# DuneRealms governance bridge: Landsraad and Spacing Guild

## Core identities
- **House/Faction = race and political allegiance**. Existing five Houses remain the canonical factions. Houses elect leaders and participate in Landsraad politics, imperial law and invasions.
- **Clan = guild**. Independent player organization for social, PvE and military cooperation. A clan is not automatically a House or corporation.
- **Company = corporation**. Economic organization registered and overseen in-world by the Spacing Guild. Companies may employ members of different Houses and clans.

## Institutional responsibilities
**Landsraad:** House representation, elections, political laws, sanctioned invasions, House political standing, imperial appointments and inter-House diplomacy. Existing faction leadership remains authoritative; no company purchase confers political votes or an Emperor appointment.

**Spacing Guild:** Corporate registry, company charters, trade licenses, commercial transport agreements, the fictional DRX exchange and financial compliance. Spacing Trust is the bank service, not a substitute for Guild governance.

The Landsraad may publish trade policy and sanctions; the Spacing Guild enforces applicable commercial restrictions through existing permission and contract checks. Neither system may silently override the other's ownership or political records.

## Cross-link mechanics
- House or clan hires a company under a signed contract (delivery, construction, logistics, defense supply).
- A company can sponsor a House or clan via a documented Dunemarks grant. No direct purchase of political votes, staff permissions or military victories.
- Companies can invest in other companies by purchasing issued shares through the DRX market once settlement is implemented.
- Houses/clans may own company shares through their own treasury **only after** an explicit authorized treasury mandate; never treat all faction members as joint owners.
- Guild transport contracts can adjust *commercial* transport fees or access according to approved policy, never bypass an Emperor-sanction rule without explicit political authorization.
- All payments use authoritative Dunemarks balances and OGM references with separate idempotency keys and auditable approvals.

## Registration and automatic banking
A real-money shop entitlement may unlock a player company's registration application. A verified payment is not itself an active charter. After approval, a server-side idempotent provisioning workflow must create a fictional corporate account and founder mandate in the existing bank service, with zero initial funds. Invitees must accept their membership; co-ownership and revocation are independently auditable. An account is not operational until its actual bank identifier and access controls are confirmed.

## Integration contracts (not yet implemented)
- `company.issuer_id` -> Spacing Guild registry
- `company.bank_account_id` -> authoritative DuneBank corporate account
- `house.faction_id` -> Landsraad faction and leadership records
- `clan.clan_id` -> guild records
- `commercial_contract` -> company + counterparty (house/clan/company) + approved signer UUID + amount + reference + status
- `investment` -> DRX fill and authorized treasury debit/credit
- `transport_license` -> company + service scope + issuer + policy version + expiration

No live database or server mutation is authorized by this document. Preserve existing faction elections, bank balances, guild records, and Exchange listings.

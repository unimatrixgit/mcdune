# DUNE-008: read-only Battlegroup analysis for SF-032 / G-006

Reference: https://bitbucket.org/liamrigg/pa-tools/src/564f02157c7c028beb57c16b4c8a2c02869b35ba/

Inspected 2026-10-14. The cloned repository HEAD exactly matches this commit. No Starfall implementation or running game was inspected or changed. Recommendations below are a port proposal, not claims about current Starfall behaviour.

## Source map and behaviour

| Source path | Observed behaviour |
| --- | --- |
| `app/BattleGroup.php` | Owner is `creator_id`; many-to-many accepted and pending users; bookings linked by `bg_id`. Derived flags identify the current user's ownership/membership/application. Member counts and average size/value/score/XP use accepted members. |
| `app/Http/Controllers/Api/BattleGroupController.php` | Sorted group list, create with creator auto-enrolled, detail with roster/candidate users and upcoming booking counts, delete, request membership. |
| `app/Http/Controllers/Api/BattleGroupUserController.php` | Add directly, accept application, remove member. Candidate list excludes accepted/pending users and requires a planet. |
| `routes/api.php` | Battlegroup routes are inside auth/enabled/activity middleware, outside the explicit admin and BC route groups. Join/accept mutate through GET. |
| `resources/assets/js/components/pages/Battlegroups.vue` | Ranking table: owner, member count, averages, growth; sort, create, request join, admin delete. Join disabled while pending or without a planet. |
| `resources/assets/js/components/pages/Battlegroup.vue` | Detail: booking list, pending roster, accepted roster with planet stats/distorters/booking counts, direct-add candidates. UI accepts/declines for owner/Admin; add/remove for owner/Admin/BC. Some handlers reference loadTeamups/loadTeams/loadFleets without corresponding methods in this component. |
| `app/Console/Commands/CalculateBattlegroups.php`, `app/Console/Commands/PaTick.php` | Tick processing accumulates accepted members' latest planet changes in size/value/score/XP. Growth counters reset at hour zero; cumulative totals remain. This is contribution accumulation, not a snapshot sum of current planets. |
| `app/AttackBooking.php`, `app/Services/MyBookings.php` | Booking owner, explicit shared users, optional group assignment. Group-filter/detail queries add accepted groups to booking visibility. Upcoming means landing tick strictly greater than current tick and attack still open. |
| `app/Http/Controllers/Api/AttackBookingsController.php` | Owner/shared user may edit notes, calc, group and status. Owner reassignment moves the old owner to shared users and removes the new owner from shared users. Owner cannot drop while shared users remain; unshared owner drop clears owner and group. |
| `app/Services/Booking/BookingUserList.php`, `BookingUser.php`, `ChangeBookingStatus.php` | Candidate co-users limited to enabled planet holders and, when assigned, accepted group members; separate add/remove helpers. Status change notifies other booking participants through Telegram. |
| `app/Services/Bot/Commands/Attacks/BattleGroupCommand.php`, `TopBGSCommand.php`, `config/bot.php` | `bg` members/targets and ranking summaries. Members output coordinates and race; targets include claims and landing data. The command picks the first membership row without explicit accepted-state filtering. |
| `database/migrations/2019_08_05_*battlegroup*`, `*battelgroup*` | Group totals and membership pivot. Inspected creation migrations do not establish unique group/user pairs or foreign-key cleanup. The pivot rollback uses a differently spelled table name. |

`AttackBookingBattleGroup.php` and `AttackBooking::teamups()` contain a further pivot relation, but searching source only found those definitions and unused component state. Do not present teamup CRUD as a complete working subsystem without further evidence.

## Rights and ownership issues to resolve in the port

The inspected group controllers do not enforce the owner/Admin/BC checks shown in the UI. Enforce an explicit policy in Worker for every read and write, independent of hidden buttons. Distinguish group creator/leader, global BC, administrator, accepted member, pending applicant and outsider. There is no separate deputy/leader role model in the inspected source. Owner transfer is a proposed addition, not an existing group endpoint.

The booking owner endpoint authorises when the actor owns the booking OR the **destination user** belongs to its group. That second condition does not establish authority of the actor. Require actor ownership or an explicitly authorised group-leader/admin action; also validate the destination's accepted membership and eligibility. Membership alone should not silently transfer another person's claim.

`MyBookings` applies its ID restriction only when the computed permitted-ID array is nonempty. Use deny-by-default SQL predicates even for an empty allowed set. Check group/booking detail and participant-list access separately. Candidate-list restrictions are not sufficient write validation: the inspected add/remove helpers do not themselves enforce actor rights or candidate eligibility.

Joining an already accepted group should not demote the member to pending, as the unconditional sync can do. Accept must require a real pending row. Define whether multiple accepted groups are allowed: the data model permits them, while the bot assumes a first group. Keep group membership separate from alliance membership and do not reset either incidentally.

## Practical Worker + vanilla JS proposal

1. Reuse Starfall's authenticated account/planet IDs and existing booking records. Add `battlegroups(id,name,owner_user_id,created_at,version)` and `battlegroup_members(group_id,user_id,state,joined_tick)` with unique composite membership, checked states and deliberate deletion rules. Add group reference to bookings and a unique booking-participant pivot only if those concepts are absent. Keep historical tick contributions separate from current membership.
2. Centralise `canViewGroup`, `canManageMembers`, `canViewBooking`, `canEditBooking` and `canTransferBooking`. Initially mirror the documented UI role matrix, after confirming Starfall's BC equivalent. Scope candidate users to the intended game/round and eligibility. Do not return complete user/scan models to outsiders.
3. Provide authenticated GET list/detail/booking reads and POST create/apply/accept/decline/add/leave/transfer operations; use PATCH for edits and DELETE for removal. Avoid state-changing GETs. Return per-action capabilities from Worker for accessible UI buttons; still recheck every mutation. Bound sorting fields, pagination, name length and request bodies.
4. Make membership changes, leader transfer and booking reassignment atomic using the deployed database's supported transaction or conditional-batch mechanism. Use a version/expected-owner comparison to reject stale writes with 409. A target/wave/landing-slot claim needs a uniqueness rule or atomic conditional update; identify the actual Starfall claim unit before choosing that constraint.
5. Vanilla JS needs a sortable group index and detail view with pending/accepted members, eligible candidates, booking list/filter, assignment selector and transfer/drop dialogs. Show loading/error/empty/permission states and refresh capabilities after mutations. Render names and notes as text, not trusted HTML. No Vue or PHP dependency is needed.
6. Preserve contribution-based totals only if desired for SF-032: record each group/member/tick contribution once and derive averages explicitly (including zero and negative totals). Use a stored UTC day/tick boundary, not repeated wall-clock midnight resets; guard zero denominator. Process no-planet/no-tick members safely. Re-running a tick must not double count contributions.
7. Keep notifications behind Starfall's existing channel integration and emit after a successful write. Telegram and bot commands are optional adapter parity, not requirements to import their credentials or dependencies. Implement core groups/permissions/bookings first, scoring and notification adapters second.

## Claims and lifecycle decisions

- Leader departure/removal: require atomic transfer to an eligible accepted member, or explicit disband; never leave an ownerless active group. Pending users cannot lead.
- Member departure/removal: immediately revoke group-derived access; define whether their individually owned booking remains personal or must be reassigned. Do not silently release a claim while other participants still depend on it.
- Group deletion: require owner/admin authority, show affected future bookings and choose reassignment or conversion to personal bookings. Avoid dangling group IDs; preserve an audit trail and historical score records.
- Planet deletion/reset, disabled account and round change: revalidate eligibility at mutation and read time. Coordinate policy with existing reset rules; this analysis does not authorise any reset or alliance changes.
- Reassigning a booking's group: validate actor and new group, and deliberately handle shared users outside the new group. Preserve or revoke explicit sharing by an explicit rule, not an accidental join query.
- Past/closed booking: read-only history unless a separate administrative correction is authorised. Boundary is `land_tick > current_tick` for parity.

## Verification plan for the implementing colleague

- Policy matrix tests for owner/Admin/BC/member/pending/outsider against every endpoint, including guessed IDs and forged group/user IDs. Verify empty memberships return no bookings.
- Membership tests: duplicate apply/add/accept, apply by accepted member, accept without application, cross-group access, missing/disabled planet, owner removal and concurrent transfer/delete.
- Booking tests: actor versus destination membership on transfer; old owner becomes participant exactly once; new owner removed from shared list; protected drop; reassignment across groups; membership loss revokes only group-derived access.
- Concurrent claim tests: two requests for one slot yield one winner; stale update returns conflict; retry is idempotent. Test current-tick boundary and closed attacks.
- Tick tests: no planet, zero/negative totals, leave/rejoin, midnight, replayed tick, two rounds and independent groups; no duplicate contribution or divide-by-zero.
- UI integration: real Worker responses, permission refresh, failed/stale writes, empty rosters, escaped HTML, small screens and keyboard operation. Confirm whether bot/notification parity belongs in acceptance criteria.

This is a source review and implementation/test proposal only. No Starfall runtime tests were run and no Starfall code, branches or game state were changed.

# Stronghold policy proposal — DUNE-012 / SF-049 / G011

Standalone pure JavaScript contribution for the Starfall colleague. Not imported by Dune or Starfall and not deployed. Implements the exclusive-claim proposal in [the policy report](../../docs/STARFALL-STRONGHOLD-POLICY.md). Uses standard ESM and `structuredClone`; no packages or credentials.

Run from repository root:

```sh
node --test proposals/stronghold-policy/policy.test.mjs
```

## Model and exports

`state = { revision, claims }`; each claim has stable `id`, `roundId`, canonical `galaxy` (`x:y`), stable `allianceId`, `status` and `assetRefs`. Asset references include structures, construction reservations and any other assets that must block release. Other metadata is preserved. The integration adapter must populate this authoritative inventory; omitting real assets defeats release protection.

- `claimStronghold`: reserve a free galaxy for an alliance, maximum one reserved stronghold per alliance per round. Canonical coordinate validation prevents padded-coordinate duplicates.
- `releaseStronghold`: release an undisputed, empty reservation; retain its historical record and ID. Even administrators cannot bypass the asset guard.
- `transferStronghold`: transfer the claim and its asset references together, preserving identity and active/inactive status. Both source and target leadership approvals, or explicit staff authority, are required. The target must have no other reservation in that round.
- `markDisputed`: staff freezes one or more existing claims with a short reason. Released history cannot be disputed.
- `importLegacyClaims`: trusted snapshot normalisation; overlapping galaxy OR alliance reservations become disputed, including connected conflicts. No assets or rows deleted. This is an offline migration constructor with revision zero; do not use it as a live state reset.
- `resolveConflict`: staff selects a disputed winner and explicit active/inactive status. Only directly overlapping losers are released, and only if they have no assets. Others remain disputed pending their own resolution. The function cannot decide a winner or move assets for staff.
- `bonusEligible`: local structure-dependent bonus gate using round, accepted/current alliance membership represented by the adapter, resident galaxy, active claim and functional-structure flag. It is not the whole bonus system: preserve existing alliance-wide effects, cooldowns, production calculations and reward ledger separately.
- `validateState`, `normalizeGalaxy`, `PolicyError`: validation/helpers. Errors expose stable codes: INVALID, STALE, NOT_FOUND, FORBIDDEN, CONFLICT, DUPLICATE_ID, DISPUTED, RELEASED, ASSETS_REMAIN.

Active, inactive and disputed records all reserve ownership. Only released records free it. Overlapping reservations are allowed solely when every overlapping pair is disputed. The retained inactive claim deliberately prevents instant hostile takeover; no expiry/conquest mechanic is introduced. The adapter must apply authorised active↔inactive lifecycle updates when structures fail or return, without freeing ownership and while retaining revision checks.

## Required integration boundary

Every mutator receives `expectedRevision` and returns a cloned, validated state with the next revision. Inputs are never mutated; failed operations leave the original state intact. No timestamps, network calls, random IDs, account edits, planet relocation or deployments are performed. Supply IDs server-side. Unknown/nonexistent IDs and malformed state fail explicitly.

`context = { authorizedAllianceIds: [...] }` must be derived from server-verified stronghold management permissions, never request JSON. A transfer context contains both IDs only after independently verifying approvals for the particular source, target, claim and current revision. Do not interpret it as proof that a single player controls both alliances. `admin: true` is trusted adjudication authority, not a client flag. Record approver identities/reason in the server audit log. Residence eligibility, account/round existence, request origin and any cooldown/cost checks also belong at that boundary.

Pure functions do **not** serialize requests. Two calls using the same snapshot can both return valid candidates. The Worker adapter must persist claim state, occupancy, asset ownership, funds and audit records in one supported transaction/conditional operation:

1. Read authoritative state and asset reservations, derive trusted permissions, validate the expected revision and call the policy.
2. Commit using compare-and-swap (`revision = expectedRevision`) and uniqueness protection for current `(round, galaxy)` and `(round, alliance)` reservations. Reject a zero-row revision update with 409 and commit none of the dependent writes. In D1, select an atomic supported batch/transaction design that enforces these conditions for the whole operation; a lone conditional update followed by unconditional writes is insufficient.
3. Preserve legacy conflicts in a separate conflict ledger or equivalent representation compatible with unique live-claim constraints. Do not add an unconditional unique constraint directly across unresolved disputed rows. Transfer claim ownership and actual structure records consistently; policy asset references alone do not rewrite their owner fields.
4. Persist operation IDs/results for request retries. This proposal intentionally rejects reused claim IDs and already released claims; replay the recorded result for an identical authorised operation before invoking it again. Reject an operation-ID reuse with changed payload.
5. Emit notifications only after commit. Add real database concurrency/rollback tests before integration; this suite tests domain policy, not database atomicity.

No coordinate-slot allocation is implemented here. Existing global occupancy checks must still distinguish players, ghosts, structures and reservations. Preserve ordinary 1–10 / 11–15 ranges and the approved special handling of 1:1, including protected tribute 1:1:11. A galaxy claim alone never grants permission to occupy a ghost slot, move a planet, change membership or trigger a round reset.

## Checks performed

14 Node tests pass: independent round namespaces, galaxy/alliance exclusivity, permissions and two-party transfer, stale revisions, historical IDs, asset-guarded release, inactive reservation, metadata-preserving transfer, legacy conflict retention, staff adjudication, local bonus gates and invalid input. A concurrency-oriented test explicitly demonstrates why persistence needs compare-and-swap. No Starfall runtime or deployment checks are claimed.

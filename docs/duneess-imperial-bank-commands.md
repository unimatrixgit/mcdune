# DuneEss — Imperial Bank commands and native menus

Status: **approved design; implementation pending**. This document is part of the Bank API v1 integration work, not a claim that commands or forms are deployed.

## Ownership and data source
- All player-facing commands and native menus belong to **DuneEss (DuneRealms Essentials)**, not DuneCore or a standalone bank plugin.
- The **existing Imperial Bank service/database** is authoritative for balances, account identifiers, transfers, ledger entries, and leaderboards. Do not create a second wallet or economy ledger.
- Resolve Minecraft player names to UUIDs and Imperial Bank account identifiers **server-side**. Account identifiers are not authorization credentials.
- Use the same bank ledger and history as the Control Panel. Preserve compatibility with the Kit Marketplace's bank API contract.

## Commands
| Command | Purpose |
| --- | --- |
| `/bank` | Open the Imperial Bank main menu |
| `/pay <player> <amount> [description...]` | Pay another player from sender's Current Account to recipient's Current Account |
| `/balance` (alias `/bal`) | Display Current, Savings and combined Solari |
| `/baltop` | Top 10 richest players, Current + Savings; exclude official and server accounts |
| `/clantop` | Top 10 clan treasuries, not members' personal wealth |
| `/housetop` | Five House treasuries, not members' personal wealth |
| `/companytop` | Top 10 company treasuries, not members' personal wealth |

Permission nodes: `duneess.pay`, `duneess.balance`, `duneess.baltop`, `duneess.clantop`, `duneess.housetop`, `duneess.companytop`, and `duneess.bank`.

## Native GUI requirements
- Java: native Minecraft dialogs. Bedrock: native Geyser/Floodgate forms. No mandatory client mod or resource pack.
- `/bank` opens a simple main menu with account summary and six actions: Send Payment, My Accounts, Richest Players, Top Clans, Top Houses, Top Companies.
- `/pay` opens a **full-page Bedrock custom form** with verified recipient player name, Solari amount, optional description, Current Account source, and review step. Java uses an equivalent native payment dialog.
- A **separate confirmation step** must show resolved recipient, amount, description and debit total. Do not submit a payment on initial form entry. If the session, permissions, linked identity, recipient or amount changes, reject and require review again.
- Leaderboard forms show positions 1–10, names and Solari values, plus Back to Bank. House leaderboard shows all five Houses.
- Account menu shows Current, Savings, total and bank transaction history.
- All values come from the bank API; any sample values in mockups are illustrative only.

## Transaction invariants
1. A command's recipient is a player name, **never a client-supplied account number**. Resolve identity and bank account on the trusted server.
2. Parse amount as positive Solari with at most two decimal places; use integer minor units in the authoritative service, never floating-point balance arithmetic.
3. Generate a unique immutable request ID for each **confirmed payment attempt**; retries reuse the same ID. Store a request fingerprint so reusing an ID with different sender, recipient, amount or description is rejected.
4. Atomic database transaction: lock/check source and destination, verify available funds, write both debit and credit and an immutable ledger entry, and persist the idempotency result **in the same transaction**. Any failure rolls back all changes.
5. Concurrency-safe deduplication must be enforced by the authoritative bank service/database, not only by DuneEss, the CP frontend or an in-memory map.
6. If the service times out or its response is ambiguous, display **pending/unknown**, not success or failure. Reconcile by the same request ID; never automatically create a replacement payment.
7. Only announce payment success to sender and recipient **after authoritative confirmation**. Ledger history must use the same reference on the Control Panel and in-game.
8. No fee is assumed unless configured by the authoritative bank policy; the UI must display any applicable fee before confirmation.

## Integration acceptance tests
- Java dialog and Bedrock full-page form: entry, review, confirmation, cancellation, permission denial and stale recipient.
- Offline/online player lookup, UUID identity, renamed player, unknown player and self-payment.
- Insufficient funds, zero/negative/excessive amounts, malformed descriptions, disconnected bank service.
- Duplicate request ID (same payload returns same outcome; different payload conflicts), simultaneous transfers, simultaneous withdrawals, and crash/retry around commit.
- Correct ledger balances and history across planets and CP, plus exclusion rules and stable ordering for all leaderboards.
- Company treasury support must be checked against the actual DB schema before enabling `/companytop`.

## Release gate
Do not publish to DuneGit or deploy to production until implementation, database migration review, backend atomicity/idempotency tests, Java/Bedrock UI tests and GitHub CI are verified.

# DuneRealms pre-launch economy reset — execution runbook

**Status:** Authorized by owner as pre-launch wipe; **not executed**. Never assume that a GitHub commit resets a live database.

## Target
Reset all fictional Dunemarks balances to zero, including online/offline player wallets, personal banks, Emperor/network treasury, five House treasuries, clan treasuries and any existing company accounts. Do not delete player UUIDs, account ownership, Houses, clans, identities or permissions. Migrate to new fictional IBAN identifiers only after verifying all account types and their existing numbers.

## Required execution gates
1. Announce maintenance; stop Velocity logins, all Paper backends, Exchange, Kit Exchange, shop fulfillment, server-control agent, background payments and website mutation endpoints. Confirm there are no active transactions or background writers.
2. Create **verified** full database backup plus separate schema and ledger archive, stored outside the database. Record backup hash, timestamp, schema version, and tested restore procedure. Never include secrets in Git.
3. Query `INFORMATION_SCHEMA.COLUMNS` to inventory actual balance-bearing tables and run `tools/economy-reset-plan.py` on a TSV export. Investigate unknown wallet/treasury columns, pending payouts, escrow, reservations, orders and inventory-linked currency.
4. Snapshot every pre-reset account and balance. Mark existing ledgers as pre-reset historical records; do not rewrite old ledger balances to zero. Define new epoch/statement opening balances and an audit event for each account.
5. Build/verify a **single** transactional, restart-safe migration against a restored staging copy. Explicitly include `dune_economy_balances`, `dune_player_banks`, `dune_staff_bank_wallet`, `dune_faction_bank_wallet`, `dune_clan_wallets` and any further real money-bearing tables discovered. Check for negative balances and outstanding escrow.
6. Issue new fictional IBAN-style account numbers with collision-free registry and MOD-97 checks, preserving UUID and institutional ownership. Reserve 979 for official accounts as requested; fictional identifiers are NOT real IBANs. Revoke old identifiers only after verifying every new mapping and payment reference.
7. Settle or cancel all pending exchange orders, kit deliveries, escrow, company share orders, outstanding taxes, dividends and refunds under explicit documented policy. Never allow a pre-reset job to recreate a balance after the reset.
8. Verify all balances zero, sum of balances zero, no duplicate IBANs, no orphaned bank mandates, no pending pre-reset monetary job, and unchanged House/clan identities. Test offline-player login and first purchase on staging.
9. Resume services in controlled order and monitor money creation, cross-server sync and statement reconciliation.

## Read-only inventory query
```sql
SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
ORDER BY TABLE_NAME,COLUMN_NAME;
```

**No generic `UPDATE ... SET balance=0` should run against production without all gates.** Historical ledger preservation is mandatory for audit. The reset does not affect real-money shop payment records, chargebacks or statutory bookkeeping.

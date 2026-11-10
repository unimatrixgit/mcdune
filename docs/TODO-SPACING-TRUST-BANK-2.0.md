# TODO — Spacing Trust Bank 2.0 and dependent DuneRealms economy

> Planning checklist, **not** evidence of implementation. Priority: bank first; corporations, insolvency takeovers and DRX later. Mark complete only after code, tests and staging verification. All money is fictional Dunemarks (DM).

## P0 — 1. Central API, data inventory and safe migration
- [ ] Inventory existing DuneBank, DuneCore wallets, DuneEss Exchange, Kit Exchange, DuneClans, faction and official treasuries, DuneHub and Central API.
- [ ] Define one Central API contract for Minecraft, DuneHub, control panel and mobile admin app.
- [ ] Central API authenticates identity and authorizes account access, mandates and approvals; bank engine independently enforces balances and ledger integrity.
- [ ] Link Minecraft UUID, website identity, staff permissions and existing role systems.
- [ ] Back up all player and institutional data; verify a restore on staging.
- [ ] Rehearse the explicitly approved **prelaunch economy reset** in staging: player wallets, savings, faction/Emperor/clan/company balances, pending escrow and obligations; preserve historical audit in archive.
- [ ] Execute production reset **only after** validated backups, maintenance mode, approval of exact SQL and reconciliation. **Not executed.**

## P0 — 2. Bank accounts and fictional IBANs
- [ ] Finish and test fictional IBAN MOD-97 implementation; account categories personal 101, savings 201, joint 301, clan 401, company 501, official 979. These are not real-world IBANs.
- [ ] Deploy account registry, sequence allocator and mandates schema after migration review.
- [ ] Migrate existing player/institution identity mappings without losing records.
- [ ] Open personal current accounts automatically for verified players; support savings and joint accounts.
- [ ] Build mandate invitations, co-owners, treasurers, viewers, expiry, daily limits and revocation through Central API.
- [ ] Establish official accounts for Emperor, Landsraad, five Houses, Spacing Guild and clan treasuries; account ownership belongs to institution, not current leader.
- [ ] Implement account freeze, reopen, close and archival lifecycle.

## P0 — 3. Payments and authoritative accounting
- [ ] Implement atomic balanced double-entry postings with immutable journal, source idempotency and cross-server locking.
- [ ] Implement bank-to-bank transfers and `/pay <player> <amount> <reference>` with account resolution.
- [ ] Implement saved beneficiaries and one-off payments.
- [ ] Integrate free references, structured Belgian-style OGM, receipts and searchable/exportable statements.
- [ ] Implement two-person approval for configurable high-value joint, corporate and institutional transfers.
- [ ] Integrate Exchange, Kit Exchange and NPC spice sales with authoritative payment/ledger records.
- [ ] Implement fictional 21% Imperial VAT on taxable commerce; exclude ordinary transfers, refunds and secondary share trades; settle to Imperial Treasury.
- [ ] Reconcile bank balances, wallets, escrow, and legacy ledgers without double-crediting.

## P1 — 4. Loans and debt collection
- [ ] Build funded personal and business loans, credit lines, applications, approvals, contracts and repayment schedules; **no mortgages**.
- [ ] Calculate fictional credit score based on repayment history; expose eligibility and reasons.
- [ ] Enforce reserves, available lending funds, exposure and loan accounting.
- [ ] Post due installments idempotently, with explicitly authorized loan-linked negative personal balance where applicable.
- [ ] After published grace period, apply **one-time 40% late fee to each unpaid overdue installment**, never compound/repeat; define conservative total fee cap.
- [ ] Apply in-game credit blacklist for unresolved arrears; remove automatically when overdue amounts are settled.
- [ ] On incoming funds to the borrower's designated **personal** account, atomically collect up to outstanding arrears and loan-linked overdraft; do not take from joint, clan, House or company accounts.
- [ ] Allow additional borrowing/refinancing to pay overdue installment and fee; debt must actually settle before blacklist clears.
- [ ] Limit companies to **two concurrent active loans**; government official treasuries may hold **unlimited concurrent loans**, but every loan requires funding and auditable authorization.
- [ ] Implement consolidation, restructuring, revised payment plans and loan-loss provisions.
- [ ] Test fee-once semantics, retries, races, arrears allocation, loan principal vs overdraft and recovery caps.

## P1 — 5. Bank reserves, oversight and reporting
- [ ] Maintain Spacing Trust balance sheet: loans, reserves, deposits, capital and liabilities.
- [ ] Daily automatic reconciliation of wallets, bank accounts, journals and loans; alert administrators on mismatches.
- [ ] Monthly close: statements, overdue status, fictional Imperial VAT, institution/company reports and published bank balance sheet.
- [ ] Monthly public redacted reports for Emperor, Landsraad, Houses, Spacing Guild, clans and companies.
- [ ] Implement in-game Spacing Guild Banking Authority for documented oversight and auditable decisions, not real-world banking regulation.

## P1 — 6. Corporations and institutional governance
- [ ] Implement Spacing Guild corporate registry, company applications and approval workflow.
- [ ] Register official DRMG, DRML, DRTV, DRBK and DRSG companies (initial names/tickers).
- [ ] Verify real-money shop **registration entitlement only**; no purchased fictional currency, investment returns or political influence.
- [ ] Auto-create corporate joint bank account with zero opening balance and CEO/co-owner/treasurer mandates.
- [ ] Support contracts, cross-House ownership and company/House/clan sponsorship with appropriate permissions.
- [ ] Keep Landsraad politics separate from Spacing Guild commercial registration; leadership changes rotate mandates without transferring treasury ownership.

## P2 — 7. Insolvency and rescue
- [ ] Calculate debt-service capacity and verified insolvency status for players, companies and institutions.
- [ ] Build grace, restructuring, insolvency case and recovery transitions with notices and audit.
- [ ] Allow voluntary personal debt arrangements; never auction player identity, essential inventory or real-world assets.
- [ ] Publish redacted corporate distress notices, creditor claims and time-limited rescue offers.
- [ ] Support funded creditor payoff, capital injection, voluntary share purchase, approved asset takeover, debt assumption and liquidation.
- [ ] Ensure existing-share purchases pay sellers, **not** automatically the company or its creditors; require separate debt settlement.
- [ ] Institutional rescue may grant commercial concessions but **never** buy Emperor title, House leadership, Landsraad votes or political office.

## P2 — 8. DRX stock exchange
- [ ] Implement authoritative share registry and issuance with dilution disclosures.
- [ ] Implement funded buy/sell orders, matching, settlement, holdings and immutable trade history.
- [ ] Calculate DRX20 index with up to twenty eligible companies.
- [ ] Compute DRSG spice-linked indicative value from verified spice sales; distinguish indicator from actual traded price.
- [ ] Display historical prices, financial reports, distress notices, trading suspension and approved takeover offers.
- [ ] Ensure no duplicate shares, invented DM or unauthorized ownership transfer.

## P0 — 9. User interfaces, tests and release
- [ ] DuneHub bank UI: accounts, IBANs, transfers, beneficiaries, mandates, loans, blacklist and statements.
- [ ] Minecraft Java native dialogs / Bedrock Geyser forms: bank access, balances and payments.
- [ ] Corporate dashboards and DRX pages after bank integration is stable.
- [ ] EN/NL localization.
- [ ] Automated unit/integration tests: Java, SQL, Central API, account rights, transfers, loans, concurrency, reversals and crash recovery.
- [ ] End-to-end staging tests: Minecraft ↔ Central API ↔ DuneBank ↔ DuneHub ↔ Exchange.
- [ ] Validate backup/restore, migrations, reconciled opening balances and safe production rollout.

## Explicitly excluded
- Bank cards.
- Separate fraud-monitoring product/dashboard (ordinary authorization, audit, idempotency and balance integrity still mandatory).
- Direct debits / domiciliëringen.
- User-created standing orders / recurring scheduled transfers (automatic loan repayment remains included).
- Customer-service/ticketing module.
- Mortgages or property-backed loans.

## Existing partial work — do not confuse with completion
- Fictional IBAN Java generator, tests, initial registry/mandates/double-entry SQL schema.
- Pure Java loan delinquency/late-fee/recovery calculations and tests; **not connected to a posting engine**.
- OGM helpers, some receipt integrations, DRX/company schema and reporting prototypes.
- Banking, insolvency and stock-market design documents.
- No verified end-to-end live bank, migration, economy reset, exchange settlement, loan engine or stock exchange deployment yet.

## Milestone order
1. Player logs in and receives unique fictional IBAN.
2. Player transfers DM via Central API; same balanced result in Minecraft and DuneHub.
3. Mandates, joint/institutional accounts, receipts, VAT and reconciliation work.
4. Funded loans, arrears, 40% fee, blacklist, automatic collection and refinancing work.
5. Bank reserves, monthly close and company bank accounts work.
6. Insolvency, rescue and DRX exchange launch only after bank foundation passes staging tests.

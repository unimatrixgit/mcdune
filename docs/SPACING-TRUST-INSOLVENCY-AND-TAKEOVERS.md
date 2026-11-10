# Spacing Trust — insolvency, rescue and DRX takeovers

**Status:** proposed fictional-game design, not deployed or connected to a live debt engine.

## Scope
Individuals, companies, clans and official institutional treasuries may become insolvent when overdue debt exceeds an explicit ability-to-repay threshold, not merely because a single balance is negative. Insolvency status is determined from verified liabilities, available funds, repayment schedule and documented grace periods. Keep a clear distinction between overdue, restructuring, insolvent, liquidation and recovered.

## Individuals
A player may negotiate refinancing, repay arrears, or enter a capped voluntary debt-restructuring plan. The in-game credit blacklist and late-fee policy apply only as separately documented. A player's identity, House, clan membership, inventory essentials, and real-world possessions are never auctioned or seized. No real-world collection, harassment or consequences.

## Companies
- An insolvent company can be put under a temporary administration lock, suspending new borrowing, new share issuance and selected high-risk outgoing payments while preserving incoming payments and audit access.
- Spacing Guild publishes a redacted notice with verified company financials, debt amount, deadlines and available rescue methods.
- Rescue options: creditor-approved payoff, investor capital injection in exchange for newly issued shares, voluntary sale of existing shares, approved acquisition of company assets or negotiated debt assumption, and liquidation of permitted company-owned in-game assets.
- New shares require dilution disclosure and shareholder authorization. A buyout of existing shares pays the shareholders, **not** the company's creditors; it does not resolve insolvency unless accompanied by a separately funded debt settlement.
- A takeover does not silently transfer founder identity, staff rights, real-money shop entitlements or unrelated personal assets.
- An acquisition requires explicit approvals, verified source of Dunemarks, conflict checks and one atomic, idempotent settlement with the authoritative bank ledger. Keep debt and shareholder ledgers reconciled.
- On liquidation, apply a published priority of claims and pay only from realized assets. No fabricated Dunemarks or automatic debt erasure without an auditable creditor-approved write-off.

## Houses, Landsraad, Emperor and Spacing Guild
Institutional insolvency triggers an audited restructuring or bailout supervised by the Landsraad and/or Spacing Guild under their respective authority. The official treasury persists through leadership changes. A player or company cannot buy the Emperor title, House identity, political votes, Landsraad seat, or office permissions by purchasing debts or shares. Government rescue agreements may grant time-limited commercial concessions or repayment contracts, not political ownership.

## DRX exchange behavior
Display company distress notices, suspended trading state, disclosed liabilities and historical filings. Voluntary rescue offers and company-share transactions are distinct workflows. Do not auto-set stock prices to zero or manufacture an executed trade. A restructuring may affect indicative valuation; traded prices require actual settled trades. Prevent self-dealing, wash trading, and preferential insider payouts.

## Bank and security requirements
Maintain a verified snapshot of liabilities, creditor claims, secured/reserved company assets, shareholders and pending settlements. Use maker-checker approvals, freeze reasons, notice periods, immutable audit and dispute mechanisms. No creditor can debit a joint, House, clan or unrelated corporate account based solely on an individual's default. Existing 40% one-time fictional late fee and blacklist must not compound or cause uncontrolled debt spirals.

## Implementation stages
1. Add insolvency case registry and read-only notices.
2. Build staging-only creditor claim and rescue-offer workflows.
3. Integrate approved atomic bank settlements and corporate share ownership transfers.
4. Test simultaneous bids, reversals, failed funding, ownership changes, ledger reconciliation and restore before production activation.

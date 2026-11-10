# DuneRealms Stock Exchange (DRX) — implementation contract

Fictional game-only exchange, inspired by the structure of Belgium's BEL 20, not its brand, constituents, licensed market data or real-world price feed. No real-money conversion, leverage, loans, short selling or cash-out.

## Seed issuers (names are placeholders until verified)
- DRMG: DuneRealms Mother Group (holding company)
- DRML: DuneRealms Mail (mail services)
- DRTV: DuneRealms Travel (planetary transport)
- DRBK: Spacing Trust Bank (banking services)

Official issuers are created only by staff holding the explicit `market.issuer.create` permission. A registered issuer has a stable UUID, ticker, business type, verified operator, active/suspended status and share supply. Issuers must never be created by simply inserting a listing from the public website. Player-run companies may be added later as a separate, explicitly approved category.

## Dune 20 index
`DRX20` is a *DuneRealms* index with up to 20 eligible listed fictional companies. With four initial companies it is a four-constituent provisional index, not a claim of twenty listed firms. Use a free-float market-cap-weighted index with a persisted divisor; cap constituent weights at 20% through a documented quarterly rebalance. Rebalance does not issue shares or transfer money.

## Trading and money conservation
The authoritative money source is the existing network wallet/bank transaction layer. Orders must be matched and settled in a single database transaction with row locks, durable request idempotency, buyer debit, seller credit, share transfer, tax/fee allocation and paired ledgers. Every order, fill and cancellation has a stable UUID; never reuse a human-readable OGM as an idempotency key. The share registry must enforce that total allocated shares never exceed issued shares. No matching or settlement should be enabled until the live balance schema, identity mapping and DB isolation are verified. Do not use a separate mutable balance ledger.

Trading is **secondary-market** only by default: selling shares pays the seller from the buyer's existing Dunemarks. Initial issuance must transfer shares to a verified treasury and sell them at an approved price, crediting that treasury; never credit newly invented Dunemarks. Dividends, if later added, must debit a real issuer treasury and credit owners atomically.

## Price model
Use actual executed trade prices as the market price, bounded by circuit breakers (e.g. 10% per session) and minimum tick size 0.01 DM. Network money supply, net Exchange volume, company service revenue, and treasury health are *published indicators* that may adjust a displayed indicative fair-value signal (not a forced execution price). No price should be fabricated when there are no trades. Manipulation checks must reject self-trades and related-account wash trading. Suspend a market on anomalous data.

## Integration
- DuneHub: DRX20 chart, issuer profiles, prospectus, order book, portfolio, executed trades, audit.
- Exchange: a separate `Shares` section, using the same identity, permissions and authoritative Dunemarks payment rails as the item Exchange. Item listings and shares are distinct assets.
- Kit Exchange: company kits sold by approved issuers can contribute **actual recorded net revenue** to that issuer's revenue indicators; do not invent revenue from total listing values.
- Banking: share settlement must show a validated structured communication on both sides; use an issuer/settlement-specific OGM namespace with a collision-checked registry. Preserve existing bank balances and history.
- EN/NL only, with player-visible disclosure that all stocks and currency are fictional.

## Release gates
1. Read-only issuer registry and market data.
2. Staging trades with conservation, concurrent-buy, replay, crash recovery and ledger reconciliation tests.
3. Owner-approved production rollout and controlled seed offering.
4. Monitoring, anti-manipulation and rollback procedure.

Never deploy an untested trading engine or automatically migrate real player balances.

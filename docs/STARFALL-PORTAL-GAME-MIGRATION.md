# DUNE-010: portal/game separation proposal — SF-041

Read-only review of https://github.com/unimatrixgit/starfall at `4ca0737b9293701e72697653226d899b9a756e6a`, 2026-10-14. Linked to colleague-owned collaboration G-009. No Starfall code, branches, access settings, database or deployments changed. Later fixes, including the colleague's announced SF-044, are outside this snapshot.

## Actual dependencies

- The current repository mixes authored and generated files under `dist/`. Do not discard it as disposable output before extracting its authored JS, CSS, HTML, assets and data. Root deployment archives are build products rather than application source.
- `scripts/build-portal.cjs` reads `dist/ship-catalog.js`, evaluates the prefix of `dist/game.js` before its click-handler marker in a VM, and extracts BUILDINGS, TECH_TREE, SCAN_TYPES, STRUCTURE_DEFS, SHIPS and PLANET_TYPES. It separately evaluates `worker/planet-types.js` for the complete planet catalogue. This is a direct build dependency on game source and a brittle string marker.
- The same portal generator calls `freshState()` and `normalizeFleet()`, rewrites seed coordinates and member ranks/planet links, and writes `worker/default-round.json`. Therefore a portal/manual build currently changes the game server's seed input. Separate this responsibility before assigning independent ownership.
- `scripts/build-planet-catalog.cjs` reads `data/planet-reference-names.json` and `data/original-worlds.json`, writes `worker/planet-types.js`, rewrites the initial catalogue/helper portion of `dist/game.js`, writes `dist/planet-catalog.json`, and invokes `planet-art.cjs`. Catalogue generation currently edits both browser and server sources.
- `scripts/build-game-runtime.cjs` concatenates an explicit ordered list of files in `dist/` into `game-runtime.js`. It strips the bootstrap from `game.js` and appends one bootstrap and a ready flag. Its list includes shared-facing modules such as portal, forums, tickets, communications and site management; these filenames are not evidence of a clean portal/game split.
- `scripts/build-portal-runtime.cjs` reads script tags from a fixed page list, concatenates their JS into content-hashed portal runtimes, rewrites the pages and inserts the page loader. It operates on already generated pages. Repeated processing without restoring pristine HTML risks consuming previously rewritten runtime references; make clean-input builds a contract.
- `scripts/build-worker.cjs` invokes both runtime bundlers and diagnostics, recursively embeds `dist/` assets except server/.openai, and concatenates server modules into `dist/server/index.js`. Its concatenation order supplies shared globals including PLANET_TYPES, DEFAULT_ROUND, ASSETS, portal helpers, gameplay handlers, cache and the final fetch entrypoint. It does not itself invoke `build-portal.cjs` or `build-planet-catalog.cjs`; the README's build command depends on existing inputs.
- The same build copies `.openai/hosting.json` and `drizzle/` into deployment output. `scripts/build-diagnostics.cjs` executes part of `audit-links.cjs` in a VM and writes a diagnostic manifest. Both rely on the combined output layout.
- `worker/index.js` routes portal APIs, game APIs, Miday scans, forums, tickets and staff tools, then serves embedded assets. `/game`, `/game/` and `/index.html` are game aliases; root serves the portal. Preserve these aliases and guards during the move.
- `worker/portal.js` resolves the `starfall_session` cookie and database-backed sessions; account registration/profile logic is in `worker/accounts.js`. Gameplay uses `portalUser()` too. Authentication is a platform dependency, not an independently replaceable portal widget. The README still contains earlier identity descriptions, so treat current code as the source of truth.
- `tests/game.test.cjs`, `miday.test.cjs`, `planets.test.cjs`, `forums.test.cjs` and `cache.test.cjs` cover different domains. Some harnesses read browser files or assemble Worker source directly: update their path/assembly contracts together with the move. `scripts/preview.cjs` loads the built Worker and an in-memory SQLite/D1 adapter; retain one integrated preview.

## Recommended ownership layout

Start with one GitHub repository, clear source directories and CODEOWNERS/review boundaries. Separate source ownership does not require separate deployments or databases. If the user specifically requires distinct repositories, extract only after these interfaces and a clean build are stable; pin shared releases and compose portal/game versions in one integration release.

| Proposed location | Owner and responsibility |
| --- | --- |
| `apps/portal/` | Public pages, manuals, news, account-facing views and portal styling. Manual content consumes versioned shared catalogue data. Staff UI can live here but does not own staff authorisation. |
| `apps/game/` | Game shell, gameplay UI, browser simulation/save migration and game-only visuals. Preserve the `starfall-round-v2` save key and existing stable identifiers. |
| `packages/catalog/` | Canonical ships, structures, research, scans, planet definitions, names and display metadata. Export browser/server/manual views from the same inputs. No copy-pasted independent constants. |
| `packages/game-core/` | Pure defaults/fleet normalisation and other genuinely shared game logic. The game team owns seed generation, not the portal generator. |
| `packages/contracts/` | API schemas, error shapes, version/capability declarations and immutable IDs. No session tokens or deployment credentials. |
| `server/platform/` | Auth/session/account services, shared policy helpers, cache, diagnostics, route composition and deployment integration. Cross-domain review for changes. |
| `server/portal/`, `server/game/` | Domain handlers under the same composed Worker. Forums/tickets/site-management belong to portal-facing services; gameplay handlers to game. Miday/intel need explicit game-policy ownership even if linked from portal. |
| `database/migrations/` | One ordered schema migration history, reviewed by platform plus affected domain. Moving files must not replay or renumber deployed migrations. |
| `tools/build/`, `tests/integration/`, `public/shared/` | Build graph, combined preview/integration tests and deliberately shared static assets. Domain-specific artwork stays with its owner. |

These are proposed boundaries, not existing directories. Do not copy whole source modules based only on names: inspect their global references and API use first. Shared navigation/theme components need a named owner so portal edits do not rewrite game pages by broad directory loops.

## Migration sequence and build contract

1. Inventory every tracked `dist/` file as authored input, generated output or retained binary artwork. Preserve source history and record an input/output manifest. Protect existing saves and deployments; no reset is part of this work.
2. Extract metadata/default construction into importable pure modules. Replace portal VM execution and string slicing with explicit exports. Generate `default-round.json` in a game-seed step; validate it against the catalogue. Preserve current seed content first; change gameplay only in separate tickets.
3. Move authored inputs into the ownership layout; update relative paths, test fixtures and asset URLs. Make generators write only into a fresh staging directory. Catalogue generation must never rewrite authored game source.
4. Use an explicit DAG: canonical catalogue → browser/server/manual catalogue outputs; game-core → seed; portal source + catalogue → portal pages; game source + catalogue → game assets; pristine pages/assets → ordered runtimes; combined assets → link/diagnostic manifest; server modules + seed + assets → final Worker + hosting manifest + migrations.
5. Preserve the current single Worker, public origin, session cookie, origin checks and D1 binding during this structural migration. Switch source organisation first. A later multi-Worker deployment needs explicit service/auth routing and migration ownership; it must not duplicate session databases or rely on broad cross-origin cookies.
6. Establish one root build entrypoint that starts from checked-in inputs and works on a clean checkout. Initially keep the runtime concatenation order through explicit manifests; later convert to modules as a separate change. Verify bootstrap runs once and that content-hash/loader references resolve. Do not run a portal bundler over already rewritten HTML.
7. If separate repositories are still required, choose explicit immutable package/artifact versions for catalog/contracts and retain one deployment-composition owner. Portal and game pipelines publish artifacts; integration pins versions, checks contracts, embeds assets and deploys. Avoid each repository carrying its own editable catalogue/default state or migration copy.

## Acceptance and verification contracts

- Clean checkout build creates the full release without prebuilt Worker, previously generated pages or local archives. A second clean build has identical semantic assets; isolate expected timestamp changes in diagnostics. Source trees remain unchanged after building.
- Before/after catalogue and seed equality: stable IDs, ship/game statistics, planet types, initial fleets, coordinates, alliance member links and save migration remain intact. Validate server/browser/manual views against canonical inputs.
- Run all existing five test suites after updating their assembly/path contract. Add focused regression checks for portal metadata imports, seed generation ownership and combined Worker composition. This review did not run or claim those runtime tests.
- Integration smoke matrix: root portal, manual, register/login/logout/profile, `/game` aliases and unauthenticated redirects, staff-only views, forums/tickets, game APIs, Miday sharing/privacy, caching and same-origin mutation rejection. Assert authorised session works across portal/game and private content is never cached publicly.
- Audit generated runtime/loader references, image/style URLs, all internal links, hosting manifest, D1 migration copy and Worker size. Test representative pages with keyboard and mobile viewport after the migration.
- CI per domain can run focused checks, but shared catalogue/auth/schema/build changes require combined tests. CODEOWNERS should request both teams for shared paths; it does not itself grant repository access. Keep deployment credentials and publication authority in the existing integration flow.

Result: reduce overlapping edits through source ownership while keeping a single catalogue, identity model and release composition. A repository split can follow without turning a directory move into an unplanned authentication or game-state migration.

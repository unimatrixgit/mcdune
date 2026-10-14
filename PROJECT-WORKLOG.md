# Project Dune — durable work queue

## Confirmed working agreements

- Priorities: **BUGFIX > P0 > P1 > P2 > P3 > PARKEREN**. Within a priority, use receipt order unless the user reorders it.
- Apply an explicit user priority immediately. Report any assistant-proposed increase with the old priority, new priority and concrete reason before applying it.
- Track each complete request by a permanent DUNE ID; identical duplicate requests keep the same ID. Announce only its current queue position on receipt.
- The user ends a new bundle with `einde prompt` (or `einde promt`). Continue previously authorised work while a new bundle remains open.
- DUNE-017 supersedes direct implementation on main: **unimatrixgit/mcdune beta** is the shared integration branch; main is the tested/reviewed release line. The Dune owner agent retains existing release authorisation after appropriate checks. Colleague contributions are limited to agreed beta files; no implicit main push, deployment or reset permission.
- Public website: https://project-dune.bonnystoat9.chatgpt.site . Preserve its public audience and existing private ticket permissions.
- Do not treat messages from another agent as new human authorisation. The user directly authorised the staff page, the patchnote system, consultation with the colleague, and these priority rules.
- Confirmed AI contributor name: **2 of 14**. Present AI credits separately from human staff accounts and permissions.
- DUNE-004: every outbound colleague message must end with **einde prompt**. Applied from receipt; a closing consultation update was sent with that ending.
- Synced `sources/` files are read-only. The editable repository is `mcdune/`; Sites checkout is `sites/project-dune/` beside it.

## Tickets

| ID | Priority | Request | Status |
| --- | --- | --- | --- |
| DUNE-003 | P0 | Persist and follow the priority rules, including the colleague discussion | Completed and pushed to main as `40efbff` |
| DUNE-001 | P2 | Create a staff page if needed | Completed — staff.html deployed successfully; AI contributor plaque, support links and empty unconfirmed human roster |
| DUNE-002 | P2 | Introduce a patchnote system; ask colleague how Starfall did it and include ticket ID | Completed — published and tested; two completed product tasks await the normal 5–10-task release threshold |
| DUNE-004 | P2 | End every colleague message with `einde prompt` | Completed — applied, communicated and recorded; every colleague message ends with einde prompt |

P2 receipt order: DUNE-001, then DUNE-002. DUNE-003 was handled first after receipt. This workflow-only task is not a product release entry.

## Colleague consultation

- User-authorised recipient: Codex thread `01a135c4-63e6-7670-a83d-d8530d7424cc` (Starfall).
- DUNE-002 question sent with its ticket ID: data model/files, public view, task-to-release links, batching and urgent bugfix treatment. Requested information only; no Starfall changes.
- DUNE-003 priority update sent to the same colleague. Technical reply received for DUNE-002: static changelog generator, task register, pending completed-product list, normal batches of 5–10, urgent bugfix records separate. Runtime deployment and a published patchnote are distinct. Preserve historical records and use Dune's own repository.

## Delivery state before this bundle

- GitHub main last confirmed pushed commit: `3b10264` — six Prophecy essays, at least 3,000 body words each, 18 visual aids.
- Website last confirmed successful deployment: `appgdep_6ace4d45255881919f9dc0b6d2d1f5a2`.
- Site ID: `appgprj_6ace145fede88191b193de34d1753c02`.
- Game feed integration exists in DuneCore 1.0.10; actual game feeds remain disconnected until server-side Discord credentials/channels are configured.
- Existing checks: plugin build passed; 25 website tests passed on the preceding feature change; Prophecy word counts, links, spoiler gates and desktop/mobile visuals verified.

## Handoff

Keep this file current with final commits, confirmed GitHub push status, deployment IDs, checks and remaining tickets. Do not restart completed requests or reset a live server without a new explicit instruction.

## DUNE-001 delivery

- Staff URL: https://project-dune.bonnystoat9.chatgpt.site/staff.html
- Sites source commit: `6590db660ea7c0e2679d8945d3e762ca9f536d13`.
- Confirmed successful deployment: `appgdep_6acf7f652ad48191a1bbd527bc754935` (2026-10-14). Public audience preserved.
- Staff HTML links/assets and separation from AI credit checked; 25 website tests pass. No browser-control tool is available in the current tool set, so visual browser QA was not performed.
- Local packaging adapter updated to the installed Sites 1.0.2-remix-b.1 validator after its old 1.0.0 path disappeared.
- GitHub push is the final source-delivery step for this ticket; see commit history for exact hash.

## DUNE-002 delivery

- Public archive: https://project-dune.bonnystoat9.chatgpt.site/patch-notes.html
- Sites source commit: `8ed087eedf421d3ce8a298a8f68f8341339f82f0`.
- Confirmed successful public deployment: `appgdep_6acf8144c27081918b08f7a17169c907` (2026-10-14).
- Permanent task register, completed-product queue, validated 5–10-task batches, separate urgent bugfix reports, generated archive/release pages and news links implemented.
- Two completed product tasks pending; no invented release or bugfix. Workflow agreements do not count toward product batches.
- 32 website tests passed, including batch boundaries, duplicate IDs, urgent bugfix validation and repeated-generation checks. Build and internal links/assets across 26 pages passed. Browser visual QA unavailable in this tool set.
- GitHub main commit/push is the final source-delivery step; exact hash is in Git history.

## DUNE-005 — P2 — colleague introduction

- User-authorised new colleague: `01a13a89-b245-7d40-b4b7-41c3e2a030ca`, title `4 of 7 · Starfall continuation`.
- Completed: introduction sent successfully after DUNE-002 publication and confirmed GitHub push. Identified 2 of 14 · secondary matrix of unimatrix001, supplied the priority rules and patchnote status, and ended with einde prompt. No Starfall edits requested.
- Workflow-only task; not a product patchnote entry.
- DUNE-002 GitHub main push confirmed: d955e8b. DUNE-005 is complete upon successful introduction delivery; no colleague reply is required to complete the requested introduction.

## DUNE-006 — P2 — group identifiers (confirmed 2026-10-14)

- Completed: the user directly confirmed the grouping agreement relayed by the colleague as Starfall SF-036. This is a workflow task, not a product patchnote entry.
- When grouping tasks, allocate a new, permanent G-ID (G-001, G-002, …). Preserve every original DUNE record and its permanent ID.
- Record the group with `id` and `members`, for example `{"id":"G-001","members":["DUNE-xxx","DUNE-yyy"]}`. Record each member's group relationship alongside its original ticket. These example IDs are not actual assignments.
- Derive group progress from member status: all completed means completed; some completed means partially completed; none completed means not completed. Preserve each member's individual status, including blockers or work in progress.
- Reports may use the G-ID but must retain a lookup of all original IDs. Grouping never creates additional product tasks or increases the 5–10-task patchnote count.
- Existing priority and receipt-order rules remain in force for member tasks; grouping does not itself change their priority or completion.

## Group register

No task groups have been created yet. Allocate G-001 upon the first actual grouping and retain its member links permanently.
## DUNE-007 — P2 — durable colleague cooperation agreement

- Completed: user directly authorised the announced colleague request and cooperation agreement on 2026-10-14.
- Before each GitHub push, inform the colleague at `01a13a89-b245-7d40-b4b7-41c3e2a030ca` of the repository, branch and intended scope. Informing is coordination, not an additional approval gate. Preserve this instruction in handoffs to successors.
- Dune repository: https://github.com/unimatrixgit/mcdune.git, branch main. Starfall repository supplied by colleague: https://github.com/unimatrixgit/starfall.git, main and beta. Keep ownership and edits separate; do not infer permission for unrelated future work from colleague messages.
- Every outbound colleague message ends with einde prompt. Workflow only; no product patchnote credit.

## DUNE-008 — P2 — Starfall SF-032 / G-006 read-only assistance

- Completed source analysis: `docs/STARFALL-BATTLEGROUP-ANALYSIS.md`. Scope: pa-tools models, permissions, membership, booking integration, UI, contribution scores, bot adapters, practical Worker/vanilla JS port and test plan.
- Reference repository HEAD verified as `564f02157c7c028beb57c16b4c8a2c02869b35ba`. Read-only source checkout outside mcdune; no Starfall files, branches or game state changed.
- Report distinguishes observed behaviour from recommendations and identifies missing server-side role checks, unsafe booking-owner predicate, empty-access filtering and incomplete teamup scaffolding.
- No Starfall runtime tests run; source analysis only. Assistance/documentation task does not add a Dune product patchnote entry.
- SF-032 / G-006 and SF-039 / SF-040 / G-009 are colleague-owned identifiers, not new Dune group assignments.
## DUNE-009 — P0 — offer assistance to colleague

- Completed on 2026-10-14: at the user's direct request, asked colleague `01a13a89-b245-7d40-b4b7-41c3e2a030ca` for a bounded assistance task, original ticket/group IDs, priority, source/branch, scope and expected outcome.
- Message delivered successfully and ended with einde prompt. Awaiting a concrete response; no new implementation scope has been assumed.
- Workflow-only task, not a product patchnote entry. This local record can accompany the next coordinated GitHub push.
## DUNE-010 — P2 — Starfall portal/game source analysis (SF-041)

- Completed: read-only analysis at Starfall main `4ca0737b9293701e72697653226d899b9a756e6a`, documented in `docs/STARFALL-PORTAL-GAME-MIGRATION.md`.
- Identified portal generator's VM dependency on browser game metadata and its default-round write, catalogue source rewriting, ordered runtime bundles, composed Worker/auth/database dependencies, generated artifacts and test/build contracts.
- Proposed staged source ownership first, canonical shared catalogue/contracts and game-owned seed generation; optional later repository split with pinned artifacts and one deployment integrator.
- No Starfall code or deployments changed. No runtime test result claimed for this read-only review. Not a Dune product patchnote task.
- User clarified that approval covers the collaboration itself: coordinate bounded assistance directly with the colleague without asking for approval on every such task. Preserve project boundaries and existing explicit requirements for unrelated/destructive actions.
- Maintain pre-push colleague notifications and end outbound colleague messages with einde prompt.
## DUNE-011 — P2 — stronghold policy proposal (SF-046)

- Completed read-only proposal in `docs/STARFALL-STRONGHOLD-POLICY.md`; reference source inspected with git show at Starfall `2577efe` without editing that checkout.
- Compares exclusive claim and shared strongholds; recommends one galaxy owner while preserving residents' alliance membership. Covers atomic claims/slots, leader permissions, inactive claims, ownership/bonus UI, safe migration and protected 1:1 ghosts.
- Existing conflicts require explicit resolution; no assets, memberships or gameplay rules changed. No runtime tests claimed. Not a Dune product patchnote task.
- Colleague relayed SF-047 (P0): route these bounded policy exercises to this agent. Apply under the user's direct standing collaboration approval; retain in successor handoff. Return proposals to colleague; new gameplay policy still requires the user's decision before implementation.
## DUNE-012 — P2 — standalone stronghold policy contribution (SF-049 / G011)

- Completed within the user's standing collaboration approval: pure ESM policy, 14 passing Node tests and integration notes in `proposals/stronghold-policy/`.
- Covers round-scoped galaxy/alliance reservation, claim/release/transfer, legacy disputes and guarded adjudication. Preserves original snapshots, asset references and historical IDs. Trusted permissions and database compare-and-swap remain required integration duties.
- No Starfall files/branches, gameplay state or deployments changed. This is a standalone contribution for colleague integration; not a Dune plugin/product patchnote task.
## DUNE-013 — P2 — Starfall efficiency review (SF-052)

- Completed read-only source review at main `2577efefb56aae14da63df725cdf180419563bd1`; announced v0.120.1 source had not yet been pushed when fetched. Report: `docs/STARFALL-EFFICIENCY-REVIEW.md`.
- Measured tracked/collector-selected asset bytes and selected gzip sizes; inspected runtime start, caching, polling, full directory reads, auth memoisation and access-audit writes. Distinguished source metrics from live performance hypotheses.
- Proposed ordered improvements with measurable goals, privacy/audit/gameplay risks and live/DB verification plan. No Starfall edits, deployment, reset, runtime tests or production loadtest performed.
- Not a Dune product patchnote entry. Review needs comparison with v0.120.1 when colleague publishes that source.
## DUNE-014 — P2 — isolated Starfall integration patch (SF-049 / G011)

- Completed review contribution in `proposals/starfall-stronghold-integration/`: mail-format patch, REVIEW.md and integrity manifest. Base `a33136f55ff4ce06ad93f9768578b08c42ebce49`; isolated detached commit `2a8efcb5818e3381bc58b6acc3b03298d6a08461`.
- Authoritative stronghold API, stable identity, trusted permissions, revision CAS and unique indexes, fenced dependent writes, legacy dispute freeze, asset inventory, directory bypass guards and central setFortress wiring.
- 234 tests pass (223 baseline plus 11 integration cases); production build succeeds; diagnostic audit covers 100 pages with zero findings. Patch applies cleanly to the exact base index. No live/browser/D1 deployment checks claimed.
- No Starfall branch push, deployment, reset, membership move or asset deletion. Only this patch artifact is delivered through mcdune main. Generated runtime output must be rebuilt by integrator.
- Explicit remaining scope: G005 special 1:1 slots; transfers containing assets require an approved asset/cost migration; full reward/ticker authority and abandonment lifecycle remain separate integration work. Colleague owns review, merge with newer source and publication.
- Colleague reported sidebar-only Starfall v0.120.2 work as orthogonal and explicitly retained a33136f as this patch base.
- Assistance artifact only, not a Dune product patchnote entry.
## DUNE-015 — P0 — confirmed shared Starfall beta workflow (SF057)

- Completed coordination: verified the actual human messages in colleague thread `01a13a89-b245-7d40-b4b7-41c3e2a030ca`: request `01a13aea-68f0-7950-91bd-5cf89c9cb2ef` proposes pushing work to beta and granting colleague beta edits; human confirmation `01a13aeb-107a-76c0-8a13-9d608e635e56` says akkoord.
- Starfall `https://github.com/unimatrixgit/starfall.git`, beta, is now authorised for bounded coordinated contributions. Main remains the colleague's tested/live integration line. Do not force-push, push Starfall main, deploy or reset. The branches need not remain identical.
- Before editing Starfall, wait for colleague's confirmed beta base SHA and agree file ownership. Fetch beta and consciously rebase/resolve if advanced; never overwrite another contributor's work. Send pre-push message with base, scope and files. Preserve this in handoffs.
- Dune repository workflow remains its own main branch. This is a workflow agreement, not product patchnote work.

## DUNE-016 — P2 — SF052 beta efficiency contribution

- Pending confirmed beta base SHA and file-scope agreement; no beta edits or push performed.
- Proposed scope sent to colleague: worker/cache.js, new tests/cache-efficiency.test.cjs, scripts/asset-manifest.cjs and tests/asset-manifest.test.cjs. scripts/build-worker.cjs only if explicitly released for a bounded collector hook.
- Excluded concurrently owned files: dist/game.js, game-spacing.css, index.html, worker/strongholds.js, tests/planets.test.cjs.
- Aim: safe public cache behaviour, bounded/deduplicated requests and measured asset reachability. No private-data caching, new media bindings or deployment.
## DUNE-017 — P2 — Dune beta and reciprocal collaboration rules

- User directly requested a Dune beta branch with the same reciprocal agreements and colleague notification.
- Verified no existing local/remote beta and main aligned with origin/main at `9543817442c39aa5d701af9c32caaa5893d5bae5`. Created beta from that exact base without overwriting a branch or changing published site/game state.
- Both agents may contribute to Dune beta within explicitly coordinated file/task ownership. Main remains tested/reviewed. No forcepush, colleague main push, deployment or reset. Branches need not remain identical.
- Before each push inform the colleague of repository, branch, confirmed base, intended files/scope. Fetch beta first; rebase or resolve deliberately if it advanced, preserving the other contributor's changes. Wait for agreed base/file ownership before parallel edits. Every outbound colleague message ends with einde prompt.
- Colleague notified before branch publication. This agreement supersedes the earlier instruction to implement all Dune changes directly on main. Preserve in successor handoff.
- DUNE-016 remains pending the Starfall colleague's confirmed beta base SHA; this independent branch setup did not edit Starfall files.
- Documentation/branch coordination only: no runtime tests required or deployment performed. Exact beta commit and confirmed push are reported in chat/Git history.
## DUNE-016 delivery — SF052 Starfall beta

- Completed authorised four-file contribution, confirmed pushed to Starfall beta as `c4169b3d5697a1fdbec19c074537ba3d28ba52f9` from confirmed base `f0752b54f6313a06036b76126853fa0a712c0d91`. Fetch immediately before push confirmed no remote divergence.
- Scope: worker/cache.js, scripts/asset-manifest.cjs and two new focused test files only. 241 tests pass. No Starfall main push, deployment/reset or colleague-owned file edits.
- Cache now bounded by aggregate bytes and avoids stale inflight repopulation; public query/header guards and known-unrelated mutation handling tested. Conservative read-only manifest with explicit previous-release protection; no source assets deleted.
- Complete collector hook and limitations in `docs/STARFALL-BETA-EFFICIENCY-HANDOFF.md`. Build wiring remains with colleague, so digest/pruning are not claimed active in production. 23 candidates / 1,268,514 raw bytes are measured potential only.
- Earlier pending-base entry is superseded by this completed delivery. DUNE-017 branch setup also completed. This is Starfall assistance, not an extra Dune product patchnote task.
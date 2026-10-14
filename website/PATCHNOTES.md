# Development patchnote system — DUNE-002

This follows the colleague's source-file-and-generator pattern, adapted to Project Dune. It does not share Starfall's source, deployment or task IDs.

## Source of truth

- `scripts/task-register.json`: permanent DUNE request IDs, receipt order, priority, product/workflow kind, completion status and optional release assignment.
- `scripts/pending-patchnotes.json`: completed normal product tasks waiting for a bundle. One requested feature is one product task; implementation details are not extra tasks. Workflow agreements do not count.
- `scripts/changelog.json`: published release records, newest first. A normal record embeds the 5–10 product records included in that release. An urgent bugfix record additionally contains the problem, repair and verification.
- `scripts/patchnote-policy.mjs`: validation and transformations. Normal bundles contain 5–10 genuine completed products; urgent fixes bypass that minimum. Duplicate task references, version collisions and mixing workflow/unfinished tasks into releases are rejected.
- `scripts/build-patchnotes.mjs`: generates `web/patch-notes.html`, individual release pages, public footer links and a development-news link from the game-news page. All public views use the same source records.

The initial archive is intentionally empty. DUNE-001 and DUNE-002 are completed pending product tasks (2/5). DUNE-003 and DUNE-004 are workflow agreements and do not contribute to the release threshold. Earlier work is preserved in Git history and the contributor record; no retroactive releases or invented tickets are created.

## Operation

Validate with `node scripts/manage-patchnotes.mjs validate`. The regular build validates data and generates the public pages automatically.

After 5–10 product tasks have been completed, run `node scripts/manage-patchnotes.mjs publish` and pass a JSON document through stdin with `version`, `date` (YYYY-MM-DD), `title`, `synopsis`, and `taskIds` (the pending product IDs). It moves only those products out of pending, preserves their DUNE IDs and assigns their release in the task register. A queue larger than ten is split into later bundles; one release can never contain eleven tasks.

For a real urgent fix, first register the complete request as a completed product with priority BUGFIX. Run `node scripts/manage-patchnotes.mjs bugfix` with stdin JSON containing `version`, `date`, `title`, `synopsis`, `problem`, `fix`, `checks`, and `tasks` (each with `id`, `title`, `promptIds`, `priority: BUGFIX`, and `changes`). This creates a separate urgent entry immediately; it is never held in the normal queue. The generator also places the newest urgent bugfix cards on Home and News, linking the full problem/repair/check report. No sample bugfix is published by this implementation.

Then build/test and publish the exact source/archive through the existing Sites workflow, preserving its public audience. Finish by pushing the same feature changes to the authorised `unimatrixgit/mcdune` main branch. Record the source commit, deployment ID, GitHub commit/push result and completed request IDs in `PROJECT-WORKLOG.md`.

## Distinctions

Publishing a feature and publishing a normal patchnote are separate actions. A feature can already be live while its bundle is waiting for five completed tasks. Website build/deployment IDs are not fabricated patchnote versions. Game notifications remain on News; development updates live in Patch Notes.

The colleague was asked with DUNE-002 explicitly attached and supplied the technical pattern. Outbound colleague messages end with `einde prompt` (DUNE-004). Priorities remain BUGFIX > P0 > P1 > P2 > P3 > PARKEREN, receipt order within the same priority.

# Alphastyle V2 — mandatory page-building directive

Status: design preview, not production authorization. Apply to every new CP V2 page and review before merging.

## Canonical site chrome — required on EVERY V2 page
- Use the actual public DuneRealms masthead (centered season logo, illustrated navigation, Alpha version badge, landscape background and memorial panel) and public footer (dunerealms.com wordmark, Manual/wiki, Support, Account, Disclaimer & contact, DuneGit, Developer API, Hetzner badge, fan-project notice, and Parents & Guardians panel).
- The approved visual reference is the user-provided header/footer screenshots from 12 Nov 2026. Do not substitute a generic dashboard header or a minimal legal footer.
- Shared chrome must be a reusable component, not copied by hand to each route. Match public-site updates after checking the actual deployed design; preserve mobile navigation and keyboard access.
- Never invent personal details, affiliations or live status; any memorial content should use the actual canonical site component or confirmed content.

## Alphastyle page structure
1. Canonical shared header.
2. Six V2 workspace shortcuts (My Realm, Imperial Bureau, DuneForge, Imperial Post, Imperial Postbank, CHOAM Exchange), illustrated with existing assets.
3. Contextual category sidebar(s), each with artwork and explicit category headings. Preserve all destinations in the independent V2 menu registry.
4. Page-specific illustrated hero/banner: eyebrow, title, concise purpose and state.
5. Distinct emerald-and-gold framed cards: status summary, primary content, secondary actions. Tables/forms must be clean and readable, with clearly labeled controls, focus indicators and accessible contrast.
6. Canonical shared footer.

## Artwork and icons
- Reuse real V1 assets when possible (especially `nav-*.webp`, `seals/*`, and existing banking artwork). Verify exact asset URL returns HTTP 200 before using.
- For a new icon, generate a separate original square asset (prefer transparent background) matching existing V1 icon dimensions, palette, ornamental treatment, consistent lighting and framing. No embedded text in icons. Do not copy proprietary imagery. Save with a descriptive `alpha-<feature>-v1.webp` name and provide accessible text in markup.
- Prefer artwork only in portal buttons, section banners and key actions; avoid ornament inside data tables and dense forms.
- Do not depict generated mock data as real user records or backend status.

## Routing, permissions and safety
- `menu.v2.json` is the V2 navigation source of truth; do not import V1 navigation as a runtime dependency.
- Every destination requires `web.cp.v2.<page>.view` and `web.cp.v2.<page>.manage` definitions. Default deny; backend must enforce them before functional rollout.
- Reuse proven V1 components/APIs only after design approval, with no changes to production V1 during design.
- All previews are static with no authentication, API writes or database access.

## Release gate
- Publish an immutable commit-pinned preview URL on each CP-related PR.
- Visually inspect desktop/mobile screenshots against approved reference: header, footer, six portals, all category/menu art, banners, buttons, spacing, scroll, and overlap.
- Verify all routes and permission definitions, run tests, and record explicit visual sign-off before merging or switching production links.
- Green automated tests alone are not enough. Keep V1 rollback intact.

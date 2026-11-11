# Native LuckPerms editor theme

This is a DuneRealms colour and layout theme for the original MIT-licensed LuckPermsWeb editor, not a replacement permission editor. Preserve upstream credits and LICENSE.txt.

Pinned upstream: https://github.com/LuckPerms/LuckPermsWeb at 5e99c720b7c795c7af17cbfc2fd6829a23f19189 (including its pinned wiki submodule).

Build with Node 22:

1. Clone upstream and check out the pinned revision. Initialise its submodules.
2. Run `node prepare.mjs /absolute/path/to/clean/checkout` as the checkout owner.
3. Inside upstream, run `npm ci --no-audit --no-fund` and `npm run build`.
4. Copy `dist/` to the release's `control-panel/native-editor/`, and include upstream LICENSE.txt there. Generated editor assets are ignored by Git.

The native application lives at `/luckperms-editor/`, uses the original LuckPerms data and websocket services, and retains its native group/node/prefix/suffix editing. Its page and every asset require an authenticated Owners account with `web.menu.luckperms` and `web.luckperms.edit`. Group overview requires `web.menu.luckperms` plus `web.luckperms.view`. Website permissions use only web.feature.action; game nodes are never imported from the website rank matrix.

Editor sessions are private. Only groups are included when creating a session. Trust/apply commands are explicit owner actions, restricted to native LuckPerms command syntax, and executed as the authenticated operator through the private game-host bridge. Session tokens and command codes are excluded from website audit details; editor URLs are redacted from the ordinary console-log endpoint.
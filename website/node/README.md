# CloudPanel Node hosting

The existing website Worker is also served by a native Node 22+ HTTP application, bound to localhost port 3000. CloudPanel should proxy dunerealms.com to that port and terminate TLS. The Sites deployment remains independent.

Install dependencies with `npm install --omit=dev`, run `npm run build`, then `npm start`. Set PUBLIC_ORIGIN, PORT, DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD in a private environment file. Never place credentials in the public document root or Git. The database user needs permission to create the application tables in its own database. Existing tables are preserved.

MySQL stores forum discussions, profiles, private support tickets, accounts and sessions. Passwords use salted scrypt; only a hash of the random session token is stored. Cookies require HTTPS. The Node server strips externally supplied Sites identity headers before forwarding requests. Website accounts are separate from ChatGPT accounts. Staff access requires an explicit database role change by the operator; registration cannot grant it.

`GET /healthz` checks the database. Use a process manager to restart the app after failure and reboot. Production on 18 October 2026 uses PM2 under the site user, a private environment file at ~/.config/dunerealms.env, releases under ~/apps/dunerealms/releases, a current symlink and a user cron @reboot PM2 restore entry. CloudPanel port: 3000. No root access or other hosted sites were changed.

Validation: 39 local website tests passed, including rejection of forged identity headers, CSRF, privilege injection and expired logout sessions. Live MySQL tests covered registration, profile updates, private ticket create/read/reply/close, forum create/search/read/reply and cleanup of temporary records. Public domain returned the application and connected health check. The owner installed the TLS certificate; HTTPS verification and browser checks on the custom domain subsequently passed.

The exchange intentionally retains labelled demo offers until a game-market feed is configured. Connecting MySQL does not connect Minecraft market data. News and diplomacy feeds also require their configured sources. No existing ChatGPT-hosted account data was migrated.

## Live world status

The homepage and exchange show a translucent server panel over the hero artwork. `web/world-status.js` polls `/api/worlds` every 30 seconds while visible. The Node handler caches checks for 15 seconds and fetches the fixed `WORLD_STATUS_URL` configured by the operator. It does not accept probe addresses from visitors or disclose internal addresses. A missing, stale or unreachable monitor produces Unknown, never a fabricated Online/Offline result.

`network/live-lobby/status-agent.py` on the Minecraft VM performs the Minecraft Java status handshake against Velocity and the Paper lobby independently. Not-yet-configured planets show Offline; add their private host/port pairs through its `WORLD_TARGETS_JSON` environment setting when deployed. The read-only systemd service `dune-status` listens on TCP 25572; UFW allows only the website host to reach it. No game console or write endpoint is exposed. The website uses `WORLD_STATUS_URL=http://2.28.33.142:25572/status` in its private environment file.

The status deployment is release `20261018-status`; its node_modules symlink reuses the previously installed exact dependency version from `20261018-node`. Keep that earlier release while this dependency symlink is in use. For a standalone future release install dependencies in its own directory.

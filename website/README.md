# Project Dune website

A responsive website styled from the illustrated plugin manual. Includes Arrakis gameplay, accessible House/planet tabs, DuneNPC missions, administrator tools, downloads and installation instructions. Separate pages provide the 57-chapter browsable manual with all 68 illustrated icons, Races & Houses, Exchange and News.

The home page is a Minecraft-styled banner and navigation hub. Every topic has its own page: Arrakis, Races & Houses, Smugglers, Equipment, Admin Tools, Manual, Exchange, News and Installation. The illustrated menu below every page banner links between these destinations.

Browser files are in `web/`. The server-only Discord API is in `worker/feed-api.mjs`. Hosting configuration is in `.openai/hosting.json`. `node scripts/build.mjs` creates a Worker ESM bundle with the website assets embedded, avoiding separate asset bindings. No dependency installation is required.

Run `node scripts/preview.mjs` for the local site and honest unconnected feed responses. Run `node --test tests/feed-api.test.mjs` for API transport and validation checks. Site publishing uses the supported Sites source workflow and packaging helpers.

See [DiscordSRV feed setup](DISCORD-FEEDS.md) for the optional DuneCore 1.0.9 bridge, required server-side secret names, channel setup and snapshot protocol. No credentials are committed or delivered to the browser. Feed data is read-only; trades stay inside Minecraft.

Art is reused from the Project Dune manual and optimized into WebP. Concept-art claims are identified on the page. No game server address or live market records are invented. The website retains the Site's owner-private audience until changed explicitly.

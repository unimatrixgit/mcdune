# Project Dune website

A responsive website styled from the illustrated plugin manual. Includes Arrakis gameplay, accessible House/planet tabs, DuneNPC missions, administrator tools, downloads and installation instructions. Separate pages provide the 57-chapter browsable manual with all 68 illustrated icons, Races & Houses, Exchange and News.

The home page is a Minecraft-styled banner and navigation hub. Every topic has its own page: Arrakis, Races & Houses, Smugglers, Equipment, Admin Tools, Manual, Exchange, News and Installation. The illustrated menu below every page banner links between these destinations.

Browser files are in `web/`. The server-only Discord API is in `worker/feed-api.mjs`. Hosting configuration is in `.openai/hosting.json`. `node scripts/build.mjs` creates a Worker ESM bundle with the website assets embedded, avoiding separate asset bindings. No dependency installation is required.

Run `node scripts/preview.mjs` for the local site and honest unconnected feed responses. Run `node --test tests/*.test.mjs` for API transport and validation checks. Site publishing uses the supported Sites source workflow and packaging helpers.

See [DiscordSRV feed setup](DISCORD-FEEDS.md) for the optional DuneCore 1.0.9 bridge, required server-side secret names, channel setup and snapshot protocol. No credentials are committed or delivered to the browser. Feed data is read-only; trades stay inside Minecraft.

Art is reused from the Project Dune manual and optimized into WebP. Concept-art claims are identified on the page. No game server address or live market records are invented. The website is public. Private portal data requires sign-in and server-side authorisation.

See [Forums and player support](FORUMS-PORTAL.md) for independent forums, the YouSMP Discord page and private profile-based tickets.


The standalone [Sietch Armoury](https://project-dune.bonnystoat9.chatgpt.site/armoury.html) contains all 68 illustrated item entries and full suit abilities. [Diplomacy](https://project-dune.bonnystoat9.chatgpt.site/diplomacy.html) reads the DuneCore 1.0.10 current-office snapshot via a dedicated DiscordSRV channel.

## The Prophecy blog

The top menu links to `prophecy.html`, a book-focused Paul Atreides journal with six illustrated posts covering Dune, Dune Messiah and Children of Dune. Each article has a spoiler gate, source notes and previous/next links. The index supports book filters and search. Original commentary is separated from plot context. Posts live in `web/prophecy-data.json`; the build regenerates their static pages with `scripts/build-prophecy.mjs`.

The Prophecy articles are extended essays of at least 3,000 body words each. Reading estimates use 200 words per minute and exclude graphic text. Each essay includes a timeline, relationship map, comparison board and linked contents. Long-form source lives in `content/prophecy/*.md`; `web/prophecy-graphics.json` holds visual-aid labels. The build fails if an essay falls below the minimum length.

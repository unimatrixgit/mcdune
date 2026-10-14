# DUNE-013 / SF-052 — efficiencyreview portal en game

Read-only bronreview, 14 oktober 2026. Gemeten op GitHub main `2577efefb56aae14da63df725cdf180419563bd1`. De aangekondigde v0.120.1/splitdiagnostics waren bij de fetch nog niet beschikbaar; bevindingen daarop opnieuw controleren. Geen live browsermeting, databaseprofilering, Starfall-codewijziging, reset of deployment uitgevoerd.

## Samenvatting

Pak eerst de manier van assetpublicatie, overlappende achtergrondaanvragen en volledige directoryreads aan. Optimaliseer daarna rendering en verdere codesplitsing. Er bestaan al nuttige maatregelen: request-scoped session-deduplicatie, begrensde asset-bytecache, enkele visibility/busy-guards, publieke readcache, content-hashed portalbundles en video preload=none. Behoud die bescherming; voer geen algemene cache voor persoonlijke spelgegevens in.

## Gemeten brongegevens

Met `git ls-tree -r -l` zijn tracked bestandsgroottes bepaald; met `git show` is gzipgrootte van geselecteerde bestanden berekend. De collectorselectie is nagebootst volgens `scripts/build-worker.cjs`, zonder een build te draaien of bronbestanden te wijzigen.

| Maat | Uitkomst |
| --- | ---: |
| Tracked assets onder dist, zonder server/.openai | 1.682 bestanden; 44.602.234 bytes |
| Na bestaande uitsluiting van PNG met WebP-equivalent | 1.679 bestanden; 36.727.913 bytes |
| Base64-payload van die selectie, exclusief JSON/Worker-code | 48.972.756 bytes |
| Reeds door collector vermeden PNG-data | 7.874.321 bytes |
| MP4 binnen collectorselectie | 13.047.538 bytes |
| WebP / overige PNG binnen selectie | 9.383.388 / 5.834.651 bytes |
| game-runtime.js | 657.934 bytes; gzip 183.490 |
| game.js | 462.463 bytes; gzip 130.905 |
| Game index.html | 263.656 bytes; gzip 56.940 |
| Portal HTML | 39.183 bytes; gzip 10.222 |
| planet-catalog.json | 974.757 bytes |
| Tracked portal-runtime hashes | 19; daarvan 13 niet rechtstreeks teruggevonden in tracked HTML |

Dit is geen gemeten eerste-paginatransfer: browser laadt niet alle assets tegelijk, Worker-sourcecompressie en HTTP-contentencoding zijn andere maten, en runtimegeneratie kan de uiteindelijke selectie veranderen. Een runtime zonder directe HTML-verwijzing kan nog indirect gebruikt worden; controleer bereikbaarheid voordat iets wordt weggelaten. `dist/server/index.js` is niet tracked in deze snapshot; daarom wordt geen exacte Worker-gzipgrootte geclaimd.

## Prioriteiten en meetbare doelen

| Volgorde | Knelpunt en bronbewijs | Voorstel en meetbaar resultaat | Risico/controle |
| --- | --- | --- | --- |
| 1 | build-worker embedt recursief assets als base64 in één Worker; media alleen al 13 MB MP4 | Houd grote video/audio/artwork buiten de JS-module via ondersteunde static-assets/object-storage publicatie. Behoud URL's of gebruik een versie-manifest. Meet Worker raw/gzip, cold-start CPU en mediaverkeer apart. MP4-extractie haalt aantoonbaar 13.047.538 raw assetbytes uit deze collectorselectie. | Eerst vaststellen wat bestaande hosting ondersteunt; deze review wijzigt geen bindings/publicatie. Behoud contenttypes, range/HEAD, privacy en fallback. |
| 2 | Veel 15/30/60s timers, dubbele /api/version-aanvragen | Eén visibility-aware scheduler per tab, dedup per endpoint, in-flight guards, backoff/jitter en refresh na mutaties. Combineer versie/clockcheck; 30s + 60s wordt 30s: 3 naar 2 requests/minuut per actieve tab voor dat paar. | Gameplaycommando's en audit-outbox niet verliezen; verborgen tab mag hervatting/uitloggen niet missen. Huidige guards verschillen per module. |
| 3 | /api/planets leest alle directory- en alliancerijen voordat client revision vergelijkt | Autorisatie-eerst revision/ETag short-circuit; gewijzigde eigen gegevens en publieke directory gescheiden of pagineer/delta. Bij ongewijzigde revisie geen volledige JSON-parse/response. Meet rows-read, CPU en bytes per poll bij groeiende universe. | Revision moet álle relevante wijzigingen, permission changes en reset generation representeren; geen oude privérechten/owned-state hergebruiken. |
| 4 | recordAccountAccess voegt bij iedere ingelogde API-aanvraag een accesslog toe en bij IP een history-upsert | Scheid verplichte security-events van herhaald routine-heartbeatverkeer; aggregeer routinehits in een persistent tijdvenster met hitcount/first/last, indien securitybeleid dat toestaat. Meet writes per actieve speler per uur. | Geen audit stilzwijgend uitschakelen; staff/reset/auth/mutaties en incidentonderzoek behouden. Isolate-memory alleen is geen betrouwbare auditbuffer. |
| 5 | Alle statics max-age=60; collector bevat oude hashes; zwakke ETag gebruikt versie/pad/lengte | Pristine build + bereikbaarheidsmanifest en contenthash-URL's. Alleen werkelijk immutable hashed assets lang cachen; HTML kort revalideren. Meet herhaalbezoek: immutable asset heeft nul bodytransfer zolang vers gehouden. | Ongehashte assets niet immutable maken. Privé/staff/game HTML blijven private no-store. Oude URLs tijdens rollout ondersteunen. |
| 6 | update() normaliseert/save't en herschrijft veel UI; save stringify't complete state synchroon | Dirty-state checkpoints, kleine zichtbare view-updates, coalesced renders; metadata-only refresh mag niet complete state save/render doen. Meet long tasks, update()/save()-duur en inputlatency op representatief groot savebestand. | Saveformat/starfall-round-v2, tickvolgorde en duurzame pending commands behouden; kritisch event direct opslaan, debounced flush plus page lifecycle testen. |
| 7 | Gedeelde JS-functies en volledige game HTML/monolith start tegelijk | Core shell eerst, paneelcode op eerste gebruik; pure metadata los van DOM. Behoud één bootstrap. Meet bytes/parse time vóór eerste bruikbare gameactie; streef pas na baseline naar bijvoorbeeld 25–40% minder init-JS. | Doelpercentage is een voorstel, geen gemeten winst. Concat-globals maken blind defer/dynamic import riskant; contracttests vóór splitsing. |

## Polling: concrete locaties

- `dist/game.js`: syncServerClock vraagt /api/version onmiddellijk en elke 30s op; `dist/planets.js` vraagt dezelfde route elke 60s voor versiecontrole. Voeg beide functies samen zonder de serverklok-offset te verliezen.
- `dist/planets.js`: directorypoll 15s met document.hidden-check; `refreshSharedPlanets` haalt eerst het volledige antwoord en vergelijkt daarna revision. Zijn guard voorkomt save-conflict maar is geen algemene refresh-in-flightguard.
- `dist/fleet-features.js`: readiness elke 30s met busy/time guard; één cycle doet snapshotwrite en command-read, plus eventuele commandafhandeling. Beoordeel snapshot-dirtychecking en aparte rustige commandpoll. Movement-outbox elke 15s doet niets bij lege wachtrij: tel die timer niet als onvoorwaardelijke netwerkrequest.
- `dist/population-development.js`: galaxy development en distribution controls elke 15s met visibility/role guards; alliance economy elke 30s. Galaxydevelopment slaat state op en rendert gedeelten na het antwoord. Meet per endpoint; niet iedere callback geldt voor iedere gebruiker.
- `dist/communications.js`, `special-worlds.js`, `site-management.js`: diverse 30s checks; sommige voor algemene signals/news/features, andere voor actie-/kolonietoestand. Deel een read-snapshot waar dezelfde context nodig is, maar maak geen brede command-endpoint die alle mutaties elke poll uitvoert.
- `dist/portal.js`: universe/worldstats elke 30s wanneer de betreffende DOM bestaat. Ook een nieuws-sorteertimer en staff-iframehoogte bestaan; die zijn DOM-werk, niet automatisch DB-verkeer.

Belastingsmodel voor dimensionering: één onvoorwaardelijke 15s GET is 4 verzoeken/minuut per tab, dus 400/minuut bij 100 actieve tabs. Als elk verzoek één sessiequery, één accessloginsert en één IP-upsert veroorzaakt, is de orde van grootte 400 sessiereads + 800 routinewrites/minuut, vóór endpointwerk. Dit is een scenario, geen gemeten productieaantal. Zichtbaarheid, caching, cookies, role guards, outboxinhoud en multi-tabgebruik veranderen het resultaat.

## Caching en server/database

`worker/cache.js` heeft een 16 MiB decoded-assetcache met 60s entryleeftijd, request-deduplicatie voor publieke reads en maximaal 128 cachekeys per DB-handle. Publieke allowlist: worldstats, staff-directory en planet-catalog. Cache is per isolate en dus geen globale garantie. Iedere succesvolle niet-GET/HEAD-request invalideert de hele publieke readcache; regelmatige readinesswrites kunnen cacheeffectiviteit drukken. Gebruik gerichte invalidatie waar dependencies bekend zijn. Voeg hit/miss/body-size/request-rate metingen toe voordat TTL's worden verhoogd.

Een body boven 256.000 tekens wordt niet bewaard. Het losse planet-catalog.json is circa 975 KB; controleer de werkelijke /api/planet-catalog-body om vast te stellen of deze route daarom structureel de cache mist. Publiceer een content-versioned publieke catalogus als static JSON, of maak een lichte index en lazy details. Waar rechten/typefilters gelden, mogen die niet via een publieke variant lekken.

De static ETag is gebaseerd op releaseversie, pad en base64-lengte; inhoud kan bij dezelfde lengte veranderen. Gebruik een echte build-time contenthash. Grote MP4's hebben expliciete ranges maar blijven slechts 60s gecachet. Bij uitplaatsing Range/206/416/HEAD en hervatten daadwerkelijk testen; geen complete video decode per range blijven doen als assetopslag dit kan afhandelen.

`worker/portal.js` memoiseert `portalUser` per Request, inclusief de promise: dubbele oproepen in dezelfde request zijn al samengevoegd. Behoud dit. Wel vraagt /api/portal/session altijd COUNT(*) op portal_users voor setupRequired. Vervang desgewenst door een goedkope EXISTS/flag met duidelijke initialisatie-semantiek; trek PBKDF2 niet omlaag als performance-optimalisatie. Authschema-initialisatie gebruikt isolate-guards; vaste schemawijzigingen naar genummerde migrations verplaatsen voorkomt herhaald initwerk op nieuwe isolates, met behoud van compatibiliteit.

`worker/planets.js` parse't directorydata meerdere keren in één GET voor publieke projectie, type-overzicht en membershiprepair. Parse één keer en hergebruik. Vergelijk DB-queryplan en rows-read voor coords/owner/kind filters voordat indexen worden toegevoegd. `worldStatsAPI` leest alle planeet-JSON en telt asteroids; revision-keyed aggregatie of incrementele counters kunnen dit reduceren, maar moeten reset/afbraak/import correct verwerken.

`worker/access.js` logt alle /api/* voor ingelogde gebruikers, ook goedkope version/publieke cachehits. Daardoor betekent een publieke cachehit niet nul DB-werk. Logretentiecleanup loopt per isolate ongeveer eens per uur; zonder tijdindex kan verwijderen grote scans geven. Onderzoek queryplans/indexen voor created_at, last_seen en paginering; verander bewaartermijn of auditinhoud alleen als beleid dit toestaat. `waitUntil` verplaatst werk buiten de responsewachttijd maar maakt DB-writes niet kosteloos.

## Praktisch meet- en verificatieplan

1. Neem HAR/profielen voor guestportal, ingelogde portal, nieuwe game, grote save, staff en 10 minuten idle/hidden/weer zichtbaar. Meet cold/warm cache, requestcount per route, encoded transfer, JS execution/long tasks, grootste artwork en eerste bruikbare actie. Redigeer cookies/privédata uit gedeelde HARs.
2. Meet per Worker-route CPU, wall time, responsebytes en D1 rows-read/rows-written; groepeer auth/audit versus endpointqueries. Belast met 1/10/100 gesimuleerde sessies en een representatieve universegrootte. Geen loadtest op live zonder afgesproken grenzen.
3. Eerst publicatie/assetmanifest en scheduler/dedup, daarna revisionfastpath en gerichte cache-invalidatie; vergelijk dezelfde scenario's per kleine wijziging. Leg budgetten vast op basis van echte baseline, niet alleen totale repositorybytes.
4. Tests: geen dubbele bootstraps/timers; geen overlappende poll na langzame response; backoff herstelt; logout/rolewijziging/resetgeneration invalideren data; in-flight stale response overschrijft geen nieuwe mutatie; privéresponse nooit shared cached. Audit en commands blijven volledig volgens afgesproken beleid.
5. Buildchecks: geen onbereikbare oude runtimes in manifest, alle dynamische imports/assets bestaan, cached rollbackURLs werken, release niet afhankelijk van oude dist. Test videoranges en opkomst in mobiele viewport. Herhaal review tegen v0.120.1-bron zodra die gepusht is.

Geen Starfall-wijzigingen zijn gemaakt. Alle besparingen behalve de expliciete bron-byteberekeningen en timerfrequentieverschillen zijn hypothesen of doelen die live/DB-metingen moeten bevestigen.

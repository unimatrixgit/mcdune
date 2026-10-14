# DUNE-011 — voorstel voor SF-046: meerdere alliances in één stronghold-galaxy

14 oktober 2026. Beleidsvoorstel, geen ingevoerde spelregel. Read-only broncontrole op Starfall `2577efe`: `dist/game.js` gebruikt `fortress.strongholdGalaxy`, lokale structuurslots 11–15 en een residentcontrole die zowel alliancelidmaatschap als verblijf in die galaxy vereist. `worker/alliance.js` initialiseert een eigen fortress per alliance en kent een stabiele `registryId`. Dit is geen volledige runtime-audit en bewijst niet dat alle actuele claimpaden dezelfde controle uitvoeren. De bijzondere slotregels van G-004/G-005 hieronder komen uit de opdracht van de collega.

## Advies in gewone taal

**Laat meerdere alliances samen in een galaxy wonen, maar geef die galaxy maximaal één stronghold-eigenaar.** Wonen betekent geen eigendomsrecht. De andere bewoners blijven gewoon lid van hun eigen alliance; hun planeten worden niet verplaatst en hun lidmaatschap verandert niet.

De bevoegde leiding claimt de galaxy voor haar alliance. Alleen de eigenaar mag daar nieuwe alliance-structuren bouwen. Een claim geeft geen zeggenschap over andermans planeten, geen toegang tot hun gegevens en geen recht om bewoners uit te zetten. Diplomatieke toestemming voor gastbewoners kan later apart worden ontworpen.

| Keuze | Voordeel | Nadeel |
| --- | --- | --- |
| Eén stronghold-eigenaar per galaxy — aanbevolen | Duidelijk eigendom, eenvoudigere bouwrechten en bonussen; vijf structuurslots hebben één verantwoordelijke. | Alliances die samen wonen moeten verschillende stronghold-galaxies kiezen. Tijdelijke lege claims vereisen een expliciete vrijgaveregel. |
| Meerdere stronghold-alliances delen één galaxy | Ondersteunt coalities en gedeelde woongebieden zonder exclusieve claim. | De vijf slots blijven wereldwijd gedeeld, niet vijf per alliance. Vereist afspraken over bezetting, wachtrij, leiderschap en bonusstapeling; één alliance kan alle ruimte gebruiken. |

Als gedeeld eigendom toch gewenst is: gebruik één galaxyregister met afzonderlijke allianceclaims en één gezamenlijke slotlijst. Iedere structuur heeft precies één eigenaar; alleen die eigenaar beheert haar bouw/upgrade/verwijdering. Geen impliciete gezamenlijke kas of extra slots. Elke bonus heeft een expliciete ontvanger en stapelregel: een speler krijgt alleen de toepasselijke bonus van zijn eigen alliance; coalitiebonussen vereisen een aparte goedgekeurde regel. Quota of gereserveerde slots zijn nieuwe spelregels en kunnen vijf slots onbruikbaar verdelen; voer ze niet stilzwijgend in.

## Eigendom en gelijktijdige aanvragen

1. De server controleert een concrete stronghold-bevoegdheid, niet alleen de zichtbaarheid van een knop. Aanbevolen: alliance Owner/HC, of een expliciet gedelegeerde bevoegdheid. Welke rollen die bevoegdheid krijgen moet bij invoering worden bevestigd. Een geldige inwonende eigen planeet is een voorgestelde claimvoorwaarde; verblijf alleen verleent nooit automatisch een claim.
2. De canonieke claimsleutel is `(round_id, galaxy_x, galaxy_y)`, gekoppeld aan het stabiele alliance-ID, niet aan de wijzigbare naam. Voor het aanbevolen model is die sleutel uniek. Stel ook maximaal één actieve stronghold per alliance per ronde vast; anders kan de eerste claimant meerdere galaxies blokkeren. De ene alliance mag meerdere woon-galaxies hebben.
3. Claimcontrole en vastlegging gebeuren atomisch. Twee gelijktijdige aanvragen leveren één winnaar en één duidelijke conflictmelding op. Een herhaalde aanvraag van dezelfde alliance is idempotent. Controleer rechten en membership opnieuw in dezelfde logische mutatie; vertrouw niet op een oude browserkopie.
4. Structuurbouw reserveert een globale coördinaat atomisch, inclusief wachtrij en bouwwerk in aanbouw. Gebruik een unieke occupancy-sleutel voor ieder objecttype, niet aparte planeten- en structuurtabellen die dezelfde coördinaat kunnen bezetten. Werk met conditionele writes/versies en een transactie of ondersteunde atomische batch. Een mislukte reservering mag geen geld afboeken.
5. Een claim of slot mag nooit stilzwijgend worden overgenomen op basis van het feit dat iemand inmiddels meer bewoners of een hogere score heeft. Leaderwissel verandert het alliance-ID en de galaxyclaim niet. Een echte claimoverdracht vereist bevoegde partijen of een afzonderlijk gemotiveerde staffbeslissing en auditlog.

## Structuurverlies, vertrek en alliancewissel

- **Laatste functionele structuur verloren:** markeer de claim als inactief en schakel alleen de daarvan afhankelijke bonussen uit. Laat haar niet onmiddellijk vrij voor een gelijktijdige vijandelijke aanvraag. Aanbevolen is eigendom behouden totdat de bevoegde leiding expliciet vrijgeeft of overdraagt; dat voorkomt een heimelijk conquest-mechanisme. Keerzijde: verlaten claims kunnen blijven bestaan. Een vervaltermijn of veroveringsmechaniek moet daarom later expliciet als aparte spelregel worden gekozen, met waarschuwing en hersteltermijn, niet als verborgen timer in deze migratie.
- **Bewoner wisselt alliance:** de planeet blijft op haar coördinaat; claim en structuren blijven bij de oorspronkelijke alliance. De speler verliest oude alliancebonussen en krijgt alleen nieuwe bonussen als de geldende voorwaarden dat toelaten. Reeds verstrekte items worden niet automatisch teruggevorderd; periodieke beloningen hebben een ledger om dubbel innen bij wisselen te voorkomen.
- **Alle eigen bewoners vertrokken:** markeer de claim als verlaten/inactief, behoud assets en eigendom tot expliciete afhandeling. Bewoners migreren niet automatisch mee met een nieuwe stronghold.
- **Vrijgave of stronghold verplaatsen:** blokkeer stilzwijgende vrijgave zolang structuren of reserveringen bestaan. Laat de leiding een expliciet plan kiezen: behouden onder gemarkeerde oude status, toegestane overdracht of afzonderlijk goedgekeurde verhuizing/afbraak. Geen automatische vernietiging. De uiteindelijke productregel moet bepalen of oude structuren na verhuizing nog mogen functioneren; aanbevolen is geen nieuwe bonussen buiten de actieve stronghold.
- **Alliance opgeheven:** archiveer de claim met haar assets als af te handelen nalatenschap; geef niet automatisch andermans planeet of structuur weg. Staff- of goedgekeurde herstelprocedure is nodig. Naamhergebruik mag geen eigendom herstellen zonder hetzelfde bevoegde alliance-ID.

## Bonussen en zichtbaarheid

Laat iedere berekening expliciet kijken naar speler → actuele alliance → actieve claim → juiste galaxy → functionele structuur en eventuele cooldown. De bestaande residentvoorwaarde voor de lokale strongholdbeloning blijft behouden. Bestaande alliancebrede effecten houden hun bestaande bereik; deze beleidskeuze mag ze niet allemaal ineens lokaal maken. Gebruik geen regel “iedereen in deze galaxy krijgt alle aanwezige bonussen”.

Toon in galaxyoverzicht en strongholdpaneel: eigenaar, claimstatus, bezetting/gereserveerde slots, eigenaar per structuur en de reden waarom een bonus wel/niet geldt. Bij conflict: duidelijk ‘betwist — geen nieuwe claim/bouw totdat opgelost’. Houd oude schade-, bouw-, kas- en bonuslogs beschikbaar. Laat spelers vóór een bevestiging weten welke bonussen stoppen; geen onzichtbare membershipwijzigingen.

## Bijzondere galaxy 1:1 en ghosts

Gewone galaxies behouden 1–10 spelers en 11–15 structuren. Alleen **1:1 wanneer zij daadwerkelijk een stronghold is**, krijgt volgens G-005: spelers 1–10, ghosts 11–15, structuren 16–20. Slot 15 is dus uitsluitend ghost binnen die uitzondering. G-004 reserveert de tribute op 1:1:11; deze reservering blijft beschermd, ook als die tribute nog niet geplaatst is.

De server bepaalt de toegestane slotklasse centraal. Een claim, alliancenaam of clientinstelling mag de bijzondere indeling niet naar andere galaxies kopiëren. Bestaande staffplaneten blijven staan; de gewone instroomblokkade voor 1:1 wordt niet door deze beleidsanalyse veranderd.

Schakel de bijzondere indeling niet heen en weer wanneer de laatste structuur verdwijnt. Wanneer 1:1 eenmaal geldig is omgezet en ghost/structuurobjecten bevat, moet een vrijgave een expliciete overgangscontrole krijgen. Bescherm die coördinaten tot een apart goedgekeurde conversie; nooit ghosts herschikken om een structuurslot vrij te maken.

## Bestaande conflicten veilig migreren

1. Maak een read-only inventaris en herstelbare snapshot van alle claims, alliance-IDs, bewoners, structuren, bouwreserveringen, globale coördinaten en bonusstatus. Geen winnaar afleiden uit onbetrouwbare JSON-volgorde of hoogste score.
2. Maak de nieuwe registers naast bestaande gegevens. Eenduidige claims worden gekoppeld aan hun bestaande stabiele alliance-ID; ontbrekende identiteit wordt onderzocht. Normaliseer galaxycoördinaten voordat unieke sleutels worden gecontroleerd.
3. Meerdere claims op dezelfde galaxy krijgen een **betwiste migratiestatus**. Bewaar alle assets en bestaande membership, blokkeer nieuwe claims/bouw/overdracht in dat conflict en toon het probleem. Bewaar bestaande aantoonbaar rechtmatige effecten volgens een vooraf vastgelegde overgangsregel; ken geen extra of dubbele bonussen toe. Als rechtmatigheid niet uit logs vaststaat, laat staff daarover een expliciete beslissing nemen vóór de nieuwe bonusregel actief wordt.
4. Een aantoonbare eerste rechtmatige claim kan richting geven, maar alleen volgens een vooraf goedgekeurde beslisregel. Anders laat betrokken leiding een regeling kiezen: één eigenaar met vrijwillige verhuizing, of expliciet tijdelijk legacy gedeeld gebruik. Een verhuizing behoudt asset-ID, eigenaar, niveau, schade, resterende bouwtijd en betaalde kosten; doelcoördinaten worden eerst gereserveerd. Geen willekeurige verwijdering, verplaatsing of kostenberekening.
5. Coördinaatbotsingen en reeds bezette bijzondere slots gaan naar een staff-herstelplan. Geen automatische massashift; vooral tribute/ghosts en staffplaneten zijn beschermd. Bewaar mapping en auditlog voor een hervatbare migratie.
6. Activeer unieke constraints pas als alle actieve rijen ermee verenigbaar zijn; legacy conflicten blijven apart opgeslagen en zichtbaar. Bij onopgelost conflict wordt de handhaving voor die galaxy niet half ingevoerd. Herhalen van de migratie verandert geen reeds toegewezen eigenaar of asset-ID.

## Controle vóór eventuele invoering

- Twee alliances claimen tegelijk: één claim; geen dubbele afboeking. Twee bouwtaken reserveren hetzelfde slot: één winnaar. Retries, stale versies, leaderwissel tijdens aanvraag en rollback werken.
- Leden/pending/buitenstaanders kunnen niet claimen via vervalste requests; na alliancewissel wordt een oude sessie opnieuw gecontroleerd. Alliance hernoemen behoudt ownership.
- Bewoners van verschillende alliances blijven in dezelfde galaxy zonder membershipverlies; uitsluitend juiste bonussen. Geen dubbel dagelijks item bij switch/retry; nul functionele structuren deactiveert alleen afhankelijke effecten.
- Laatste structuur vernietigd, laatste bewoner vertrokken, opheffing, vrijgave en verhuizing volgen hun expliciete toestand; geen gratis assetovername.
- Gewone galaxy weigert structuren 16–20. Bijzondere 1:1 weigert structuren 11–15, beschermt 1:1:11 en verplaatst geen bestaande objecten. Claimverlies schakelt de slotindeling niet destructief terug.
- Migratiefixtures: twee verschillende claims, dubbele slots, ontbrekend alliance-ID, rename, al gereserveerd bouwslot en half uitgevoerde migratie. Aantallen assets en memberships blijven gelijk; één herhaling veroorzaakt geen extra wijzigingen.

**Beslissing gevraagd aan de gebruiker vóór implementatie:** één eigenaar per galaxy (aanbevolen) of gedeelde strongholds; daarna de expliciete regels voor verlaten claims, verhuizing en betwiste bestaande bonussen. Dit rapport voert geen van deze keuzes uit. Er zijn geen Starfall-runtimetests uitgevoerd.

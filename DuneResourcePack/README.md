# Dune Resource Pack

Client-side resource pack for Minecraft Java 1.21.4 servers. Works with vanilla and Fabric clients running Minecraft 1.21.4; Fabric Loader does not require a special mod wrapper for standard resource packs.

- Gives the visible Sniffer sandworm a desert-tan, segmented hide with ivory toothlike head details.
- Gives zombie raiders a haunted Fremen stillsuit texture.
- Recolors suspicious sand to a bright spice-gold so deposits are easier to spot.

On a Fabric client, copy `DuneResourcePack.zip` into `.minecraft/resourcepacks`, launch the Fabric profile for Minecraft 1.21.4, then enable **Dune Resource Pack** in Options → Resource Packs. Do not put the ZIP in the `mods` folder. For automatic server delivery, host the ZIP at a direct-download URL and set `resource-pack` in `server.properties` for each backend. Players must accept it. Reaccept or reload the updated pack after upgrading. DuneCore 1.0.5 spawns a real Sniffer body with an invisible Husk providing native zombie AI. The Sniffer texture keeps the vanilla model's UV layout; the pack does not create a custom worm mesh. The legacy Husk texture remains for compatibility.

DuneCore 1.0.7 adds an Arrakis smuggler texture for the vanilla wandering trader model.
Enable the updated pack to see sand-tan robes, a face covering, amber trim and leather gear.
This texture applies to all wandering traders client-side; smuggling missions only apply to Arrakis traders.

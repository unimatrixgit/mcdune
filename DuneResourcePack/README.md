# Dune Resource Pack

Client-side resource pack for Minecraft Java 1.21.4 servers. Works with vanilla and Fabric clients running Minecraft 1.21.4; Fabric Loader does not require a special mod wrapper for standard resource packs.

- Gives Husk sandworms a Sniffer-inspired texture.
- Gives zombie raiders a haunted Fremen stillsuit texture.
- Recolors suspicious sand to a bright spice-gold so deposits are easier to spot.

On a Fabric client, copy `DuneResourcePack.zip` into `.minecraft/resourcepacks`, launch the Fabric profile for Minecraft 1.21.4, then enable **Dune Resource Pack** in Options → Resource Packs. Do not put the ZIP in the `mods` folder. For automatic server delivery, host the ZIP at a direct-download URL and set `resource-pack` in `server.properties` for each backend. Players must accept it. This pack changes entity textures only; a Husk retains its vanilla Husk model geometry.

# DuneTerrain for Paper 1.21.4

DuneTerrain is a standalone Paper plugin that generates one Dune planet world per server. It includes the five planet profiles, terrain and ore generation, Arrakis spice deposits and sietches, safe world spawn setup, and a protected Spacing Guild navigator.

## Build and install

Build the plugin from this directory with Java 21 and Gradle 8.14 or newer:

```sh
gradle clean build
```

Copy `build/libs/DuneTerrain-1.0.1.jar` into the Paper server's `plugins/` directory. Set `server.planet` in `plugins/DuneTerrain/config.yml` separately on each backend, then restart.

Valid values are `arrakis`, `giedi_prime`, `kaitain`, `caladan`, and `sigma_draconis_iv`. All five planet profiles are present in each server's config; change `server.planet` to select the world that backend creates. The generated world is named after the selected planet. Adjust its `planets.<planet>` settings for terrain, biome, surface, water, vegetation, ores, and spawn coordinates.

Install DuneCore alongside DuneTerrain if you want the Guild navigator to open DuneCore's travel menu. DuneCore reads the loaded planet world to identify its local backend. For proxy travel, set `network.local-planet` and `network.servers` in DuneCore's config to match the DuneTerrain selection and proxy server names.

Paper's `paper-global.yml` and `paper-world-defaults.yml` do not choose terrain generators; Paper reads those for server and world behavior settings. Terrain generators are registered through `bukkit.yml`. DuneTerrain loads at startup and exposes its generator to Paper. If Arrakis is the primary world (`level-name=arrakis`), add this to `bukkit.yml`:

```yaml
worlds:
  arrakis:
    generator: DuneTerrain:arrakis
```

For another primary planet, replace both `arrakis` values with that planet name. When using DuneTerrain's separate planet world alongside a normal primary world named `world`, the plugin assigns the generator directly as it creates the planet world; no `bukkit.yml` entry is needed.

The generator applies to newly generated chunks. Existing chunks are never replaced by a config change. If the selected planet world already exists with non-Arrakis terrain, stop the server, back up and move that world's folder out of the server directory, then restart to create it with DuneTerrain. DuneTerrain reports whether it found the world already loaded with its generator.

DuneCore sends players joining Paper's default `world` to the configured local planet spawn, whether or not they have already chosen a faction.

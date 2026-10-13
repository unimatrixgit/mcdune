# DuneTerrain for Paper 1.21.4

DuneTerrain is a standalone Paper plugin that generates one Dune planet world per server. It includes the five planet profiles, terrain and ore generation, Arrakis spice deposits and sietches, safe world spawn setup, and a protected Spacing Guild navigator.

## Build and install

Build the plugin from this directory with Java 21 and Gradle 8.14 or newer:

```sh
gradle clean build
```

Copy `build/libs/DuneTerrain-1.0.0.jar` into the Paper server's `plugins/` directory. Set `server.planet` in `plugins/DuneTerrain/config.yml` separately on each backend, then restart.

Valid values are `arrakis`, `giedi_prime`, `kaitain`, `caladan`, and `sigma_draconis_iv`. All five planet profiles are present in each server's config; change `server.planet` to select the world that backend creates. The generated world is named after the selected planet. Adjust its `planets.<planet>` settings for terrain, biome, surface, water, vegetation, ores, and spawn coordinates.

Install DuneCore alongside DuneTerrain if you want the Guild navigator to open DuneCore's travel menu. DuneCore reads the loaded planet world to identify its local backend. For proxy travel, set `network.local-planet` and `network.servers` in DuneCore's config to match the DuneTerrain selection and proxy server names.

The generator applies only when a world is first created. Existing worlds and already-generated chunks are not replaced by a config change.

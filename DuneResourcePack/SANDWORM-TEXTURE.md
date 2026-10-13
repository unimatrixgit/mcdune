# Sniffer sandworm skin

Final game asset: `assets/minecraft/textures/entity/sniffer/sniffer.png` (192x192 RGBA). Generated with the built-in ImageGen tool, then fitted to the native Sniffer canvas and original UV alpha mask. No custom geometry is supplied. DuneCore 1.0.5 creates the visible Sniffer entity and its invisible Husk AI controller.

## Generation prompt

Use case: precise-object-edit. Asset type: production Minecraft Java Sniffer entity texture atlas for a Dune sandworm. Edit the attached vanilla Sniffer UV atlas: replace the green moss and red fur with pale desert tan, ochre, warm sand-brown chitin, segmented ridges and subtle weathered scales. Replace the yellow snout patches with pale ivory/dark-brown toothlike ridges, and make the head menacing and wormlike while remaining a Sniffer texture. Every colored UV island must remain in EXACTLY the same x/y position and size. Preserve the original 192 by 192 pixel UV coordinate canvas and alpha silhouette, transparent unused regions, sharply pixelated nearest-neighbor Minecraft texels. No extra pixels outside the original opaque island shapes, no new UV islands, no text, no labels, no background, no 3D rendering, no creature illustration. Return only the FLAT atlas. Ensure the legs and body share the same sand-colored palette. This texture will be installed directly at assets/minecraft/textures/entity/sniffer/sniffer.png; preserve native canvas aspect and grid. The attached image is the edit target; retain exact UV layout.

## Validation

The installed texture has the native 192x192 dimensions and an exact per-pixel alpha-mask match to the Sniffer atlas. The ZIP preserves the existing zombie raider and spice-sand textures. The updated PNG is included in both the source directory and the shipped resource-pack ZIP. Final in-game rendering still needs verification on a live Minecraft client.

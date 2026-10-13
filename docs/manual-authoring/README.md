# Manual authoring sources

The current player and admin manual contains 77 pages and 68 illustrated reference icons. It covers DuneCore 1.0.8, DuneNPC 1.0.0, DuneTerrain 1.0.7 and DuneEss 1.0.1.

`manual-current-content.txt` contains the prose. Both builders add artwork, icon catalogues, a linked contents list and shipped configuration values directly from the plugin source files.

Install Python dependencies with `python -m pip install reportlab pillow pypdf pyyaml`. The current typography uses Windows Arial and Georgia fonts from `C:/Windows/Fonts`.

From the repository root, run:

```powershell
python docs/manual-authoring/build_current_manual.py
python docs/manual-authoring/build_decorated_manual.py
```

The first builder creates `docs/Dune-Complete-Illustrated-Manual.pdf`; the second creates the decorated default `docs/Dune-User-Manual.pdf`. Temporary image conversions and extraction results go into ignored `tmp/pdfs/`. Re-render and visually inspect every page after editing.

Artwork is under `docs/artwork/`, with generation notes alongside it. The decorated edition adds a Minecraft-influenced Dune border with House motifs and spice imagery while preserving the same guide content. The art is thematic illustration rather than screenshots or unreleased gameplay.

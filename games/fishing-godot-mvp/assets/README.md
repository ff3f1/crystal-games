# Art pipeline — CC0 licensed assets

Run: `python3 tools/fetch_assets.py` from the Godot project directory or repository root path.

This downloads real meshes and photoscanned textures into this folder **before** Godot import.
Build artifacts contain the assets, not runtime web requests. Files are excluded
from git to avoid duplicating third-party binary archives.

## Sources and credits
- Kenney Nature Kit (tree, rock, grass, stump, bush): https://kenney.nl/assets/nature-kit — CC0 1.0. Mirror from https://github.com/Hidencod/tge-assets, pinned git revision.
- Quiet Lake Fishing 3D kit (rod, fish, dock, boat, reeds, tackle): https://3dassets.dev/packs/quiet-lake-fishing — CC0 1.0.
- Poly Haven (shore and forest photogrammetry textures): https://polyhaven.com/ — CC0. Mirror from https://github.com/OmniTender-Systems/game-visual-assets.
- World lighting, shader, layout, mobile movement, procedural shoreline and fishing mechanics are part of this prototype.

These models are not photoreal cinematic assets. This is a **new art direction / art-enabled MVP**.

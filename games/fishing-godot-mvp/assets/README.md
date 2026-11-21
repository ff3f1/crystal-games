# Рыбалка: Первый заброс — asset pipeline

The build makes a **self-contained Android APK**. No networking or streaming of 3D/audio assets at runtime.

## 3D environment (CC0)
- Kenney Nature Kit (trees, shrubs, grass, rocks): https://kenney.nl/assets/nature-kit
- Quiet Lake Fishing (dock, boat, reeds, tackle props): https://3dassets.dev/packs/quiet-lake-fishing
- Poly Haven and CC0-public-domain 3D scans (wet shoreline, forest soil, mossy boulders): https://polyhaven.com/
- Assets are pinned or referenced by a fixed kit manifest in `tools/fetch_assets.py`. Some are converted from glTF with `gltf-transform dequantize` for Godot 4.5 compatibility.

## Original species models and fish skin maps
The runtime generates separate **crucian carp, European perch and northern pike** meshes in `scripts/fish_visual.gd`, complete with fins, eyes, gills and animated tails.
These are true spatial meshes with tangents / UVs, NOT 2D cards or the earlier generated illustration boards.

`python tools/build_fish_textures.py` produces all original maps in `assets/textures`:
- `fish_crucian_albedo.png` and `fish_crucian_normal.png`
- `fish_perch_albedo.png` and `fish_perch_normal.png`
- `fish_pike_albedo.png` and `fish_pike_normal.png`

The per-species UV albedo textures show scales, pike spots, perch stripes and shading from dark dorsum to cream belly; normal maps add wet-scaled relief. Shader: `shaders/fish_skin.gdshader`.

## Original audio pack (no stock or AI voices)
`python tools/build_sfx.py` creates actual PCM 24kHz 16-bit WAV audio samples:
- `cast.wav`, `splash.wav`, `bite.wav`, `hook.wav`
- `reel.wav`, `drag.wav`, `catch.wav`, `fail.wav`, `footstep.wav`
- `lake_water.wav`, `forest_birds.wav` (loopable ambience)

All generated music-free sounds are authored for this prototype using deterministic layered synthesis; no third-party audio licensing requirements.

## Visual limitations
The fish models and fish-skin maps are game-ready procedural artwork, **not photogrammetry or production 3D scanned fish**. Artistic polish still depends on testing at actual smartphone size. Environment uses a mix of CC0 scanned and simpler background meshes.

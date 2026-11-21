#!/usr/bin/env python3
"""Fetch pinned CC0 art assets for Fishing First Cast.
Download during development/CI before importing the Godot project.
"""
from __future__ import annotations
import json
import urllib.request
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "assets" / "models"
TEX = ROOT / "assets" / "textures"
MODELS.mkdir(parents=True, exist_ok=True)
TEX.mkdir(parents=True, exist_ok=True)

USER_AGENT = "FishingFirstCast-MVP/0.2 (CC0 game asset importer)"

def fetch(url: str, output: Path) -> None:
    if output.exists() and output.stat().st_size > 100:
        print("Using cached", output.name)
        return
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=55) as resp:
        data = resp.read()
    if len(data) <= 100:
        raise ValueError(f"Asset too small: {output}: {len(data)}")
    output.write_bytes(data)
    print("Fetched", output.name, len(data), "bytes")

QUIET_LAKE = {
    "rod": "Fishing Rod and Reel",
    "perch": "Perch Fish",
    "carp": "Carp Fish",
    "trout": "Trout Fish",
    "dock": "Dock Platform",
    "boat": "Teal Rowboat",
    "chair": "Canvas Fishing Chair",
    "tackle": "Open Tackle Box",
    "cooler": "Catch Cooler",
    "cattails": "Cattail Reed Clump",
    "lilies": "Lily Pads and Blossom",
    "float_set": "Fishing Float Set",
    "lure": "Spinner Lure",
    "net": "Landing Net",
    "sign": "Fishing Spot Sign",
    "rock_cluster": "Shore Rock Cluster",
}

# The 3DAssets.dev manifest contains permanent, versioned CDN links, and all models are CC0.
manifest_url = "https://3dassets.dev/api/v1/packs/quiet-lake-fishing"
req = urllib.request.Request(manifest_url, headers={"User-Agent": USER_AGENT})
with urllib.request.urlopen(req, timeout=55) as response:
    manifest = json.load(response)["data"]["assets"]
for output_name, exact_title in QUIET_LAKE.items():
    matches = [a for a in manifest if a["title"].split(" (Quiet Lake Fishing)")[0] == exact_title]
    if len(matches) != 1:
        raise ValueError(f"Unable to resolve asset {exact_title!r} in manifest")
    fetch(matches[0]["cdnUrl"], MODELS / f"{output_name}.glb")

# Kenney Nature Kit: CC0. Pin to a checked repo commit, not a moving branch.
kenney_sha = "2063cb42fb45b80a20c3db066b71e627cc64741c"
kenney_base = f"https://raw.githubusercontent.com/Hidencod/tge-assets/{kenney_sha}/packs/nature-kit/"
for name in (
    "tree-oak", "tree-oak-dark", "tree-detailed", "tree-default",
    "tree-pinetalla-detailed", "tree-pinetallb-detailed", "tree-pinerounda",
    "tree-pineroundd", "plant-bushdetailed", "plant-bushlarge",
    "grass-leafs", "grass-large", "rock-largea", "rock-largee",
    "rock-smallb", "rock-smallh", "log", "stump-rounddetailed",
):
    fetch(kenney_base + name + ".glb", MODELS / (name + ".glb"))

# Compact real scanned CC0 rocks and shrubs for close-up areas of the lake.
# Unlike the stylized background kit, these are genuine photoscanned 3D models.
poly_model_sha = "77343cac874f06b73d16ad0063339df7c9ca254c"
poly_model_base = f"https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/{poly_model_sha}/packs/"
for category, model in (
    ("polyhaven-nature-rocks", "rock_07"),
    ("polyhaven-nature-rocks", "rock_moss_set_01"),
    ("polyhaven-nature-rocks", "stone_01"),
    ("polyhaven-nature-plants", "shrub_02"),
    ("polyhaven-nature-plants", "shrub_03"),
):
    fetch(poly_model_base + f"{category}/models/{model}/{model}.glb", MODELS / f"{model}.glb")

# Poly Haven 1K photoscanned CC0 textures, mirrored with license in this public repository.
poly_base = "https://raw.githubusercontent.com/OmniTender-Systems/game-visual-assets/main/vendor/polyhaven/"
for output, url in {
    "shore_diffuse.jpg": "coast_sand_rocks_02/coast_sand_rocks_02_diffuse_1k.jpg",
    "shore_normal.jpg": "coast_sand_rocks_02/coast_sand_rocks_02_nor_gl_1k.jpg",
    "forest_diffuse.jpg": "forrest_ground_01/forrest_ground_01_diffuse_1k.jpg",
    "forest_normal.jpg": "forrest_ground_01/forrest_ground_01_nor_gl_1k.jpg",
    "bark_diffuse.jpg": "bark_brown_02/bark_brown_02_diffuse_1k.jpg",
}.items():
    fetch(poly_base + url, TEX / output)

# Poly Haven CC0 panoramic real-world lakeside photo replaces the neutral sky gradient.
# Resize the high-resolution JPEG to mobile-friendly 3K for predictable GPU memory use.
sky_source = TEX / "green-lake-source.jpg"
sky_target = TEX / "sky_panorama.jpg"
# Prefer a forested lake panorama; fall back to the known-good Arboretum.
for sky_name in ("shudu_lake", "lake_pier", "arboretum"):
    try:
        fetch(f"https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/{sky_name}.jpg", sky_source)
        print("Chosen photographic sky:", sky_name)
        break
    except Exception as exc:
        print(f"Unable to fetch sky {sky_name}: {exc}")
else:
    raise RuntimeError("Unable to fetch any CC0 lake panorama")
if not sky_target.exists():
    with Image.open(sky_source) as sky_img:
        sky_img = sky_img.convert("RGB")
        sky_img = sky_img.resize((3072, 1536), Image.Resampling.LANCZOS)
        sky_img.save(sky_target, "JPEG", quality=85, optimize=True)
    print("Sky panorama ready", sky_target.stat().st_size, "bytes")
sky_source.unlink(missing_ok=True)

print("CC0 assets ready in", ROOT / "assets")

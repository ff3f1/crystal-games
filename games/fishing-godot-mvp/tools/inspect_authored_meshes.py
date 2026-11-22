#!/usr/bin/env python3
"""Inspect source GLBs without rasterizing them; CI proves that real geometry is present."""
from __future__ import annotations
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[1] / "assets" / "models"
names = (
    "authored_fishing_rod.glb",
    "authored_leather_gloves.glb",
    "scots_pine_lod1.glb",
    "scots_pine_lod2.glb",
    "norway_spruce_lod1.glb",
    "norway_spruce_lod2.glb",
    "authored_grass_lod1.glb",
    "authored_cattail_lod1.glb",
    "authored_reed_lod1.glb",
)
for name in names:
    path = root / name
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or len(raw) < 64:
        raise RuntimeError(f"Missing or invalid authored 3D mesh: {name}")
    json_length, json_type = struct.unpack_from("<I4s", raw, 12)
    assert json_type == b"JSON"
    document = json.loads(raw[20:20+json_length].decode("utf-8"))
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    triangles = 0
    detailed_nodes = []
    for n in nodes:
        if "mesh" in n:
            m = meshes[n["mesh"]]
            counts = []
            for primitive in m.get("primitives", []):
                accessor = document["accessors"][primitive.get("indices", primitive["attributes"]["POSITION"])]
                triangles += accessor["count"] // 3
                counts.append(accessor["count"])
            detailed_nodes.append({"node": n.get("name", "?"), "primitives": counts, "translation": n.get("translation", [])})
    print(json.dumps({
        "file": name, "bytes": len(raw), "triangles": triangles,
        "meshes": len(meshes), "materials": len(materials), "extensions": document.get("extensionsRequired", []),
        "nodes": detailed_nodes[:55],
    }, ensure_ascii=False))
    if triangles < 500 or len(materials) < 1:
        raise RuntimeError(f"Not a usable authored 3D asset: {name}")

#!/usr/bin/env python3
"""Refinish the acquired CC0 fishing rod's *existing* 2K PBR base-color map.

No mesh, UV, normals or metallic/roughness map are replaced. The open-license
rod has saturated pastel green/yellow wood paint intended for a cozy prop.
This deterministic recolor gives the same authored model a natural graphite,
aged cork and matte gunmetal finish suitable for a first-person simulator.
"""
from __future__ import annotations

import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def retexture(source: Path, target: Path) -> None:
    data = source.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise RuntimeError("Not a valid glTF 2.0 binary")

    offset = 12
    chunks: dict[bytes, bytes] = {}
    while offset < length:
        chunk_length, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunks[chunk_type] = data[offset:offset + chunk_length]
        offset += chunk_length

    document = json.loads(chunks[b"JSON"])
    binary = chunks[b"BIN\x00"]
    material = document["materials"][0]
    tex_id = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    image_id = document["textures"][tex_id]["source"]
    image = document["images"][image_id]
    if "bufferView" not in image:
        raise RuntimeError("Expected embedded base-color image")
    view = document["bufferViews"][image["bufferView"]]
    begin = view.get("byteOffset", 0)
    image_bytes = binary[begin:begin + view["byteLength"]]

    with Image.open(io.BytesIO(image_bytes)) as im:
        rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    if min(h, w) < 1024:
        raise RuntimeError("Refusing to refinish a low-resolution PBR texture")

    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    out = rgb.copy()
    # Warm painted cork/brown polymer and formerly yellow spool ornaments.
    # Reduce saturated palette colors without destroying the UV details.
    green_paint = (green > red * 1.09) & (green > blue * 1.08) & (green > 74.0)
    copper_paint = (red > green * 1.12) & (green > blue * 1.09) & (red > 100.0)
    metal_light = (red > 173) & (green > 171) & (blue > 162) & (np.abs(red - green) < 24)
    tan_cork = (red > 113) & (green > 85) & (blue > 51) & (~green_paint) & (~copper_paint) & (~metal_light)

    out *= np.asarray([0.86, 0.87, 0.88], dtype=np.float32)
    out[green_paint] = rgb[green_paint] * np.asarray([0.36, 0.42, 0.51], dtype=np.float32)
    out[copper_paint] = rgb[copper_paint] * np.asarray([0.62, 0.52, 0.49], dtype=np.float32)
    out[tan_cork] = rgb[tan_cork] * np.asarray([0.77, 0.70, 0.63], dtype=np.float32)
    out[metal_light] = rgb[metal_light] * np.asarray([0.77, 0.82, 0.86], dtype=np.float32)

    # Restrained subpixel wood/cloth-like grain keeps the surface from being a
    # completely uniform block. The source already has detailed normal maps.
    rows, columns = np.indices((h, w), dtype=np.float32)
    grain = (np.sin(rows * 0.31 + columns * 0.18)
             + np.sin(columns * 0.47 - rows * 0.055)) * 1.35
    out += grain[:, :, None] * np.where(tan_cork, 1.0, 0.25)[:, :, None]
    encoded = io.BytesIO()
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").save(
        encoded, "JPEG", quality=91, subsampling=0, optimize=True
    )
    payload = encoded.getvalue()

    start = len(binary)
    binary += payload
    binary += b"\x00" * ((-len(binary)) % 4)
    view_id = len(document["bufferViews"])
    document["bufferViews"].append(
        {"buffer": 0, "byteOffset": start, "byteLength": len(payload)}
    )
    image["bufferView"] = view_id
    image["mimeType"] = "image/jpeg"
    document["buffers"][0]["byteLength"] = len(binary)

    json_data = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_data += b" " * ((-len(json_data)) % 4)
    total = 12 + 8 + len(json_data) + 8 + len(binary)
    output = (
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(json_data), b"JSON")
        + json_data
        + struct.pack("<I4s", len(binary), b"BIN\x00")
        + binary
    )
    assert len(output) == total
    target.write_bytes(output)
    print(f"AUTHORED_ROD_REFINISH_OK: {w}x{h}, CC0 mesh/PBR intact, bytes={len(output)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: refinish_rod.py source.glb output.glb")
    retexture(Path(sys.argv[1]), Path(sys.argv[2]))

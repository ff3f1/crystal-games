#!/usr/bin/env python3
"""Keep the authored CC0 rod and reel, remove its unrelated showroom stand/float.
Operates on GLB index buffers directly: original PBR textures and vertex data
are preserved byte-for-byte. Fails on any changed source geometry.
"""
import json
import struct
import sys
from pathlib import Path
import numpy as np


def unpack(source):
    magic, version, length = struct.unpack_from("<4sII", source, 0)
    if magic != b"glTF" or version != 2 or length != len(source):
        raise ValueError("Invalid GLB 2.0")
    offset = 12
    blocks = {}
    while offset < len(source):
        size, kind = struct.unpack_from("<I4s", source, offset)
        offset += 8
        blocks[kind] = source[offset:offset + size]
        offset += size
    return json.loads(blocks[b"JSON"]), blocks[b"BIN\x00"]


def accessor_data(doc, binary, index, components, dtype):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    if accessor.get("sparse") or view.get("buffer", 0) != 0:
        raise ValueError("Unexpected accessor encoding")
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", np.dtype(dtype).itemsize * components)
    return np.ndarray((accessor["count"], components), dtype=dtype,
                      buffer=binary, offset=offset,
                      strides=(stride, np.dtype(dtype).itemsize))


def trim(source, destination):
    doc, binary = unpack(source.read_bytes())
    if len(doc["meshes"]) != 1 or len(doc["meshes"][0]["primitives"]) != 1:
        raise ValueError("Unexpected CC0 source shape")
    primitive = doc["meshes"][0]["primitives"][0]
    points = accessor_data(doc, binary, primitive["attributes"]["POSITION"], 3, "<f4")
    accessor = doc["accessors"][primitive["indices"]]
    if accessor["componentType"] not in (5123, 5125):
        raise ValueError("Unexpected index type")
    dtype = "<u2" if accessor["componentType"] == 5123 else "<u4"
    triangles = accessor_data(doc, binary, primitive["indices"], 1, dtype).reshape(-1, 3)
    if not 10000 <= len(triangles) <= 13000 or len(points) < 8000:
        raise ValueError("Pinned source model has changed")
    # The authored rod's long axis is an upward diagonal in the original XY
    # plane. Support pole and dangling float are topologically disconnected
    # components extending far below that axis; the reel and cork aren't.
    parent = np.arange(len(points), dtype=np.int32)
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = int(parent[i])
        return i
    for a, b, c in triangles:
        root = find(int(a))
        parent[find(int(b))] = root
        parent[find(int(c))] = root
    components = np.fromiter((find(i) for i in range(len(points))),
                             dtype=np.int32, count=len(points))
    offset_to_rod = points[:, 1] - (0.40 * points[:, 0] + 0.374)
    lowest = np.full(len(points), np.inf, dtype=np.float32)
    np.minimum.at(lowest, components, offset_to_rod)
    keep = lowest[components[triangles[:, 0]]] >= -0.18
    removed = int((~keep).sum())
    if not 700 <= removed <= 1600:
        raise ValueError("Cannot safely identify the disconnected fishing stand")
    cleaned = np.asarray(triangles[keep].reshape(-1), dtype=dtype)
    appended = cleaned.tobytes()
    new_offset = len(binary)
    binary += appended
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)
    view_id = len(doc["bufferViews"])
    doc["bufferViews"].append({"buffer": 0, "byteOffset": new_offset,
                               "byteLength": len(appended), "target": 34963})
    accessor_id = len(doc["accessors"])
    doc["accessors"].append({"bufferView": view_id, "byteOffset": 0,
                             "componentType": accessor["componentType"],
                             "count": len(cleaned), "type": "SCALAR",
                             "min": [int(cleaned.min())], "max": [int(cleaned.max())]})
    primitive["indices"] = accessor_id
    doc["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    result = (struct.pack("<4sII", b"glTF", 2, total) +
              struct.pack("<I4s", len(encoded), b"JSON") + encoded +
              struct.pack("<I4s", len(binary), b"BIN\x00") + binary)
    if len(result) != total:
        raise AssertionError("GLB size mismatch")
    destination.write_bytes(result)
    assert unpack(destination.read_bytes())[0]["accessors"][accessor_id]["count"] == len(cleaned)
    print(f"AUTHORED_ROD_TRIM_OK: retained {int(keep.sum())} authored faces; "
          f"removed {removed} display-stand/line/float faces; PBR textures unchanged")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: trim_showroom_rod.py input.glb output.glb")
    trim(Path(sys.argv[1]), Path(sys.argv[2]))

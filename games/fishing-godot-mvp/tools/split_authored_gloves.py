#!/usr/bin/env python3
"""Separate two authored leather work gloves into reusable left/right GLBs.

The tevy source is a pair placed flat on a table. We preserve its original
texture coordinates and textured mesh surfaces and only separate connected
components. No game geometry is generated from shapes or procedural hands.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import trimesh

if len(sys.argv) != 4:
    raise SystemExit("usage: split_gloves.py pair.glb left.glb right.glb")

source = Path(sys.argv[1])
scene = trimesh.load(str(source), force="scene", process=False)
parts = []
for entry in scene.dump():
    if not isinstance(entry, trimesh.Trimesh):
        continue
    for component in entry.split(only_watertight=False):
        if len(component.faces) >= 3:
            parts.append(component)
if len(parts) < 2:
    raise RuntimeError(f"The authored pair does not contain two independent glove meshes: {len(parts)}")

# The two largest body components provide the centres; stitches, cuffs and
# seams get assigned to the closest body, preserving original PBR materials.
parts.sort(key=lambda part: part.area, reverse=True)
head_a = np.asarray(parts[0].bounds.mean(axis=0))
head_b = None
for candidate in parts[1:]:
    centre = np.asarray(candidate.bounds.mean(axis=0))
    if np.linalg.norm(centre - head_a) > 0.085:
        head_b = centre
        break
if head_b is None:
    # All geometry was too close: this source cannot be automatically split
    # without risking faces cut through fingers.
    raise RuntimeError("Cannot safely split the two CC0 glove meshes")
heads = [head_a, head_b]
groups = [[], []]
for part in parts:
    center = np.asarray(part.bounds.mean(axis=0))
    distances = [np.linalg.norm(center - head) for head in heads]
    groups[int(np.argmin(distances))].append(part)

# Detect the axis separating the gloves, so file names match the source layout.
dominant = int(np.argmax(np.abs(heads[0] - heads[1])))
left_index = 0 if heads[0][dominant] < heads[1][dominant] else 1
for name, group in [("left", groups[left_index]), ("right", groups[1 - left_index])]:
    target = Path(sys.argv[2] if name == "left" else sys.argv[3])
    combined_bounds = np.array([part.bounds for part in group])
    lower = combined_bounds[:, 0].min(axis=0)
    upper = combined_bounds[:, 1].max(axis=0)
    center = (lower + upper) * 0.5
    output = trimesh.Scene()
    face_count = 0
    for i, part in enumerate(group):
        fragment = part.copy()
        fragment.apply_translation(-center)
        output.add_geometry(fragment, node_name=f"{name}_glove_part_{i}")
        face_count += len(fragment.faces)
    if face_count < 120:
        raise RuntimeError(f"Too few triangles in {name}: {face_count}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output.export(file_type="glb"))
    print(f"AUTHORED_GLOVE {name} triangles={face_count} bounds={(upper - lower).round(3)} bytes={target.stat().st_size}")

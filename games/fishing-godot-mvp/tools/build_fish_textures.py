#!/usr/bin/env python3
"""Reproducible game-ready 512px seamless fish-skin albedo/normal maps.
CC0 procedural artwork authored for this prototype; no AI sheet baked into fish UV.
Uses Pillow only; CI builds it before the Godot import.
"""
from __future__ import annotations
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets" / "textures"
ROOT.mkdir(parents=True, exist_ok=True)
W, H = 512, 512

SPECIES = {
    "crucian": {"back": (64, 64, 36), "side": (147, 122, 61), "belly": (202, 185, 140), "fin": (99, 64, 38)},
    "perch": {"back": (32, 54, 36), "side": (107, 132, 69), "belly": (174, 170, 118), "fin": (180, 89, 33)},
    "pike": {"back": (40, 61, 36), "side": (112, 123, 68), "belly": (204, 202, 159), "fin": (123, 86, 42)},
}

def mix(a, b, amount):
    return a * (1 - amount) + b * amount

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def noise(x, y):
    return (
        math.sin(x * 72.3 + y * 9.7) * 0.33 +
        math.sin(x * 122.9 - y * 64.5) * 0.22 +
        math.sin(x * 262.4 + y * 161.0) * 0.15 +
        math.sin(x * 532.3 - y * 287.2) * 0.09
    )

for name, palette in SPECIES.items():
    diffuse = Image.new("RGB", (W, H))
    normal = Image.new("RGB", (W, H))
    pix = diffuse.load()
    npx = normal.load()
    for j in range(H):
        v = j / H
        elevation = math.cos(v * math.tau)  # top +1; belly -1
        for i in range(W):
            u = i / W
            # Correct anatomical dorsum/side/belly colors around the circumference.
            if elevation >= 0.2:
                t = clamp((elevation - 0.2) / 0.8, 0, 1)
                base = tuple(mix(palette["side"][k], palette["back"][k], t) for k in range(3))
            else:
                t = clamp((0.2 - elevation) / 1.2, 0, 1)
                base = tuple(mix(palette["side"][k], palette["belly"][k], t) for k in range(3))

            # Scales overlap like roof tiles; stagger alternate rows. The ridge
            # and local highlights create visible detail on mobile at close zoom.
            row = int(v * 38)
            shift = 0.5 if row % 2 else 0.0
            fx = ((u * 42 + shift) % 1.0) - 0.5
            fy = (v * 38) % 1.0
            arc = fy - (0.28 + 1.45 * fx * fx)
            boundary = math.exp(-((arc / 0.095) ** 2))
            upper_gloss = math.exp(-(((fy - 0.68) / 0.22) ** 2)) * 0.42
            texture = noise(u, v)
            stripe = 0.0
            spot = 0.0
            if name == "perch":
                band_wave = math.sin(u * 35.5 + 1.3 * math.sin(v * 9.0))
                stripe = (clamp((band_wave - 0.25) * 2.1, 0, 1)
                          * clamp((elevation + 0.24) * 0.9, 0, 1) * 0.46)
            elif name == "pike":
                dots = math.sin(u * 87.0) * math.sin(v * 109.0 + 0.7 * math.sin(u * 33))
                spot = clamp((dots - 0.34) * 3.4, 0, 1) * clamp(1.0 - abs(elevation) * 0.65, 0, 1)
            else:
                stripe = clamp((math.sin(u * 7.0) - 0.3) * 0.24, 0, 0.18)

            shine = 7.0 * upper_gloss - 22.0 * boundary + 12.0 * texture
            out = []
            for k in range(3):
                channel = base[k] * (1 - stripe) + palette["belly"][k] * spot * 0.66
                channel += shine
                out.append(int(clamp(channel, 0, 255)))
            pix[i, j] = tuple(out)

            # Tangent space normal with coarse scale ridge and fine pebbled relief.
            ridge = (boundary * 0.35 + 0.65 * noise(u * 1.01, v * 1.01))
            nx = clamp(0.5 + math.sin(u * math.tau * 42) * 0.10 + fx * boundary * 0.18, 0, 1)
            ny = clamp(0.5 + math.sin(v * math.tau * 38) * 0.11 + ridge * 0.05, 0, 1)
            nz = math.sqrt(max(0.0, 1 - (nx * 2 - 1) ** 2 - (ny * 2 - 1) ** 2))
            npx[i, j] = (int(nx * 255), int(ny * 255), int(nz * 255))
    for texture, kind in ((diffuse, "albedo"), (normal, "normal")):
        out = ROOT / f"fish_{name}_{kind}.png"
        texture.save(out, optimize=True)
        print(name, kind, out.stat().st_size, "bytes")

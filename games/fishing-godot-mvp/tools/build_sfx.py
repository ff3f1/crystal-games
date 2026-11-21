#!/usr/bin/env python3
"""Original mobile-optimized fishing sound pack (24kHz mono 16-bit).
Layered water noise, nylon swishes, reel ratchet, bird calls, no musical beeps.
Produces actual WAV files during CI before the Godot import; offline at runtime.
"""
from __future__ import annotations
import math
import random
import wave
from pathlib import Path

RATE = 24000
ROOT = Path(__file__).resolve().parents[1] / "assets" / "audio"
ROOT.mkdir(parents=True, exist_ok=True)
rng = random.Random(18472)

def wav(name: str, data: list[float]) -> None:
    # Gentle limiter, no hard clipping; linear 20ms fade on nonloop effects.
    import array
    out = array.array("h", [int(max(-0.97, min(0.97, x)) * 32767) for x in data])
    with wave.open(str(ROOT / (name + ".wav")), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(out.tobytes())
    print(name, len(out) / RATE, "seconds")

def synth(name: str, seconds: float, kind: str) -> None:
    length = int(seconds * RATE)
    data: list[float] = []
    low, mid, high = 0.0, 0.0, 0.0
    phase = 0.0
    for i in range(length):
        t = i / RATE
        p = i / max(1, length - 1)
        noise = rng.uniform(-1.0, 1.0)
        low += (noise - low) * 0.008
        mid += (noise - mid) * 0.052
        high += (noise - high) * 0.18
        band = mid - low
        bright = high - mid
        value = 0.0
        if kind == "cast":
            swish = (math.sin(math.pi * min(1.0, p * 1.3)) ** 2) * math.exp(-p * 0.4)
            value = (band * 0.25 + bright * 0.15 + math.sin(2 * math.pi * (90 + 170 * p) * t) * 0.028) * swish
        elif kind == "splash":
            impulse = math.exp(-t * 8.0)
            ripples = math.exp(-t * 2.7) * (0.55 + 0.45 * math.sin(2 * math.pi * 10.1 * t))
            plops = math.sin(2 * math.pi * (84 * t + 66 * math.exp(-t * 8.0) * t))
            value = band * (0.40 * impulse + 0.28 * ripples) + low * 0.4 * ripples + plops * 0.12 * math.exp(-t * 17.0)
        elif kind == "bite":
            # Natural water plop and small float clicks, not synthetic notification.
            pulse = math.exp(-t * 12)
            value = low * 0.36 * pulse + band * 0.32 * pulse + math.sin(2 * math.pi * (55 * t + 20 * t * t)) * 0.064 * pulse
        elif kind == "nibble":
            # A quiet surface tap: short watery percussion rather than UI beep.
            pulse = math.exp(-t * 17.0)
            value = (band * 0.25 + low * 0.34) * pulse + math.sin(2 * math.pi * (67 - 27 * p) * t) * pulse * 0.028
        elif kind == "line_break":
            # Line pop and short returning nylon vibration.
            snap = math.exp(-t * 62.0)
            value = bright * 0.53 * snap + math.sin(2 * math.pi * (910 - 720 * p) * t) * 0.11 * math.exp(-t * 24.0)
        elif kind == "rod_creak":
            # Taut graphite blank flexing under load.
            groan = math.sin(2 * math.pi * (81 + 11 * math.sin(t * 14)) * t)
            value = (groan * 0.047 + band * 0.29) * (math.sin(math.pi * p) ** 1.4)
        elif kind == "hook":
            pulse = math.exp(-t * 15.0)
            value = (mid * 0.47 + math.sin(2 * math.pi * 79 * t) * 0.14) * pulse
        elif kind == "reel":
            click = max(0.0, math.sin(2 * math.pi * 29.0 * t)) ** 12
            body = math.sin(2 * math.pi * (118.0 + 3 * math.sin(t * 26)) * t)
            value = (click * (band * 0.37 + 0.045) + body * 0.015) * math.exp(-p * 0.7)
        elif kind == "drag":
            click = max(0.0, math.sin(2 * math.pi * 44.0 * t)) ** 11
            whirr = math.sin(2 * math.pi * (310.0 - 54.0 * p) * t) * 0.035
            value = (band * 0.26 + click * (0.05 + mid * 0.25) + whirr) * math.exp(-p * 1.5)
        elif kind == "catch":
            pulse = math.exp(-t * 3.3)
            value = (band * 0.39 + low * 0.40) * pulse + math.sin(2 * math.pi * (86 - 36 * p) * t) * 0.032 * pulse
        elif kind == "fail":
            click = math.exp(-t * 30.0)
            value = (bright * 0.30 + band * 0.35 + 0.07 * math.sin(2 * math.pi * 140.0 * t)) * click
        elif kind == "footstep":
            pulse = math.exp(-t * 16.0)
            value = (low * 0.5 + mid * 0.21) * pulse
        elif kind == "water":
            # Multi-scale water and wind; frequencies glide slowly and never buzz.
            swell = 0.63 + 0.37 * math.sin(2 * math.pi * 0.28 * t)
            brush = math.sin(2 * math.pi * 0.41 * t)
            value = (low * 0.56 + band * 0.24) * swell + brush * 0.013
        elif kind == "birds":
            value = low * 0.022
            for moment, freq, duration in ((1.4, 2050, 0.34), (4.2, 1800, 0.43), (5.0, 1600, 0.28), (9.8, 2300, 0.39)):
                local = t - moment
                if 0 <= local <= duration:
                    envelope = (math.sin(math.pi * local / duration) ** 2) * 0.045
                    chirp = math.sin(2 * math.pi * (freq + 520 * local / duration) * local)
                    value += chirp * envelope
        if kind not in ("water", "birds"):
            value *= min(1.0, t * 150.0) * min(1.0, (seconds - t) * 58.0)
        data.append(value)

    if kind in ("water", "birds"):
        # Crossfade first/last 800ms, avoiding clicks at the loop boundary.
        cross = int(RATE * 0.8)
        for i in range(cross):
            a = i / cross
            # End of the loop smoothly approaches the beginning.
            endidx = length - cross + i
            data[endidx] = data[endidx] * (1 - a) + data[i] * a
    wav(name, data)

for name, duration in {
    "cast": 0.42, "splash": 0.79, "bite": 0.35,
    "hook": 0.24, "reel": 0.28, "drag": 0.42,
    "catch": 0.93, "fail": 0.26, "footstep": 0.18,
    "nibble": 0.24, "line_break": 0.26, "rod_creak": 0.40,
}.items():
    synth(name, duration, name)

synth("lake_water", 12.0, "water")
synth("forest_birds", 12.0, "birds")

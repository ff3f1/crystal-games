"""Собирает архив набора для ComfyUI: python3 tools/make_comfy_kit.py <куда_положить.zip>"""
import os, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, "tools", "comfy_kit")
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "fishing_comfy_kit.zip")
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for f in ("START.bat", "README_RU.txt", "kit.py"):
        z.write(os.path.join(K, f), "fishing_comfy_kit/" + f)
    z.write(os.path.join(ROOT, "tools", "fish_assets.json"), "fishing_comfy_kit/fish_assets.json")
print(dst, os.path.getsize(dst) // 1024, "КБ")

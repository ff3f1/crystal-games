"""Принять архивы из набора для ComfyUI и подключить ассеты к игре.

  python3 tools/fish_import.py fishing_images.zip [fishing_music.zip]

Распаковывает в tools/raw_assets и запускает tools/fish_process.py (вырезание фона, webp, assets.js)."""
import os, sys, zipfile, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tools", "raw_assets")

n = 0
for path in sys.argv[1:]:
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.endswith("/") or ".." in name:
                continue
            if name.startswith("images/"):
                dst = os.path.join(RAW, name[len("images/"):])
            elif name.startswith("audio/"):
                dst = os.path.join(RAW, "audio", os.path.basename(name))
            else:
                dst = os.path.join(RAW, "_" + os.path.basename(name))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "wb") as f:
                f.write(z.read(name))
            n += 1
print("распаковано файлов:", n)
subprocess.run([sys.executable, os.path.join(ROOT, "tools", "fish_process.py")], check=True)

"""Обработка сгенерированных ассетов и подключение их к игре.

  python tools/fish_process.py

Берёт tools/raw_assets (картинки из fish_generate.py, музыку из ACE-Step в tools/raw_assets/audio),
убирает фон у рыб и иконок, обрезает, сжимает в webp и пишет games/fish/assets/assets.js.
Нужен Pillow (есть в Python у ComfyUI). Если установлен rembg — фон вырезается нейросетью, иначе — по цвету.
Настройки (разворот спрайтов, линия воды на фонах) — tools/fish_tuning.json.
"""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tools", "raw_assets")
OUT = os.path.join(ROOT, "games", "fish", "assets")
MAN = json.load(open(os.path.join(ROOT, "tools", "fish_assets.json"), encoding="utf-8"))
TUNE_PATH = os.path.join(ROOT, "tools", "fish_tuning.json")
TUNE = json.load(open(TUNE_PATH, encoding="utf-8")) if os.path.exists(TUNE_PATH) else {"flip": {}, "waterline": {}}

try:
    from rembg import remove as rembg_remove
except Exception:
    rembg_remove = None


def cut_by_color(im):
    """Фон заливкой от краёв: всё, что связано с краем и близко по цвету к фону, становится прозрачным."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    mark = (255, 0, 255)
    work = rgb.copy()
    pts = [(x, 0) for x in range(0, w, 24)] + [(x, h - 1) for x in range(0, w, 24)] + [(0, y) for y in range(0, h, 24)] + [(w - 1, y) for y in range(0, h, 24)]
    for p in pts:
        if work.getpixel(p) != mark:
            ImageDraw.floodfill(work, p, mark, thresh=22)
    diff = ImageChops.difference(work, Image.new("RGB", (w, h), mark)).convert("L")
    alpha = diff.point(lambda v: 255 if v > 8 else 0)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def cutout(im):
    if rembg_remove:
        try:
            return rembg_remove(im.convert("RGBA"))
        except Exception as e:
            print("  rembg не сработал (%s), режу по цвету" % e)
    return cut_by_color(im)


def trim(im, margin=0.03):
    a = im.split()[-1].point(lambda v: 255 if v > 12 else 0)
    box = a.getbbox()
    if not box:
        return im
    m = int(max(im.size) * margin)
    box = (max(0, box[0] - m), max(0, box[1] - m), min(im.width, box[2] + m), min(im.height, box[3] + m))
    return im.crop(box)


def main():
    images, audio = {}, {}
    total = 0
    for it in MAN["images"]:
        key = it["key"]
        src = os.path.join(RAW, key + ".png")
        if not os.path.exists(src):
            continue
        im = Image.open(src)
        group, name = key.split("/")
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        if group == "ui":
            dst = os.path.join(OUT, group, name + ".png")
            im.convert("RGB").save(dst)
            print("ui:", name)
            continue
        if group == "bg":
            im = im.convert("RGB")
            if im.width != 1024:
                im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
            dst = os.path.join(OUT, group, name + ".webp")
            im.save(dst, "WEBP", quality=82, method=6)
        else:
            im = trim(cutout(im))
            if TUNE.get("flip", {}).get(key):
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if group == "fish":
                if im.width > 720:
                    im = im.resize((720, round(im.height * 720 / im.width)), Image.LANCZOS)
            else:
                im.thumbnail((256, 256), Image.LANCZOS)
                sq = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
                sq.paste(im, ((256 - im.width) // 2, (256 - im.height) // 2), im)
                im = sq
            dst = os.path.join(OUT, group, name + ".webp")
            im.save(dst, "WEBP", quality=88, method=6)
        images[key] = group + "/" + os.path.basename(dst)
        total += os.path.getsize(dst)
        print("%-24s %s" % (key, "%d КБ" % (os.path.getsize(dst) // 1024)))

    # музыка из ACE-Step
    adir = os.path.join(RAW, "audio")
    ff = shutil.which("ffmpeg")
    if os.path.isdir(adir):
        os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
        for f in sorted(os.listdir(adir)):
            stem, ext = os.path.splitext(f)
            ext = ext.lower()
            if ext not in (".mp3", ".ogg", ".wav", ".flac", ".m4a"):
                continue
            src = os.path.join(adir, f)
            if ext in (".mp3", ".ogg"):
                dst = os.path.join(OUT, "audio", stem + ext)
                shutil.copyfile(src, dst)
            elif ff:
                dst = os.path.join(OUT, "audio", stem + ".mp3")
                subprocess.run([ff, "-y", "-loglevel", "error", "-i", src, "-b:a", "128k", dst], check=True)
            else:
                print("  %s: нет ffmpeg для сжатия, кладу как есть" % f)
                dst = os.path.join(OUT, "audio", f)
                shutil.copyfile(src, dst)
            audio[stem] = "audio/" + os.path.basename(dst)
            total += os.path.getsize(dst)
            print("%-24s %d КБ" % ("audio/" + stem, os.path.getsize(dst) // 1024))

    tuning = {"waterline": {k: v for k, v in TUNE.get("waterline", {}).items() if k in images}}
    js = "/* Создано tools/fish_process.py — не правьте вручную */\nwindow.FZ_ASSETS = " + json.dumps({"images": images, "audio": audio, "tuning": tuning}, ensure_ascii=False, indent=1) + ";\n"
    open(os.path.join(OUT, "assets.js"), "w", encoding="utf-8").write(js)
    print("\nПодключено картинок: %d, музыки: %d, всего %.1f МБ" % (len(images), len(audio), total / 1048576))
    if not rembg_remove:
        print("Совет: pip install rembg — фон у рыб будет вырезаться аккуратнее.")


if __name__ == "__main__":
    main()

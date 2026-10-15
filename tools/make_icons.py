"""Рисует иконки игр (магазинная 512x512 и mipmap для Android)."""
import math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
S = 1024


def bg(c1, c2):
    im = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(c1, c2)))
    return im


def glow(im, xy, r, color):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([xy[0] - r, xy[1] - r, xy[0] + r, xy[1] + r], fill=color)
    g = g.filter(ImageFilter.GaussianBlur(r * 0.45))
    im.paste(g, (0, 0), g)


def block(d, x, y, s, top, bot):
    p = int(s * 0.05)
    for i in range(s - 2 * p):
        t = i / (s - 2 * p)
        col = tuple(int(a + (b - a) * t) for a, b in zip(top, bot))
        d.line([(x + p, y + p + i), (x + s - p, y + p + i)], fill=col)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([p, p, s - p, s - p], radius=int(s * 0.18), fill=255)
    return mask


def blocks_icon():
    im = bg((52, 40, 120), (18, 14, 48)).convert("RGBA")
    glow(im, (512, 512), 380, (140, 120, 255, 120))
    cols = [((255, 107, 125), (217, 44, 79)), ((255, 224, 102), (232, 180, 0)), ((94, 224, 138), (31, 168, 80)),
            ((79, 216, 240), (21, 155, 196)), ((124, 140, 255), (65, 80, 224)), ((208, 124, 255), (154, 53, 224))]
    layout = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (2, 1, 3), (1, 1, 1), (2, 2, 3), (1, 2, 4), (0, 2, 5), (2, 0, 2)]
    s, ox, oy = 230, 512 - 345, 512 - 345
    for c, r, ci in layout:
        tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile)
        top, bot = cols[ci]
        for i in range(s):
            t = i / s
            td.line([(0, i), (s, i)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bot)) + (255,))
        ov = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        od.rounded_rectangle([s * .18, s * .14, s * .82, s * .3], radius=s * .08, fill=(255, 255, 255, 95))
        od.rectangle([0, s * .8, s, s], fill=(0, 0, 0, 45))
        tile.alpha_composite(ov)
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([12, 12, s - 12, s - 12], radius=int(s * .18), fill=255)
        im.paste(tile, (ox + c * s, oy + r * s), mask)
    return im


def mine_icon():
    im = bg((25, 90, 140), (8, 23, 42)).convert("RGBA")
    glow(im, (512, 500), 400, (90, 200, 255, 140))
    cx, cy, R = 512, 520, 360
    pts = []
    for i in range(8):
        a = i / 8 * 2 * math.pi - math.pi / 2
        k = 0.78 if i % 2 else 1
        pts.append((cx + math.cos(a) * R * k, cy + math.sin(a) * R * k))
    d = ImageDraw.Draw(im)
    for i in range(8):
        a, b = pts[i], pts[(i + 1) % 8]
        l = [200, 150, 230, 120, 180, 140, 210, 165][i]
        d.polygon([(cx, cy), a, b], fill=(int(l * .35), int(l * .85), 255, 255), outline=(220, 245, 255, 200))
    inner = [(cx + (x - cx) * .45, cy + (y - cy) * .45) for x, y in pts]
    over = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(over).polygon(inner, fill=(255, 255, 255, 70))
    glare = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(glare).polygon([(cx - 230, cy - 400), (cx - 110, cy - 400), (cx - 290, cy + 400), (cx - 410, cy + 400)], fill=(255, 255, 255, 60))
    clip = Image.new("L", im.size, 0)
    ImageDraw.Draw(clip).polygon(pts, fill=255)
    over.paste(glare, (0, 0), Image.composite(glare.getchannel("A"), Image.new("L", im.size, 0), clip))
    im.alpha_composite(over)
    # искры
    sp = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sp)
    for x, y, r in [(820, 230, 46), (200, 790, 34), (860, 820, 28), (230, 250, 24)]:
        sd.polygon([(x, y - r), (x + r * .28, y - r * .28), (x + r, y), (x + r * .28, y + r * .28), (x, y + r),
                    (x - r * .28, y + r * .28), (x - r, y), (x - r * .28, y - r * .28)], fill=(255, 240, 190, 255))
    im.alpha_composite(sp)
    return im


def save(name, im):
    out = os.path.join(ROOT, "store", name, "icons")
    os.makedirs(out, exist_ok=True)
    rgb = im.convert("RGB")
    rgb.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon_512.png"))
    for k, px in SIZES.items():
        rgb.resize((px, px), Image.LANCZOS).save(os.path.join(out, f"ic_launcher_{k}.png"))


save("block", blocks_icon())
save("idle", mine_icon())
print("ok")

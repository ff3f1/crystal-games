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


def path_icon():
    im = bg((47, 143, 230), (124, 201, 255)).convert("RGBA")
    sun = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for k in range(300, 0, -6):
        a = int(150 * (1 - k / 300) ** 1.6)
        ImageDraw.Draw(sun).ellipse([180 - k, 150 - k, 180 + k, 150 + k], fill=(255, 246, 200, a))
    im.alpha_composite(sun)
    d = ImageDraw.Draw(im)
    # холмы
    for b, col, a in [(.80, (95, 191, 106), 60), (.90, (47, 138, 71), 40)]:
        pts = [(0, S)] + [(x, S * b - math.sin(x / S * 5) * a) for x in range(0, S + 20, 20)] + [(S, S)]
        d.polygon(pts, fill=col + (255,))
    # радужная линия
    pts = [(150, 330), (330, 470), (520, 600), (700, 690)]
    seg = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(30):
            t = k / 30; seg.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    seg.append(pts[-1])
    import colorsys
    for i in range(len(seg) - 1):
        r, g, b = colorsys.hsv_to_rgb(i / len(seg) * .85, .85, 1)
        d.line([seg[i], seg[i + 1]], fill=(int(r * 255), int(g * 255), int(b * 255), 255), width=58)
    for p, h in ((seg[0], 0), (seg[-1], .85)):
        r, g, b = colorsys.hsv_to_rgb(h, .85, 1)
        d.ellipse([p[0] - 29, p[1] - 29, p[0] + 29, p[1] + 29], fill=(int(r * 255), int(g * 255), int(b * 255), 255))
    # корзина
    cx, by = 800, 900
    d.rectangle([cx - 150, by - 200, cx + 150, by], fill=(255, 215, 80, 90))
    d.line([(cx - 150, by - 210), (cx - 150, by), (cx + 150, by), (cx + 150, by - 210)], fill=(232, 165, 18, 255), width=40, joint="curve")
    for k in range(1, 4):
        d.line([(cx - 140, by - k * 52), (cx + 140, by - k * 52)], fill=(200, 130, 10, 140), width=10)
    # шарик
    bx, byy, r = 300, 255, 120
    ball = Image.new("RGBA", im.size, (0, 0, 0, 0)); bd = ImageDraw.Draw(ball)
    for k in range(r, 0, -2):
        t = k / r
        bd.ellipse([bx - k, byy - k, bx + k, byy + k], fill=(int(47 + (191 - 47) * (1 - t)), int(143 + (240 - 143) * (1 - t)), 255, 255))
    bd.arc([bx - r * .7 + 20, byy - r * .7, bx + r * .7 + 20, byy + r * .7], 60, 200, fill=(255, 255, 255, 160), width=18)
    bd.ellipse([bx - 70, byy - 80, bx - 10, byy - 40], fill=(255, 255, 255, 200))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([bx - 70, byy + 108, bx + 120, byy + 140], fill=(0, 0, 0, 55))
    im.alpha_composite(sh); im.alpha_composite(ball)
    ImageDraw.Draw(im).ellipse([bx - r, byy - r, bx + r, byy + r], outline=(20, 70, 140, 120), width=8)
    # звезда
    sx, sy, R = 560, 330, 85
    st = [(sx + math.cos(i / 10 * 2 * math.pi - math.pi / 2) * (R if i % 2 == 0 else R * .45),
           sy + math.sin(i / 10 * 2 * math.pi - math.pi / 2) * (R if i % 2 == 0 else R * .45)) for i in range(10)]
    ImageDraw.Draw(im).polygon(st, fill=(255, 198, 26, 255), outline=(224, 137, 10, 255), width=10)
    return im


def save(name, im):
    out = os.path.join(ROOT, "store", name, "icons")
    os.makedirs(out, exist_ok=True)
    rgb = im.convert("RGB")
    rgb.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon_512.png"))
    for k, px in SIZES.items():
        rgb.resize((px, px), Image.LANCZOS).save(os.path.join(out, f"ic_launcher_{k}.png"))


save("block", blocks_icon())
save("path", path_icon())
print("ok")

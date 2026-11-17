"""Original app icon; no external images. Requires Pillow."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
N = 1024
im = Image.new('RGB', (N, N)); pixels = im.load()
for y in range(N):
    for x in range(N):
        r = math.hypot((x - 350) / 1100, (y - 300) / 1100)
        pixels[x, y] = (int(38 - 17*r), int(44 - 18*r), int(77 - 30*r))
shape = Image.new('RGBA', (N, N)); draw = ImageDraw.Draw(shape)
draw.ellipse((170,170,854,854), outline=(177,164,224,65), width=3)
draw.ellipse((130,130,894,894), outline=(177,164,224,25), width=2)
draw.polygon([(512,160),(742,385),(655,710),(512,855),(369,710),(282,385)], fill='#a6ead5')
draw.polygon([(512,160),(512,855),(282,385)], fill='#76bcb4')
draw.polygon([(512,160),(742,385),(512,470)], fill='#d6fae8')
draw.polygon([(512,470),(742,385),(512,855)], fill='#99d6cc')
draw.line([(512,160),(426,385),(512,855),(600,385),(512,160)], fill='#f2fff390', width=5)
draw.line([(282,385),(742,385)], fill='#f2fff390', width=4)
draw.polygon([(785,164),(795,192),(823,202),(795,212),(785,240),(775,212),(747,202),(775,192)], fill='#e9c897')
draw.ellipse((232,732,244,744), fill='#c6b2eb')
im = Image.alpha_composite(im.convert('RGBA'), shape.filter(ImageFilter.GaussianBlur(35)))
im = Image.alpha_composite(im, shape).resize((512,512), Image.Resampling.LANCZOS)
for path in ['app/src/main/res/drawable-nodpi/ic_launcher.png', 'app/src/main/assets/assets/icon.png']:
    im.save(ROOT/path)

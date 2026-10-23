"""Иконка «Рыбалка: Клюёт!» — рисуется теми же функциями, что и рыбы в игре.
Если есть сгенерированная games/fish/assets/ui/icon.png (1024×1024) — берётся она.
Запуск: python3 tools/fish_icon.py"""
import os, base64, io
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(ROOT, "games", "fish")
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

DRAW = r"""
() => {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), U = FZ.U;
  const sky = g.createLinearGradient(0, 0, 0, 600); sky.addColorStop(0, '#1d6672'); sky.addColorStop(1, '#f2b46a');
  g.fillStyle = sky; g.fillRect(0, 0, S, 600);
  const sun = g.createRadialGradient(300, 470, 20, 300, 470, 420); sun.addColorStop(0, 'rgba(255,236,190,1)'); sun.addColorStop(0.18, 'rgba(255,214,140,0.85)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = sun; g.fillRect(0, 0, S, 620);
  // дальний лес
  g.fillStyle = '#21423a';
  g.beginPath(); g.moveTo(0, 600);
  for (let x = 0; x <= S; x += 16) g.lineTo(x, 560 - Math.abs(Math.sin(x * 0.045)) * 34 - Math.sin(x * 0.013) * 18);
  g.lineTo(S, 600); g.fill();
  // вода
  const w = g.createLinearGradient(0, 600, 0, S); w.addColorStop(0, '#2c6f78'); w.addColorStop(1, '#0e2e33');
  g.fillStyle = w; g.fillRect(0, 600, S, S - 600);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { const y = 610 + Math.pow(i / 26, 1.4) * 400; g.fillStyle = 'rgba(255,210,150,' + (0.5 - i / 60) + ')'; g.fillRect(300 - (20 + i * 9) / 2 + Math.sin(i * 3) * 18, y, 20 + i * 9, 3 + i * 0.4); }
  g.globalCompositeOperation = 'source-over';
  // круги на воде
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 7;
  [[560, 700, 230], [560, 700, 150]].forEach(r => { g.beginPath(); g.ellipse(r[0], r[1], r[2], r[2] * 0.26, 0, 0, Math.PI * 2); g.stroke(); });
  // окунь в прыжке
  g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 30; g.shadowOffsetY = 16;
  FZ.Art.drawFish(g, FZ.SP.perch, 560, 470, 760, { roll: -0.42, amp: 0.35, phase: 2.1 });
  g.restore();
  // брызги
  const r = U.rng('icon');
  for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + r.range(-1.3, 1.3), d = r.range(60, 300); g.fillStyle = 'rgba(235,248,252,' + r.range(0.6, 0.95) + ')'; g.beginPath(); g.arc(560 + Math.cos(a) * d * 1.3, 690 + Math.sin(a) * d * 0.7, r.range(5, 16), 0, Math.PI * 2); g.fill(); }
  // поплавок
  g.save(); g.translate(845, 880); g.rotate(0.12);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(0, 18, 90, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f7f5ee'; g.beginPath(); g.roundRect(-26, -150, 52, 170, 26); g.fill();
  g.fillStyle = '#ff4416'; g.beginPath(); g.roundRect(-26, -290, 52, 150, 26); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-26, -150, 52, 10);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-14, -275, 10, 120);
  g.restore();
  return c.toDataURL('image/png');
}
"""


def render():
    custom = os.path.join(G, "assets", "ui", "icon.png")
    if os.path.exists(custom):
        return Image.open(custom).convert("RGB").resize((1024, 1024), Image.LANCZOS)
    html = "<html><body><script>%s</script>" % "".join(
        open(os.path.join(G, "js", f), encoding="utf-8").read() + "\n" for f in ["util.js", "data.js", "fishart.js"])
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.set_content(html + "</body></html>")
        data = pg.evaluate(DRAW)
        b.close()
    return Image.open(io.BytesIO(base64.b64decode(data.split(",")[1]))).convert("RGB")


def main():
    im = render()
    out = os.path.join(ROOT, "store", "fish", "icons")
    os.makedirs(out, exist_ok=True)
    im.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon_512.png"))
    for k, px in SIZES.items():
        im.resize((px, px), Image.LANCZOS).save(os.path.join(out, f"ic_launcher_{k}.png"))
    print("ok:", out)


if __name__ == "__main__":
    main()

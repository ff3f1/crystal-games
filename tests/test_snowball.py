"""Автотест «Снежного кома»: автопилот проходит 2 уровня без ошибок. Запуск: python3 tests/test_snowball.py <папка>"""
import sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "games", "snowball", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
ARGS = ["--disable-gpu-rasterization", "--disable-partial-raster", "--disable-oop-rasterization"]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(ROOT, "tests", "snowball_auto.js"))
    for lv in range(2):
        pg.click("#bPlay")
        for i in range(160):
            pg.wait_for_timeout(500)
            if pg.evaluate("Game.state") != "run": break
        print("level", lv + 1, pg.evaluate("Game.state"), "mult", pg.evaluate("Game.mult"), "peak", round(pg.evaluate("Game.peak"), 2), "crashes", pg.evaluate("Game.crashes"))
        pg.wait_for_timeout(1300); pg.screenshot(path=f"{OUT}/sb_end{lv + 1}.png")
        if pg.is_visible("#bNext"): pg.click("#bNext")
        elif pg.is_visible("#bRetry"): pg.click("#bRetry")
        pg.wait_for_timeout(600)
    b.close()
print("errors:", errors[:10])
sys.exit(1 if errors else 0)

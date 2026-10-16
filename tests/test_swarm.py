"""Автотест «Звёздного роя»: запуск, первая планета на автопилоте, баланс уровней.
Запуск: python3 tests/test_swarm.py <папка_для_скриншотов>"""
import sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "games", "swarm", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(3000)
    pg.add_script_tag(path=os.path.join(ROOT, "tests", "swarm_auto.js"))
    assert pg.evaluate("Game.state") == "menu"
    pg.screenshot(path=f"{OUT}/s_menu.png")
    pg.click("#bPlay"); pg.wait_for_timeout(2500)
    assert pg.evaluate("Game.state") == "run"
    pg.evaluate("()=>{window.__autopilot=autoBrain}")
    for i in range(240):
        pg.wait_for_timeout(500)
        if pg.is_visible("#ovMut"): pg.click("#mOpts .mopt")
        if pg.is_visible("#ovResult"): break
    print("first planet:", pg.evaluate("Game.state"), "time", round(pg.evaluate("Game.world.t")))
    pg.screenshot(path=f"{OUT}/s_result.png")
    pg.click("#rNext"); pg.wait_for_timeout(2000)
    print("after:", pg.evaluate("Game.state"), "prog", pg.evaluate("Game.save().prog"), "light", pg.evaluate("Game.save().light"))
    pg.screenshot(path=f"{OUT}/s_galaxy.png")
    for s, pp, u in [(0, 4, 1), (2, 2, 4), (5, 2, 9), (7, 4, 15)]:
        print("sim", (s, pp, u), pg.evaluate("([s,p,u])=>simLevel(s,p,u)", [s, pp, u]))
    b.close()
print("errors:", errors[:10])
sys.exit(1 if errors else 0)

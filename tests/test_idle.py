import sys, time
from playwright.sync_api import sync_playwright

import os
URL = "file://" + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "games", "idle", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(500)
    print("daily shown:", pg.is_visible("#ovDaily"))
    pg.screenshot(path=f"{OUT}/idle_daily.png")
    pg.click("#bDaily"); pg.wait_for_timeout(300)
    c = pg.evaluate("__game.center()")
    box = pg.locator("#cv").bounding_box()
    for i in range(30):
        pg.mouse.click(box["x"] + c["cx"] + (i % 5 - 2) * 10, box["y"] + c["cy"])
    print("coins after 30 taps:", pg.evaluate("__game.S.coins"))
    # покупки через интерфейс
    for i in range(15):
        btns = pg.locator(".buy:not(.no)[data-a^='g']")
        if btns.count() == 0:
            btns = pg.locator(".buy:not(.no)")
        if btns.count() == 0:
            for k in range(20):
                pg.mouse.click(box["x"] + c["cx"], box["y"] + c["cy"])
            continue
        btns.first.click(); pg.wait_for_timeout(50)
    print("gens:", pg.evaluate("__game.S.gens"), "tapLv:", pg.evaluate("__game.S.tapLv"), "rate:", pg.evaluate("__game.rate()"))
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/idle_play.png")
    # проверка экономики: богатый игрок покупает всё по MAX
    pg.evaluate("__game.S.coins=1e12;__game.S.total=1e12")
    pg.click("#mult"); pg.click("#mult"); pg.click("#mult")  # MAX
    for i in range(40):
        btns = pg.locator(".buy:not(.no)[data-a^='g']")
        if btns.count() == 0: break
        btns.first.click(); pg.wait_for_timeout(30)
    print("after max buys gens:", pg.evaluate("__game.S.gens"), "coins>=0:", pg.evaluate("__game.S.coins>=0"))
    pg.click('[data-t="upg"]'); pg.wait_for_timeout(300)
    for i in range(30):
        btns = pg.locator(".buy:not(.no)")
        if btns.count() == 0: break
        btns.first.click(); pg.wait_for_timeout(30)
    print("upgrades bought:", pg.evaluate("Object.keys(__game.S.upgs).length"), "rate:", pg.evaluate("__game.rate()"))
    pg.screenshot(path=f"{OUT}/idle_upg.png")
    # буст за рекламу
    pg.click("#bBoost"); pg.wait_for_timeout(1600)
    print("boost active:", pg.evaluate("__game.S.boostUntil>Date.now()"))
    # перерождение
    pg.click('[data-t="pre"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/idle_pre.png")
    sh = pg.evaluate("__game.S.shards")
    pg.click("#bPre"); pg.click("#bPre"); pg.wait_for_timeout(1800)
    print("shards:", sh, "->", pg.evaluate("__game.S.shards"), "gens reset:", pg.evaluate("__game.S.gens.every(x=>x===0)"))
    # оффлайн-доход: имитируем 2 часа отсутствия
    pg.evaluate("__game.S.gens[0]=50;__game.S.last=Date.now()-7200e3;__game.checkOffline()")
    pg.wait_for_timeout(400)
    print("offline shown:", pg.is_visible("#ovOff"), pg.inner_text("#offAmt").replace("\n", " "))
    pg.screenshot(path=f"{OUT}/idle_offline.png")
    pg.click("#bOffAd"); pg.wait_for_timeout(1600)
    # золотой кристалл
    pg.evaluate("__game.S.coins")
    b.close()
print("ERRORS:", errors or "none")

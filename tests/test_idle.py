import sys, os
from playwright.sync_api import sync_playwright

URL = "file://" + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "games", "idle", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []
CLOSE = "document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(500)
    print("daily shown:", pg.is_visible("#ovDaily"))
    pg.click("#bDaily"); pg.wait_for_timeout(300)
    c = pg.evaluate("__game.center()"); box = pg.locator("#cv").bounding_box()
    tap = lambda: pg.mouse.click(box["x"] + c["cx"], box["y"] + c["cy"])
    for i in range(30): tap()
    print("coins after 30 taps:", round(pg.evaluate("__game.S.coins")))
    for i in range(20):
        btns = pg.locator(".buy:not(.no)[data-a^='g']")
        if btns.count() == 0: btns = pg.locator(".buy:not(.no)")
        if btns.count() == 0:
            for k in range(15): tap()
            continue
        btns.first.click(); pg.wait_for_timeout(40)
    print("gens:", pg.evaluate("__game.S.gens"), "rate:", pg.evaluate("__game.rate()"))
    # лихорадка
    for i in range(50): tap()
    print("fever active:", pg.evaluate("__game.fever") > 0, "fevers:", pg.evaluate("__game.S.st.fevers"))
    pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/i_fever.png")
    # глыба: победа
    pg.evaluate("__game.S.bossAt=0"); pg.wait_for_timeout(400)
    print("boss chip:", pg.locator("[data-c=boss]").count())
    pg.click("[data-c=boss]", force=True); pg.wait_for_timeout(300)
    for i in range(12): tap()
    pg.wait_for_timeout(200); pg.screenshot(path=f"{OUT}/i_boss.png")
    n = 0
    while pg.evaluate("!!__game.boss") and n < 200: tap(); n += 1
    pg.wait_for_timeout(400)
    print("boss beaten with taps:", n + 12, "reward card:", pg.is_visible("#mAd"), "bosses:", pg.evaluate("__game.S.st.bosses"))
    pg.screenshot(path=f"{OUT}/i_boss_win.png")
    pg.click("#mAd"); pg.wait_for_timeout(1500)
    # глыба: поражение по времени
    pg.evaluate("__game.S.bossAt=0;__game.startBoss();__game.boss.end=Date.now()+300"); pg.wait_for_timeout(900)
    print("boss fail card:", pg.is_visible("#mOk"), "boss gone:", pg.evaluate("!__game.boss"))
    pg.click("#mOk")
    # задания
    pg.click('[data-t="q"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/i_quests.png")
    claim = pg.locator(".buy.claim")
    print("quests claimable:", claim.count(), "qLevel:", pg.evaluate("__game.S.qLevel"))
    while pg.locator(".buy.claim").count():
        pg.locator(".buy.claim").first.click(); pg.wait_for_timeout(150)
    print("after claims qLevel:", pg.evaluate("__game.S.qLevel"), "quests:", pg.evaluate("__game.S.quests.length"))
    # улучшения
    pg.evaluate("__game.S.coins=5e7")
    pg.click('[data-t="upg"]'); pg.wait_for_timeout(300)
    for i in range(25):
        btns = pg.locator(".buy:not(.no)")
        if btns.count() == 0: break
        btns.first.click(); pg.wait_for_timeout(30)
    print("upgrades:", len(pg.evaluate("Object.keys(__game.S.upgs)")))
    pg.screenshot(path=f"{OUT}/i_upg.png")
    # миры: проходим все 5 и снимаем каждый
    for w in range(1, 5):
        pg.evaluate(f"__game.S.coins=[0,2e6,5e9,2e13,1e17][{w}]*1.01")
        pg.click('[data-t="w"]'); pg.wait_for_timeout(300)
        if w == 1: pg.screenshot(path=f"{OUT}/i_worlds.png")
        pg.click(f"[data-a=w{w}]"); pg.wait_for_timeout(1600)
        pg.evaluate(CLOSE)
        pg.evaluate("__game.S.gens[0]=30;__game.S.gens[1]=40;__game.S.gens[2]=5")
        pg.click('[data-t="gen"]'); pg.wait_for_timeout(500)
        for i in range(6): tap()
        pg.wait_for_timeout(150)
        pg.screenshot(path=f"{OUT}/i_world{w}.png")
        print("world", w, "->", pg.evaluate("__game.S.world"), "rate>0:", pg.evaluate("__game.rate()>0"))
    # перерождение
    pg.evaluate("__game.S.total=1e12"); pg.click('[data-t="w"]'); pg.wait_for_timeout(300)
    pg.click("#bPre"); pg.click("#bPre"); pg.wait_for_timeout(1500)
    print("prestige: world", pg.evaluate("__game.S.world"), "shards", pg.evaluate("__game.S.shards"), "maxWorld", pg.evaluate("__game.S.maxWorld"))
    pg.evaluate(CLOSE)
    # оффлайн
    pg.evaluate("__game.S.gens[0]=50;__game.S.last=Date.now()-7200e3;__game.checkOffline()"); pg.wait_for_timeout(300)
    print("offline:", pg.is_visible("#ovOff"), pg.inner_text("#offAmt").replace("\n", " "))
    pg.click("#bOffAd"); pg.wait_for_timeout(1500)
    # золотой кристалл
    pg.evaluate("__game.openGold()"); pg.wait_for_timeout(300); print("gold card:", pg.is_visible("#mAd"))
    pg.click("#mOk")
    # сохранение
    pg.evaluate("__game.save()"); w0 = pg.evaluate("__game.S.shards"); pg.reload(); pg.wait_for_timeout(500)
    print("reload keeps shards:", pg.evaluate("__game.S.shards") == w0)
    # маленький экран
    pg.set_viewport_size({"width": 360, "height": 640}); pg.evaluate(CLOSE); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/i_small.png")
    b.close()
print("ERRORS:", errors or "none")

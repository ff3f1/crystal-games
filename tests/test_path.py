import sys, os
from playwright.sync_api import sync_playwright

URL = "file://" + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "games", "path", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []
CLOSE = "document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(2600)
    pg.screenshot(path=f"{OUT}/p_menu.png")
    print("levels:", pg.evaluate("__game.LEVELS.length"))

    # Все уровни: эталонное решение проходит в настоящем игровом цикле
    res = pg.evaluate("""()=>__game.LEVELS.map((L,i)=>{const r=__game.simulate(L,L.sol,false);return r.status+':'+r.got})""")
    print("all levels via solution:", res.count("win:3"), "/", len(res), [ (i+1,r) for i,r in enumerate(res) if r!="win:3"])

    # Уровень 1: рисуем мышью эталонную линию
    pg.click("#bGo"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}/p_l1_tutorial.png")
    def to_screen(pt):
        return pg.evaluate("([x,y])=>{const c=document.getElementById('c');return [0,0]}", pt)
    sol = pg.evaluate("__game.LEVELS[0].sol")
    geo = pg.evaluate("()=>{__game.layout();return 0}")
    # координаты: берём из глобальных ox/oy/sc через вычисление в странице
    pts = pg.evaluate("""(sol)=>sol.map(st=>st.map(p=>[ox+p[0]*sc, oy+p[1]*sc]))""", sol)
    for st in pts:
        pg.mouse.move(*st[0]); pg.mouse.down()
        for a, c in zip(st, st[1:]):
            for k in range(1, 9): pg.mouse.move(a[0] + (c[0]-a[0])*k/8, a[1] + (c[1]-a[1])*k/8)
        pg.mouse.up()
    print("strokes drawn:", pg.evaluate("__game.strokes.length"), "points:", pg.evaluate("__game.strokes[0].length"))
    pg.screenshot(path=f"{OUT}/p_l1_drawn.png")
    pg.click("#bPlay"); pg.wait_for_timeout(900); pg.screenshot(path=f"{OUT}/p_l1_run.png")
    pg.wait_for_timeout(2600)
    print("win card:", pg.is_visible("#eNext"), "stars saved:", pg.evaluate("__game.stars[0]"))
    pg.screenshot(path=f"{OUT}/p_l1_win.png")
    pg.click("#eNext"); pg.wait_for_timeout(400); print("now level:", pg.evaluate("__game.li") + 1)

    # Проигрыш: пуск без линий, потом подсказка за рекламу
    pg.click("#bPlay"); pg.wait_for_timeout(3500)
    print("fail card:", pg.is_visible("#eAgain"))
    pg.screenshot(path=f"{OUT}/p_fail.png")
    pg.click("#eEdit"); pg.wait_for_timeout(300)
    pg.evaluate("__game.strokes=[[[10,40],[30,50]]]"); pg.click("#bPlay"); pg.wait_for_timeout(3500)
    pg.click("#eEdit"); pg.wait_for_timeout(300); print("edit keeps lines:", pg.evaluate("__game.strokes.length"))
    pg.evaluate("__game.play()"); pg.wait_for_timeout(3500)
    pg.click("#eAgain"); pg.wait_for_timeout(300); print("again clears lines:", pg.evaluate("__game.strokes.length"))
    pg.click("#bPlay"); pg.wait_for_timeout(3500); pg.screenshot(path=f"{OUT}/p_fail2.png")
    print("hint offered after 2 fails:", pg.is_visible("#eHint"))
    pg.click("#eHint"); pg.wait_for_timeout(1600); pg.screenshot(path=f"{OUT}/p_hint.png")
    print("hint saved:", pg.evaluate("JSON.parse(localStorage.getItem('dp_hinted'))"))
    # отмена/очистка
    pg.evaluate("__game.strokes=[[[10,40],[30,50]],[[40,60],[60,70]]]")
    pg.click("#bUndo"); print("after undo:", pg.evaluate("__game.strokes.length"))
    pg.click("#bClear"); print("after clear:", pg.evaluate("__game.strokes.length"))
    # пропуск уровня
    pg.click("#bSkip"); pg.wait_for_timeout(1600); print("after skip level:", pg.evaluate("__game.li") + 1)

    # Механики глав 2 и 3 вживую: прогоняем решения в игровом цикле и снимаем
    for i in [12, 17, 20, 21, 24, 29]:
        pg.evaluate(CLOSE)
        pg.evaluate(f"__game.startLevel({i});__game.strokes=JSON.parse(JSON.stringify(__game.LEVELS[{i}].sol))")
        pg.wait_for_timeout(200); pg.screenshot(path=f"{OUT}/p_lv{i+1}_a.png")
        pg.evaluate("__game.play()"); pg.wait_for_timeout(1400); pg.screenshot(path=f"{OUT}/p_lv{i+1}_b.png")
        pg.wait_for_timeout(5500)
        print(f"level {i+1} live result:", "win" if pg.is_visible("#eRetry") else ("fail" if pg.is_visible("#eAgain") else "running"))

    # Чернила: нельзя рисовать больше лимита
    pg.evaluate(CLOSE); pg.evaluate("__game.startLevel(0)")
    pg.mouse.move(60, 300); pg.mouse.down()
    for k in range(80): pg.mouse.move(60 + (k % 2) * 280, 300 + k * 4)
    pg.mouse.up()
    print("ink limit respected:", pg.evaluate("Math.round(__game.strokeLen(__game.strokes[0]))"), "<=", pg.evaluate("__game.LEVELS[0].ink"))

    # Карта уровней и скины
    pg.evaluate(CLOSE); pg.click("#bBack"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/p_map.png")
    pg.click(".bar [data-back]"); pg.wait_for_timeout(300)
    pg.click("#bSkins"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/p_skins.png")
    pg.locator(".sk").nth(3).click(); pg.wait_for_timeout(1600)
    print("skin selected:", pg.evaluate("localStorage.getItem('dp_skin')"))
    # Сохранение прогресса
    pg.reload(); pg.wait_for_timeout(600); print("progress after reload:", pg.evaluate("__game.stars.filter(Boolean).length"))
    # Широкий экран
    pg.set_viewport_size({"width": 1280, "height": 800}); pg.evaluate("__game.startLevel(4)"); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/p_wide.png")
    b.close()
print("ERRORS:", errors or "none")

"""Автотест «Рыбалка: Клюёт!»: полный цикл ловли, магазин, зима, отсутствие ошибок.
python3 tests/test_fish.py <папка_для_скриншотов>"""
import sys, os, functools, threading, http.server
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "."


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.join(ROOT, "games")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/fish/index.html"
errors, fails = [], []


def check(name, ok):
    print(("OK   " if ok else "FAIL ") + name)
    if not ok: fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1500)
    check("меню открыто", pg.is_visible("#mGo"))
    pg.click("#mGo"); pg.wait_for_timeout(400)

    # Заброс касанием воды
    pg.mouse.move(195, 470); pg.mouse.down(); pg.mouse.move(185, 460); pg.mouse.up()
    pg.wait_for_timeout(1500)
    check("заброс → ожидание", pg.evaluate("__game.G.rig().state") in ("wait", "bite"))
    # Обучающая поклёвка приходит быстро
    for _ in range(40):
        if pg.evaluate("__game.G.rig().state==='bite' && __game.G.rig().bite.phase==='take'"): break
        pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/f_bite.png")
    check("поклёвка", pg.evaluate("__game.G.rig().state") == "bite")
    pg.mouse.move(195, 640); pg.mouse.down(); pg.mouse.move(195, 540); pg.mouse.up()  # свайп вверх
    pg.wait_for_timeout(200)
    check("подсечка → вываживание", pg.evaluate("__game.G.rig().state") == "fight")
    pg.mouse.move(250, 650); pg.mouse.down()
    for _ in range(100):
        if pg.evaluate("__game.G.rig().state") != "fight": break
        pg.wait_for_timeout(150)
    pg.mouse.up(); pg.wait_for_timeout(1800)
    pg.screenshot(path=f"{OUT}/f_catch.png")
    check("карточка улова", pg.is_visible("#cKeep"))
    money0 = pg.evaluate("__game.G.state().money")
    pg.click("#cKeep"); pg.wait_for_timeout(300)
    check("деньги за улов", pg.evaluate("__game.G.state().money") > money0)
    check("рыба в атласе", pg.evaluate("Object.keys(__game.G.state().caught).length") == 1)

    # Магазин: покупка фидера, наживки
    pg.evaluate("__game.G.state().money=5000; __game.G.state().lvl=3; __game.UI.showShop('rod')"); pg.wait_for_timeout(300)
    pg.click("[data-buy='rod:d1']"); pg.wait_for_timeout(200)
    check("куплен фидер", "d1" in pg.evaluate("__game.G.state().rods"))
    pg.evaluate("__game.UI.closeSheet(); __game.G.setActive('feeder')")
    check("фидер в руках", pg.evaluate("__game.G.sess().mode") == "feeder")

    # Обрыв: натяжение больше теста лески
    pg.evaluate("__game.G.cast(0,20)"); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const G=__game.G,r=G.rig();r.state='bite';r.bite={s:FZ.SP.carp,w:9,style:'drag',phase:'take',t:0,touches:0,nextTouch:0,take:5,empty:false};const tu=G.state().tut;G.state().tut=2;G.strike();G.state().tut=tu;G.rig().fish.T=50;}""")
    pg.wait_for_timeout(400)
    check("обрыв и второй шанс", pg.is_visible("#lRev"))
    pg.click("#lRev"); pg.wait_for_timeout(1700)
    check("рыба вернулась после рекламы", pg.evaluate("__game.G.rig().state") == "fight")

    # Зима: лунка
    pg.evaluate("__game.G.rig().fish=null; __game.G.rig().state='idle'; __game.UI.travel('pond','winter')"); pg.wait_for_timeout(1500)
    check("зимой — режим лунки", pg.evaluate("__game.G.rig().state") == "nohole")
    pg.click("#bAct"); pg.wait_for_timeout(2800)
    check("лунка пробурена", pg.evaluate("__game.G.rig().state") == "wait")
    pg.screenshot(path=f"{OUT}/f_ice.png")

    # Карточка для шаринга рисуется
    ok = pg.evaluate("""()=>{const s=FZ.SP.pike;const c=FZ.Share.card({s,w:5.2,len:88,loc:'oka',date:'2026-10-23',trophy:false,record:true,newSpecies:false,pct:90});return c.width===1080&&c.toDataURL().length>50000}""")
    check("карточка улова 1080×1920", ok)
    # Сохранение переживает перезагрузку
    pg.evaluate("__game.G.save(true)"); pg.reload(); pg.wait_for_timeout(1500)
    check("сохранение", pg.evaluate("__game.G.state().rods.indexOf('d1')>=0"))
    b.close()

check("нет ошибок JS", not errors)
for e in errors[:5]: print("   ", e)
sys.exit(1 if fails else 0)

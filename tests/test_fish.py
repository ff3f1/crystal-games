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
    pg.wait_for_timeout(2200)
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
    check("улов записан в личный журнал", pg.evaluate("__game.G.state().journal.length===1 && __game.G.state().journal[0].kept===true"))
    pg.evaluate("__game.UI.showJournal('recent')")
    check("журнал показывает историю улова", pg.locator(".sheet").get_by_text("Журнал рыбака").count() > 0 and pg.locator(".sheet").get_by_text("В садок").count() > 0)
    pg.evaluate("__game.UI.showJournal('records')")
    check("журнал показывает личные рекорды", pg.locator(".sheet").get_by_text("Рекорды").count() > 0)
    pg.evaluate("__game.UI.showJournal('stats')")
    check("журнал показывает статистику", pg.locator(".sheet").get_by_text("Общий вес").count() > 0)
    pg.evaluate("__game.UI.closeSheet()")

    # Магазин: покупка фидера, наживки
    pg.evaluate("__game.G.state().money=5000; __game.G.state().lvl=3; __game.UI.showShop('rod')"); pg.wait_for_timeout(300)
    pg.click("[data-buy='rod:d1']"); pg.wait_for_timeout(200)
    check("куплен фидер", "d1" in pg.evaluate("__game.G.state().rods"))
    pg.evaluate("__game.UI.closeSheet(); __game.G.setActive('feeder')")
    check("фидер в руках", pg.evaluate("__game.G.sess().mode") == "feeder")

    # Второй шанс: детерминированная проверка восстановления после потери рыбы
    pg.evaluate("""()=>{const G=__game.G,r=G.rig();r.lost={canRevive:true,f:{revived:false,Fmax:30,T:30,phase:'run',phaseT:1,slackT:0,snagT:0,jump:null,S:.25,X:8,Z:22}};if(!G.revive())throw new Error('revive API returned false');}""")
    check("второй шанс возвращает рыбу в fight", pg.evaluate("__game.G.rig().state==='fight' && !!__game.G.rig().fish.revived && !__game.G.rig().lost"))


    # Зима: лунка
    pg.evaluate("__game.G.rig().fish=null; __game.G.rig().state='idle'; __game.UI.travel('pond','winter')"); pg.wait_for_timeout(1500)
    check("зимой — режим лунки", pg.evaluate("__game.G.rig().state") == "nohole")
    pg.click("#bAct"); pg.wait_for_timeout(2800)
    check("лунка пробурена", pg.evaluate("__game.G.rig().state") == "wait")
    pg.screenshot(path=f"{OUT}/f_ice.png")

    # Новые водоёмы, событие «Перволёд», достижения и экспедиция
    check("новые виды рыб загружены", pg.evaluate("!!FZ.SP.palia && !!FZ.SP.brooktrout && !!FZ.SP.nase && !!FZ.SP.sterlet && !!FZ.SP.chekhon && !!FZ.SP.rybets && !!FZ.SP.nelma && !!FZ.SP.muksun && !!FZ.SP.chir"))
    check("новые экспедиционные локации загружены", pg.evaluate("!!FZ.LOC.northstream && !!FZ.LOC.mountainlake"))
    check("новые регионы Дон и Полярье загружены", pg.evaluate("!!FZ.LOC.don && !!FZ.LOC.polar && FZ.LOC.don.lvl===22 && FZ.LOC.polar.lvl===28"))
    check("новые виды привязаны к водоёмам", pg.evaluate("FZ.LOC.don.fish.chekhon>0 && FZ.LOC.don.fish.rybets>0 && FZ.LOC.polar.fish.nelma>0 && FZ.LOC.polar.fish.muksun>0 && FZ.LOC.polar.fish.chir>0"))
    check("событие «Перволёд» по календарю", pg.evaluate("FZ.World.firstIceActive('winter',new Date('2026-11-20T12:00:00'))"))
    pg.evaluate("__game.G.state().lvl=17; __game.G.state().money=5000")
    trip_ok = pg.evaluate("__game.G.startExpedition('mountainlake',1)")
    check("экспедиция начинается", trip_ok is True and pg.evaluate("__game.G.sess().loc.id") == "mountainlake")
    pg.evaluate("__game.G.sess().hour=23.99; __game.G.update(1,0)")
    check("игровые сутки завершают экспедиционный день", pg.evaluate("__game.G.state().expedition.completed"))
    pg.evaluate("__game.G.returnExpedition()")
    check("возвращение из экспедиции", not pg.evaluate("__game.G.state().expedition.active") and pg.evaluate("__game.G.state().expeditionsCompleted") == 1)
    check("достижение первой поимки открыто", pg.evaluate("!!__game.G.state().achievements.first_catch"))

    # Мегаобновление 1.1: Камчатка, морские виды, приливы и трофейная кампания
    check("Камчатская бухта загружена", pg.evaluate("!!FZ.LOC.kamchatka && FZ.LOC.kamchatka.lvl===32 && FZ.LOC.kamchatka.style==='coast'"))
    check("пять новых морских видов загружены", pg.evaluate("!!FZ.SP.chinook && !!FZ.SP.coho && !!FZ.SP.sockeye && !!FZ.SP.halibut && !!FZ.SP.terpug"))
    check("морские фоны зарегистрированы", pg.evaluate("!!FZ.Assets.manifest.images['bg/kamchatka_spring'] && !!FZ.Assets.manifest.images['bg/kamchatka_winter']"))
    check("морское снаряжение зарегистрировано", pg.evaluate("!!FZ.ROD.s4 && !!FZ.ROD.d4 && !!FZ.LINE.l8 && !!FZ.BAIT.salmon_spinner && !!FZ.BAIT.deep_jig"))
    pg.evaluate("__game.G.startSession('kamchatka'); __game.G.sess().hour=3")
    check("прилив рассчитывается", pg.evaluate("__game.G.coastalTide().label==='Полная вода'"))
    pg.evaluate("__game.G.sess().hour=9")
    check("отлив рассчитывается", pg.evaluate("__game.G.coastalTide().label==='Малая вода'"))
    pg.evaluate("__game.G.startSession('pond'); __game.G.state().lvl=40; __game.G.state().loc='pond'")
    pg.evaluate("if(__game.G.acceptHunt('pond_intro')!==true)throw new Error('cannot accept first contract')")
    pg.evaluate("""()=>{const G=__game.G,r=G.rig();r.result={s:FZ.SP.crucian,w:.5,len:25,trophy:false,record:false,prevRecord:0,newSpecies:true,price:20,xp:10,mustRelease:false,expeditionFull:false,loc:'pond',pct:50,mode:'float',period:'day',date:'2026-11-16'};r.state='result';G.resolveCatch(true,false);}""")
    check("контракт закрывается уловом", pg.evaluate("__game.G.huntBoard().completed.indexOf('pond_intro')>=0 && __game.G.huntBoard().active===null"))
    check("контракт начисляет трофейный жетон", pg.evaluate("__game.G.huntBoard().tokens===1"))
    check("жетон обменивается на морскую приманку", pg.evaluate("__game.G.redeemHuntGear('salmon_spinner')===true && __game.G.state().lures.salmon_spinner===1"))
    pg.evaluate("__game.UI.showMenu()")
    check("в меню есть трофейная охота", pg.is_visible("#mHunts"))
    pg.click("#mHunts"); pg.wait_for_timeout(250)
    check("открывается доска контрактов", pg.locator(".sheet").get_by_text("Трофейная охота").count()>0 and pg.locator(".sheet").get_by_text("Волжская школа").count()>0)
    pg.evaluate("__game.UI.closeSheet(); __game.G.startSession('pond')")

    # Карточка для шаринга рисуется
    ok = pg.evaluate("""()=>{const s=FZ.SP.pike;const c=FZ.Share.card({s,w:5.2,len:88,loc:'oka',date:'2026-10-23',trophy:false,record:true,newSpecies:false,pct:90});return c.width===1080&&c.toDataURL().length>50000}""")
    check("карточка улова 1080×1920", ok)
    # Старый формат v1 автоматически получает новые поля экспедиции и достижений
    pg.evaluate("""()=>{const old=__game.G.state();delete old.expedition;delete old.achievements;delete old.expeditionsCompleted;delete old.firstIceCatches;delete old.journal;delete old.huntBoard;localStorage.setItem('fz_save',JSON.stringify(old));}""")
    pg.reload(); pg.wait_for_timeout(1500)
    check("миграция старого сейва v1", pg.evaluate("!!__game.G.state().expedition && !!__game.G.state().achievements && __game.G.state().expedition.bagCapacity===10 && Array.isArray(__game.G.state().journal) && !!__game.G.state().huntBoard && Array.isArray(__game.G.state().huntBoard.completed)"))
    check("сохранение", pg.evaluate("__game.G.state().rods.indexOf('d1')>=0"))
    b.close()

check("нет ошибок JS", not errors)
for e in errors[:5]: print("   ", e)
sys.exit(1 if fails else 0)

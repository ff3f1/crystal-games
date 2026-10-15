import sys, random
from playwright.sync_api import sync_playwright

import os
URL = "file://" + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "games", "block", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f"{OUT}/block_help.png")
    pg.click("#bHelpOk")
    pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}/block_start.png")

    # Реальное перетаскивание мышью: берём фигуру из лотка и тащим на поле
    L = pg.evaluate("__game.L()")
    placed = 0
    for attempt in range(12):
        pieces = pg.evaluate("__game.pieces.map(p=>p?1:0)")
        idx = next((i for i, v in enumerate(pieces) if v), None)
        if idx is None:
            break
        sx = L["bx"] + L["bs"] / 6 * (1 + 2 * idx); sy = L["ty"] + L["th"] / 2
        tx = L["bx"] + random.randint(1, 6) * L["cs"]; ty = L["by"] + random.randint(3, 8) * L["cs"]
        before = pg.evaluate("__game.score")
        pg.mouse.move(sx, sy); pg.mouse.down()
        for k in range(1, 11):
            pg.mouse.move(sx + (tx - sx) * k / 10, sy + (ty - sy) * k / 10)
        pg.mouse.up()
        pg.wait_for_timeout(120)
        if pg.evaluate("__game.score") > before:
            placed += 1
    print("drag placements:", placed)
    pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/block_play.png")

    # Автоигра до конца, проверяем инварианты
    for g in range(3):
        moves = pg.evaluate("""()=>{
          let n=0;
          while(!__game.over && n<500){
            const ps=__game.pieces; let done=false;
            for(let i=0;i<3&&!done;i++){ const p=ps[i]; if(!p) continue;
              const opts=[];
              for(let r=0;r<8;r++)for(let c=0;c<8;c++) if(__game.fits(p.s,r,c)) opts.push([r,c]);
              if(opts.length){const o=opts[Math.floor(Math.random()*opts.length)]; __game.place(i,o[0],o[1]); done=true; n++;}
            }
            if(!done) break;
            // инвариант: нет полностью заполненных строк/столбцов после хода
            const gr=__game.grid;
            for(let k=0;k<8;k++){ if(gr[k].every(v=>v>=0)||gr.every(r=>r[k]>=0)) throw new Error('full line left'); }
          }
          return [n,__game.score,__game.over];
        }""")
        print("autoplay game", g, moves)
        pg.wait_for_timeout(1500)
        if g == 0:
            pg.screenshot(path=f"{OUT}/block_over.png")
            pg.click("#bRevive"); pg.wait_for_timeout(1800)
            print("after revive over:", pg.evaluate("__game.over"))
            pg.screenshot(path=f"{OUT}/block_revived.png")
            continue
        if pg.is_visible("#bRestart"):
            pg.click("#bRestart"); pg.wait_for_timeout(1800)
        print("restarted, score:", pg.evaluate("__game.score"))

    # Сохранение: перезагрузка сохраняет партию
    pg.evaluate("()=>{const p=__game.pieces.findIndex(Boolean);const s=__game.pieces[p].s;for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(__game.fits(s,r,c)){__game.place(p,r,c);return}}")
    sc = pg.evaluate("__game.score")
    pg.reload(); pg.wait_for_timeout(500)
    print("score before/after reload:", sc, pg.evaluate("__game.score"))

    # Меню
    pg.mouse.click(L["bx"] + L["bs"] - L["cs"] * 0.45, L["by"] - L["cs"] * 1.6)
    pg.wait_for_timeout(400)
    print("menu open:", pg.is_visible("#ovMenu"))
    pg.screenshot(path=f"{OUT}/block_menu.png")

    # Планшет / широкий экран
    pg.set_viewport_size({"width": 1280, "height": 800}); pg.wait_for_timeout(300)
    pg.click("#bResume"); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/block_wide.png")
    b.close()

print("ERRORS:", errors if errors else "none")

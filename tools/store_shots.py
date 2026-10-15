"""Скриншоты для витрин RuStore / VK (1080x1920)."""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = lambda n: f"file://{ROOT}/games/{n}/index.html"

BOARD = [
    "........",
    "rr..b...",
    "rrg.bb..",
    ".ggyyy.p",
    "cc.yo.pp",
    "ccoooo.p",
    "bb.oo.yy",
    "bbgg..yy",
]
CI = {"r": 0, "o": 1, "y": 2, "g": 3, "c": 4, "b": 5, "p": 6}

with sync_playwright() as p:
    br = p.chromium.launch()
    # --- Блоки ---
    out = f"{ROOT}/store/block/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("localStorage.clear();localStorage.setItem('cb_helped','1');localStorage.setItem('cb_best','12480')")
    pg.goto(G("block")); pg.wait_for_timeout(500)
    pg.evaluate("""(B)=>{const g=__game.grid;const m=%s;
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){const ch=B[r][c];g[r][c]=ch==='.'?-1:m[ch];}}""" % str(CI).replace("'", '"'), BOARD)
    pg.evaluate("__game.score=3870")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f"{out}/1_game.png")
    # момент очистки линии: ставим фигуру, которая закрывает строку
    pg.evaluate("""()=>{const g=__game.grid;for(let c=0;c<8;c++) if(c!==6) g[3][c]=g[3][c]<0?3:g[3][c];
      __game.pieces[0]={s:{c:[[0,0]],h:1,wd:1},col:6,pop:1};__game.place(0,3,6);}""")
    pg.wait_for_timeout(260)
    pg.screenshot(path=f"{out}/2_clear.png")
    pg.wait_for_timeout(1200)
    pg.evaluate("""()=>{const g=__game.grid;for(let r=0;r<8;r++)for(let c=0;c<8;c++)g[r][c]=-1;
      [[7,0,5],[7,1,5],[6,0,4],[7,7,1]].forEach(([r,c,k])=>g[r][c]=k);}""")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{out}/3_clean.png")
    pg.close()

    # --- Шахта ---
    out = f"{ROOT}/store/idle/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("""localStorage.clear();const d=Math.floor((Date.now()-new Date().getTimezoneOffset()*60e3)/864e5);
      localStorage.setItem('cm_save',JSON.stringify({coins:84250000,total:9e8,lifetime:9e8,gens:[60,45,32,20,9,2,0,0,0,0],tapLv:30,
      upgs:{g0u10:1,g0u25:1,g1u10:1,g1u25:1,g2u10:1,g3u10:1,tap1:1},shards:3,last:Date.now(),daily:{day:d,streak:3}}))""")
    pg.goto(G("idle")); pg.wait_for_timeout(1500)
    c = pg.evaluate("__game.center()"); box = pg.locator("#cv").bounding_box()
    for i in range(10):
        pg.mouse.click(box["x"] + c["cx"] + (i % 3 - 1) * 25, box["y"] + c["cy"] + (i % 2) * 20)
        pg.wait_for_timeout(40)
    pg.screenshot(path=f"{out}/1_mine.png")
    pg.click('[data-t="upg"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{out}/2_upgrades.png")
    pg.evaluate("__game.S.last=Date.now()-5*3600e3;__game.checkOffline()"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{out}/3_offline.png")
    br.close()
print("ok")

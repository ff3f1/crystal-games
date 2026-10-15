"""Скриншоты для витрин RuStore / VK (1080x1920)."""
import os, glob
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = lambda n: f"file://{ROOT}/games/{n}/index.html"
CLOSE = "document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))"
BOT = """(k)=>{const G=__game;for(let n=0;n<k&&!G.over;n++){let b=null,bv=-1;G.pieces.forEach((p,i)=>{if(!p)return;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(G.fits(p.s,r,c)){const v=Math.random();if(v>bv){bv=v;b=[i,r,c];}}});if(!b)break;G.place(...b);}}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for f in glob.glob(f"{ROOT}/store/*/screens/*.png"): os.remove(f)
    # --- Блоки ---
    out = f"{ROOT}/store/block/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("""if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();
      ['classic','blitz','bombs'].forEach(m=>localStorage.setItem('cb_help_'+m,'1'));
      localStorage.setItem('cb_best','12480');localStorage.setItem('cb_stars',JSON.stringify([3,3,3,3,2,3,3,3,2,3,3,3,1,3]));}""")
    pg.goto(G("block")); pg.wait_for_timeout(1200)
    pg.screenshot(path=f"{out}/1_menu.png")
    pg.evaluate("__game.startGame('levels',14)"); pg.evaluate(CLOSE); pg.evaluate(BOT, 4); pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/2_level.png")
    pg.evaluate("__game.goMenu('levels')"); pg.wait_for_timeout(600)
    pg.screenshot(path=f"{out}/3_map.png")
    pg.evaluate("__game.setTheme('neon');__game.startGame('bombs')"); pg.evaluate(CLOSE); pg.evaluate(BOT, 16)
    pg.evaluate("__game.score=4230"); pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/4_bombs_neon.png")
    pg.evaluate("__game.setTheme('candy');__game.startGame('blitz')"); pg.evaluate(CLOSE); pg.evaluate(BOT, 10); pg.wait_for_timeout(250)
    pg.screenshot(path=f"{out}/5_blitz_candy.png")
    pg.close()

    # --- Шахта ---
    out = f"{ROOT}/store/idle/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("""if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();
      const d=Math.floor((Date.now()-new Date().getTimezoneOffset()*60e3)/864e5);
      localStorage.setItem('cm_save',JSON.stringify({coins:84250,total:9e5,lifetime:9e5,gens:[30,22,12,4,0,0,0,0,0,0],tapLv:30,
        upgs:{g0u10:1,g0u25:1,g1u10:1,tap1:1},last:Date.now(),daily:{day:d,streak:3},bossAt:Date.now()+9e5}));}""")
    pg.goto(G("idle")); pg.wait_for_timeout(1200)
    c = pg.evaluate("__game.center()"); box = pg.locator("#cv").bounding_box()
    def taps(n):
        for i in range(n):
            pg.mouse.click(box["x"] + c["cx"] + (i % 3 - 1) * 25, box["y"] + c["cy"] + (i % 2) * 20); pg.wait_for_timeout(35)
    taps(8); pg.screenshot(path=f"{out}/1_mine.png")
    pg.evaluate("__game.S.world=2;__game.S.maxWorld=2;__game.S.coins=3.2e8;__game.resetScene();__game.render(true)"); pg.wait_for_timeout(700)
    c = pg.evaluate("__game.center()"); taps(8); pg.screenshot(path=f"{out}/2_lava.png")
    pg.evaluate("__game.S.bossAt=0;__game.startBoss()"); pg.wait_for_timeout(300); taps(14); pg.wait_for_timeout(150)
    pg.screenshot(path=f"{out}/3_boss.png")
    pg.evaluate("__game.S.boss=null"); pg.reload(); pg.wait_for_timeout(500); pg.evaluate(CLOSE)
    pg.evaluate("__game.S.world=4;__game.S.maxWorld=4;__game.S.coins=4.1e13;__game.resetScene();__game.render(true)")
    pg.click('[data-t="w"]'); pg.wait_for_timeout(700)
    pg.screenshot(path=f"{out}/4_worlds.png")
    pg.click('[data-t="q"]'); pg.wait_for_timeout(500)
    c = pg.evaluate("__game.center()"); taps(6); pg.screenshot(path=f"{out}/5_quests.png")
    br.close()
print("ok")

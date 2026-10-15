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
    pg.evaluate("__game.setTheme('neon');__game.startGame('bombs')"); pg.evaluate(CLOSE); pg.evaluate(BOT, 9)
    pg.evaluate("__game.score=4230"); pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/4_bombs_neon.png")
    pg.evaluate("__game.setTheme('candy');__game.startGame('blitz')"); pg.evaluate(CLOSE); pg.evaluate(BOT, 10); pg.wait_for_timeout(250)
    pg.screenshot(path=f"{out}/5_blitz_candy.png")
    pg.close()

    # --- Нарисуй путь ---
    out = f"{ROOT}/store/path/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("""if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();
      localStorage.setItem('dp_stars',JSON.stringify([3,3,3,2,3,3,3,2,3,3,3,3,2,3,3,1,3,2]));}""")
    pg.goto(G("path")); pg.wait_for_timeout(2400)
    pg.screenshot(path=f"{out}/1_menu.png")
    def shot(i, name, wait, skin=0):
        pg.evaluate(f"__game.setSkin({skin});__game.startLevel({i});__game.strokes=JSON.parse(JSON.stringify(__game.LEVELS[{i}].sol));__game.play()")
        pg.wait_for_timeout(wait); pg.screenshot(path=f"{out}/{name}.png")
    shot(4, "2_snake", 2600, 1)
    shot(17, "3_trampoline", 1500, 2)
    shot(20, "4_portal", 1250, 4)
    pg.evaluate(CLOSE); pg.evaluate("__game.goLevels()"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{out}/5_levels.png")
    br.close()
print("ok")

"""Скриншоты для витрин RuStore / VK (1080x1920)."""
import os, glob
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = lambda n: f"file://{ROOT}/games/{n}/index.html"

# «Рыбалка» грузит шрифты и картинки — отдаём её через локальный сервер
import http.server, threading, functools
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=os.path.join(ROOT, "games")))
threading.Thread(target=_srv.serve_forever, daemon=True).start()
FISH_URL = f"http://127.0.0.1:{_srv.server_address[1]}/fish/index.html"
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
    pg.close()

    # --- Рыбалка: Клюёт! ---
    out = f"{ROOT}/store/fish/screens"; os.makedirs(out, exist_ok=True)
    pg = br.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.add_init_script("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();}")
    pg.goto(FISH_URL); pg.wait_for_timeout(1500)
    FISH_SETUP = """(a)=>{const G=__game.G,st=G.state();st.money=48250;st.lvl=14;st.tut=4;st.xp=900;
      ['f2','d2','s2','i2','l4','l5'].forEach(id=>G.buy(id[0]==='l'?'line':'rod',id));['spinner','jig','corn','bloodworm'].forEach(id=>G.buy('bait',id));
      st.daily.giftDay=FZ.U.dayKey();['crucian','perch','pike','bream','roach','carp','tench','zander','rudd','sbream','bleak','rotan'].forEach(id=>st.caught[id]=2);
      G.startSession(a.loc,a.season);const s=G.sess();s.wx=Object.assign(s.wx,{sky:a.sky||'clear',wind:2,score:5,trend:'flat'});
      if(a.mode&&a.mode!=='ice')G.setActive(a.mode);G.skipTo(a.time);__game.Sc.clearFx();}"""
    def fshot(name, wait=600):
        pg.wait_for_timeout(wait); pg.evaluate("document.getElementById('toast').innerHTML=''"); pg.screenshot(path=f"{out}/{name}.png")
    pg.evaluate(FISH_SETUP, {"loc": "pond", "season": "summer", "time": "dawn"}); pg.evaluate("__game.UI.showMenu()")
    fshot("1_menu", 900)
    pg.evaluate("__game.UI.closeMenu()")
    pg.evaluate("__game.G.cast(-0.6,11)"); pg.wait_for_timeout(1700)
    pg.evaluate("""()=>{const r=__game.G.rig();r.state='bite';r.bite={s:FZ.SP.crucian,w:0.8,style:'lay',phase:'take',t:2.4,touches:0,nextTouch:0,take:9,empty:false};}""")
    fshot("2_bite", 700)
    pg.evaluate(FISH_SETUP, {"loc": "oka", "season": "autumn", "time": "day", "mode": "spin"}); pg.wait_for_timeout(300)
    pg.evaluate("__game.G.cast(1,12)"); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const G=__game.G,r=G.rig();r.state='bite';r.bite={s:FZ.SP.pike,w:5.6,style:'drag',phase:'take',t:0,touches:0,nextTouch:0,take:9,empty:false};G.strike();
      const f=G.rig().fish;f.Z=8;f.X=-0.6;f.T=f.Fmax*0.9;f.jump={k:0.42,dur:30,dir:1,hurt:true};f.phaseT=99;f.S=0.6;}""")
    fshot("3_fight", 250)
    pg.evaluate(FISH_SETUP, {"loc": "platnik", "season": "summer", "time": "dusk", "mode": "feeder"}); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const s=FZ.SP.carp;const r={s,w:12.84,len:84,trophy:true,record:true,prevRecord:6.2,newSpecies:false,price:2696,xp:310,mustRelease:false,loc:'platnik',pct:FZ.World.percentile(s,12.84),date:FZ.U.dayKey(),tour:null};__game.G.rig().state='result';__game.G.rig().result=r;__game.UI.showCatch(r);}""")
    fshot("4_trophy", 1800)
    pg.evaluate("document.getElementById('ovCatch').classList.remove('on');document.getElementById('hud').classList.remove('hide')")
    pg.evaluate(FISH_SETUP, {"loc": "ladoga", "season": "winter", "time": "day", "sky": "cloudy"}); pg.wait_for_timeout(300)
    pg.evaluate("__game.G.drill()"); pg.wait_for_timeout(2900)
    pg.evaluate("""()=>{const r=__game.G.rig();r.state='bite';r.bite={s:FZ.SP.smelt,w:0.08,style:'twitch',phase:'take',t:0.3,touches:0,nextTouch:0,take:9,empty:false};}""")
    fshot("5_winter", 500)
    pg.evaluate("__game.UI.showMenu();__game.UI.showAtlas()")
    fshot("6_atlas", 600)
    br.close()
print("ok")

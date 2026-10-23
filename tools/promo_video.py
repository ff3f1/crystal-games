"""Рекламный ролик для YouTube Shorts / VK Клипов: вертикальное видео 1080×1920, ~30 с,
настоящий геймплей + субтитры + призыв скачать в RuStore.

  python3 tools/promo_video.py <out.mp4> [музыка.mp3]   # --shots: только контрольные кадры

Игра крутится в Chromium в реальном времени, кадры снимаются через CDP screencast,
потом ffmpeg собирает их в 30 fps и подкладывает музыку из игры."""
import base64, functools, http.server, json, os, shutil, subprocess, sys, tempfile, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = os.path.abspath(args[0] if args else "promo.mp4")
MUSIC = args[1] if len(args) > 1 else os.path.join(ROOT, "games/fish/assets/audio/music_summer.mp3")
SHOTS = "--shots" in sys.argv


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.join(ROOT, "games")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/fish/index.html"
ICON = "data:image/png;base64," + base64.b64encode(open(os.path.join(ROOT, "store/fish/icons/icon_512.png"), "rb").read()).decode()

SETUP = """(a)=>{const G=__game.G,st=G.state();st.money=12400;st.lvl=9;st.tut=4;st.xp=500;st.drag=0.55;
  ['f2','d2','s2','i2','l4','l5'].forEach(id=>G.buy(id[0]==='l'?'line':'rod',id));['corn','bloodworm','spinner'].forEach(id=>G.buy('bait',id));
  st.daily.giftDay=FZ.U.dayKey();st.rateAsked=2;['crucian','perch','roach','bream'].forEach(id=>st.caught[id]=1);
  G.startSession(a.loc,a.season);const s=G.sess();s.wx=Object.assign(s.wx,{sky:a.sky||'clear',wind:1,score:5,trend:'flat'});
  if(a.mode&&a.mode!=='ice')G.setActive(a.mode);G.skipTo(a.time);__game.Sc.clearFx();
  document.getElementById('toast').innerHTML='';}"""

OVERLAY = """(icon)=>{
  const st=document.createElement('style');st.textContent=`
  #hHint,#toast{opacity:0!important}
  #pcap{position:fixed;left:0;right:0;top:12.5%;z-index:9999;pointer-events:none;text-align:center;padding:0 18px}
  #pcap .l{display:inline-block;font:800 31px/1.12 Rubik,sans-serif;color:#fff;letter-spacing:.2px;
    text-shadow:0 2px 0 #0b2233,0 0 14px rgba(0,0,0,.55),2px 2px 0 #0b2233,-2px 2px 0 #0b2233,2px -2px 0 #0b2233,-2px -2px 0 #0b2233;
    transform:scale(.6);opacity:0;transition:transform .28s cubic-bezier(.2,1.6,.4,1),opacity .2s}
  #pcap .s{display:block;margin-top:8px;font:700 20px/1.2 Rubik,sans-serif;color:#ffe08a;text-shadow:0 2px 0 #0b2233,0 0 10px rgba(0,0,0,.6),1px 1px 0 #0b2233,-1px 1px 0 #0b2233}
  #pcap.on .l{transform:scale(1);opacity:1}
  #pcta{position:fixed;left:0;right:0;bottom:13%;z-index:9998;pointer-events:none;text-align:center;opacity:0;transition:opacity .3s}
  #pcta.on{opacity:1}
  #pcta span{display:inline-block;font:800 17px Rubik,sans-serif;color:#0b2233;background:#ffd23f;border-radius:999px;padding:9px 18px;box-shadow:0 4px 0 #b88a12,0 6px 18px rgba(0,0,0,.35)}
  #pend{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    background:radial-gradient(120% 80% at 50% 35%,rgba(20,70,95,.82),rgba(4,16,26,.94));opacity:0;transition:opacity .45s;pointer-events:none;
    font-family:Rubik,sans-serif;color:#fff;text-align:center;padding:0 24px}
  #pend.on{opacity:1}
  #pend img{width:150px;height:150px;border-radius:34px;box-shadow:0 14px 40px rgba(0,0,0,.5);transform:scale(.7);transition:transform .6s cubic-bezier(.2,1.5,.4,1)}
  #pend.on img{transform:scale(1)}
  #pend .t{font:800 40px/1.05 Rubik;text-shadow:0 3px 0 #0b2233}
  #pend .t i{font:700 52px Caveat,cursive;color:#ffd23f;font-style:normal;display:block}
  #pend .b{margin-top:6px;font:800 24px Rubik;color:#0b2233;background:#ffd23f;border-radius:18px;padding:14px 26px;box-shadow:0 5px 0 #b88a12}
  #pend .b small{display:block;font:700 15px Rubik;margin-top:2px}
  #pend .n{font:600 17px/1.35 Rubik;color:#cfe8f2;opacity:.95}
  #pend .n b{color:#fff}`;
  document.head.appendChild(st);
  const c=document.createElement('div');c.id='pcap';document.body.appendChild(c);
  const k=document.createElement('div');k.id='pcta';k.innerHTML='<span>Бесплатно в RuStore</span>';document.body.appendChild(k);
  const e=document.createElement('div');e.id='pend';e.innerHTML='<img src="'+icon+'"><div class="t">Рыбалка:<i>Клюёт!</i></div>'+
    '<div class="b">Скачай бесплатно<small>в RuStore</small></div><div class="n">Ищи «<b>Рыбалка Клюёт</b>»<br>или жми ссылку в описании</div>';
  document.body.appendChild(e);
  window.__cap=(t,s)=>{c.classList.remove('on');setTimeout(()=>{c.innerHTML=t?'<span class="l">'+t+(s?'<span class="s">'+s+'</span>':'')+'</span>':'';
    void c.offsetWidth;if(t)c.classList.add('on');},t?120:0);};
  window.__cta=(on)=>k.classList.toggle('on',!!on);
  window.__end=()=>{c.classList.remove('on');k.classList.remove('on');e.classList.add('on');};
}"""


def run():
    frames = []
    tmp = tempfile.mkdtemp(prefix="promo_")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
        pg.add_init_script("if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();}")
        pg.goto(URL); pg.wait_for_timeout(2500)
        pg.evaluate(OVERLAY, ICON)
        pg.evaluate("__game.UI.closeMenu && __game.UI.closeMenu()")
        # качество картинки — максимальное, без автоснижения
        pg.evaluate("()=>{const st=__game.G.state();st.settings.quality='hi';FZ.applyQuality&&FZ.applyQuality();}")
        pg.evaluate(SETUP, {"loc": "pond", "season": "summer", "time": "dawn", "mode": "float"})
        pg.wait_for_timeout(600)
        pg.evaluate("document.fonts.ready")

        cdp = pg.context.new_cdp_session(pg)
        t_start = [None]

        def on_frame(e):
            ts = e["metadata"]["timestamp"]
            if t_start[0] is None: t_start[0] = ts
            fn = os.path.join(tmp, "f%05d.jpg" % len(frames))
            with open(fn, "wb") as f: f.write(base64.b64decode(e["data"]))
            frames.append((ts, fn))
            try: cdp.send("Page.screencastFrameAck", {"sessionId": e["sessionId"]})
            except Exception: pass

        shot_n = [0]

        def mark(name):
            if SHOTS:
                shot_n[0] += 1
                pg.screenshot(path=os.path.join(os.path.dirname(OUT), "promo_%02d_%s.png" % (shot_n[0], name)))

        if not SHOTS:
            cdp.on("Page.screencastFrame", on_frame)
            cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1080, "maxHeight": 1920, "everyNthFrame": 1})
        W = pg.wait_for_timeout

        # 1) рассвет на пруду, заброс
        pg.evaluate("__cap('Рыбалка как в жизни','поплавок, фидер, спиннинг и зимняя')")
        W(1300)
        pg.mouse.move(180, 300); pg.mouse.down(); pg.mouse.move(200, 330, steps=8); W(250); pg.mouse.up()  # заброс жестом
        W(1700)
        mark("cast")
        # 2) поклёвка: карп ведёт поплавок
        pg.evaluate("__cap('Поплавок повело —','подсекай!')")
        pg.evaluate("""()=>{const r=__game.G.rig();if(r.state!=='wait'&&r.state!=='settle'){__game.G.cast(0,14);} }""")
        W(900)
        pg.evaluate("""()=>{const r=__game.G.rig();r.state='bite';r.bite={s:FZ.SP.carp,w:4.3,style:'drag',phase:'take',t:0.2,touches:0,nextTouch:0,take:9,empty:false};}""")
        W(1500)
        mark("bite")
        # подсечка свайпом вверх
        pg.mouse.move(190, 560); pg.mouse.down(); pg.mouse.move(190, 470, steps=4); pg.mouse.up()
        W(250)
        if pg.evaluate("__game.G.rig().state") != "fight":
            pg.evaluate("""()=>{const G=__game.G,r=G.rig();r.state='bite';r.bite={s:FZ.SP.carp,w:4.3,style:'drag',phase:'take',t:2,touches:0,nextTouch:0,take:9,empty:false};const tu=G.state().tut;G.state().tut=2;G.strike();G.state().tut=tu;}""")
        # 3) вываживание
        pg.evaluate("__cap('Держи натяжение —','не дай порвать леску!')")
        pg.evaluate("__cta(true)")
        guard = """()=>{const G=__game.G,r=G.rig(),f=r.fish;if(!f)return r.state;const lt=G.gear(G.sess().mode).line.test;
          if(!f._c){f._c=1;f.Fmax=Math.min(f.Fmax,lt*0.5);}if(f.T>lt*0.86)f.T=lt*0.86;f.slackT=0;f.snagT=0;return r.state;}"""
        xs = [250, 250, 120, 120, 260, 260, 150, 200]
        t0 = time.time(); i = 0; said = False
        pg.mouse.move(250, 600); pg.mouse.down()
        while time.time() - t0 < 9.5:
            st = pg.evaluate(guard)
            if st != "fight": break
            el = time.time() - t0
            if el > 2.5: pg.evaluate("()=>{const f=__game.G.rig().fish;if(f)f.S=Math.max(0,f.S-0.035);}")
            if el > 1.6 and int(el * 1.2) != i:
                i = int(el * 1.2); pg.mouse.move(xs[i % len(xs)], 600, steps=6)
            if el > 4.6 and not said:
                said = True; pg.evaluate("__cap('Веди удилище','против рыбы, чтобы не ушла в траву')")
            W(120)
        mark("fight")
        pg.mouse.up()
        for _ in range(40):
            if pg.evaluate("__game.G.rig().state") == "result": break
            if pg.evaluate("__game.G.rig().state") == "fight":
                pg.evaluate("()=>{const f=__game.G.rig().fish;if(f){f.S=0.05;f.Z=Math.min(f.Z,4);}}"); pg.mouse.down(); W(150); pg.mouse.up()
            W(120)
        # 4) карточка улова
        pg.evaluate("__cap('');__cta(false)")
        pg.evaluate("document.getElementById('toast').innerHTML=''")
        W(2600)
        mark("catch")
        if pg.is_visible("#cKeep"): pg.click("#cKeep")
        W(300)
        # 5) зима: лунка
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'));document.getElementById('hud').classList.remove('hide')")
        pg.evaluate(SETUP, {"loc": "ladoga", "season": "winter", "time": "day", "sky": "cloudy"})
        pg.evaluate("__cap('Зимняя рыбалка','бурим лунку на Ладоге');__cta(true)")
        W(500)
        pg.evaluate("__game.G.drill()")
        W(2900)
        mark("ice")
        pg.evaluate("""()=>{const r=__game.G.rig();r.state='bite';r.bite={s:FZ.SP.perch,w:0.62,style:'twitch',phase:'take',t:0.3,touches:0,nextTouch:0,take:9,empty:false};}""")
        pg.evaluate("__cap('Кивок дрогнул —','подсекай!')")
        W(1000)
        pg.evaluate("""()=>{const G=__game.G;const tu=G.state().tut;G.state().tut=2;G.strike();G.state().tut=tu;}""")
        pg.mouse.move(180, 600); pg.mouse.down()
        t0 = time.time()
        while time.time() - t0 < 3.2:
            st = pg.evaluate(guard)
            if st != "fight": break
            pg.evaluate("()=>{const f=__game.G.rig().fish;if(f)f.S=Math.max(0,f.S-0.05);}")
            W(120)
        pg.mouse.up()
        for _ in range(30):
            s = pg.evaluate("__game.G.rig().state")
            if s == "result": break
            if s == "fight":
                pg.evaluate("()=>{const f=__game.G.rig().fish;if(f){f.S=0.05;f.D=Math.min(f.D,0.6);}}"); pg.mouse.down(); W(150); pg.mouse.up()
            W(100)
        pg.evaluate("__cap('');__cta(false)")
        W(1700)
        mark("ice_catch")
        # 6) водоёмы — карта
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'));document.getElementById('hud').classList.remove('hide')")
        pg.evaluate(SETUP, {"loc": "oka", "season": "autumn", "time": "dusk", "mode": "spin"})
        pg.evaluate("__cap('8 водоёмов России','31 вид рыбы: от плотвы до тайменя');__cta(true)")
        W(2300)
        mark("oka")
        # 7) финальная карточка
        pg.evaluate("__end()")
        W(3300)
        mark("end")
        if not SHOTS:
            cdp.send("Page.stopScreencast")
        b.close()
    if SHOTS:
        print("shots ok"); return
    print("кадров:", len(frames), "длительность:", round(frames[-1][0] - frames[0][0], 2), "с")
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        for i, (ts, fn) in enumerate(frames):
            d = (frames[i + 1][0] - ts) if i + 1 < len(frames) else 1 / 30
            f.write("file '%s'\nduration %.4f\n" % (fn, max(0.001, d)))
        f.write("file '%s'\n" % frames[-1][1])
    total = frames[-1][0] - frames[0][0] + 1 / 30
    vf = "fps=30,scale=1080:1920:flags=lanczos,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst]
    if MUSIC and os.path.exists(MUSIC):
        cmd += ["-ss", "4", "-i", MUSIC, "-filter_complex",
                "[1:a]afade=t=in:d=0.6,afade=t=out:st=%.2f:d=1.6,volume=0.9[a]" % max(0, total - 1.8),
                "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-movflags", "+faststart", "-t", "%.2f" % total, OUT]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print("готово:", OUT)


run()

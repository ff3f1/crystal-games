"""Скриншоты «Звёздного роя» для витрин (1080×1920). Запуск: python3 tools/swarm_shots.py"""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "games", "swarm", "index.html")
OUT = os.path.join(ROOT, "store", "swarm", "screens")
AUTO = os.path.join(ROOT, "tests", "swarm_auto.js")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization", "--disable-partial-raster", "--disable-oop-rasterization"]

def page(p):
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.goto(URL); pg.wait_for_timeout(3000); pg.add_script_tag(path=AUTO)
    return b, pg

def clean(pg, keep=False):
    if not keep: pg.evaluate("()=>{const P=Game.world&&Game.world.player; if(P&&!P.alive){Game.world.revive();} document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))}")
    pg.wait_for_timeout(300)
    pg.evaluate("()=>{document.getElementById('hint').classList.remove('on');document.getElementById('banner').classList.remove('on');document.querySelectorAll('.float').forEach(e=>e.remove())}")

def run_to(pg, s, pp, secs, setup="", boss=False):
    pg.evaluate("()=>{const d=Game.save();d.tut=1;d.prog=12;for(let i=0;i<12;i++)d.captured[i]=true;%s}" % setup)
    pg.evaluate("()=>Game.startRun({mode:%s,info:planetInfo(Game.save().gseed,%d,%d)})" % ('"boss"' if boss else '"campaign"', s, pp))
    pg.wait_for_timeout(2500); pg.evaluate("()=>{window.__autopilot=autoBrain}")
    for _ in range(int(secs * 2)):
        pg.wait_for_timeout(500)
        if pg.is_visible("#ovMut"): pg.click("#mOpts .mopt")
    pg.evaluate("()=>{window.__autopilot=null}")

with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    b, pg = page(p)
    pg.evaluate("()=>{const d=Game.save();d.tut=1;d.prog=3;for(let i=0;i<3;i++)d.captured[i]=true;d.light=1240;d.shards=4;d.login.claimed=1;Game.goMenu()}")
    pg.wait_for_timeout(2500); pg.evaluate("()=>document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}/1_menu.png"); b.close()
    b, pg = page(p); run_to(pg, 0, 2, 26); clean(pg); pg.screenshot(path=f"{OUT}/2_swarm.png"); b.close()
    b, pg = page(p); run_to(pg, 2, 0, 14); clean(pg); pg.screenshot(path=f"{OUT}/3_volcano.png"); b.close()
    b, pg = page(p); run_to(pg, 0, 1, 4)
    pg.evaluate("()=>{const w=Game.world;w.mutNext=0}"); pg.wait_for_timeout(1200); clean(pg, True); pg.screenshot(path=f"{OUT}/4_mutation.png"); b.close()
    b, pg = page(p)
    pg.evaluate("()=>{const d=Game.save();d.tut=1;d.prog=8;for(let i=0;i<8;i++)d.captured[i]=true;d.light=1240}")
    pg.click("#bPlay"); pg.wait_for_timeout(2500); pg.screenshot(path=f"{OUT}/5_planet.png"); b.close()
    b, pg = page(p); run_to(pg, 1, 4, 22, "d.upg={start:9,speed:6,magnet:6,power:7,stamina:5};", True); clean(pg); pg.screenshot(path=f"{OUT}/6_boss.png"); b.close()
    print(sorted(os.listdir(OUT)))

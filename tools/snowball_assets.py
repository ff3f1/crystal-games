"""Иконка и скриншоты «Снежного кома». Запуск: python3 tools/snowball_assets.py"""
import os, base64
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "games", "snowball", "index.html")
ST = os.path.join(ROOT, "store", "snowball")
AUTO = os.path.join(ROOT, "tests", "snowball_auto.js")
ARGS = ["--disable-gpu-rasterization", "--disable-partial-raster", "--disable-oop-rasterization"]
ICON_JS = """()=>{
 const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d'),S=1024;
 let g=x.createLinearGradient(0,0,0,S);g.addColorStop(0,'#5aa8ec');g.addColorStop(.55,'#bfe2fb');g.addColorStop(.56,'#ffffff');g.addColorStop(1,'#dcecf9');x.fillStyle=g;x.fillRect(0,0,S,S);
 x.fillStyle='#a9cbec';x.beginPath();x.moveTo(0,570);x.lineTo(180,380);x.lineTo(330,520);x.lineTo(520,330);x.lineTo(720,540);x.lineTo(860,410);x.lineTo(1024,560);x.lineTo(1024,580);x.lineTo(0,580);x.fill();
 drawThing(x,'pine',150,640,70,{});drawThing(x,'pine',880,620,60,{});drawThing(x,'house',830,700,40,{v:1});
 // ком
 const cx=500,cy=640,R=300;x.fillStyle='rgba(60,90,140,.25)';x.beginPath();x.ellipse(cx,cy+R*0.92,R*1.05,R*0.25,0,0,7);x.fill();
 g=x.createRadialGradient(cx-110,cy-120,30,cx,cy,R);g.addColorStop(0,'#fff');g.addColorStop(.4,'#ffffff');g.addColorStop(1,'#c3d9ee');
 x.fillStyle=g;x.strokeStyle=INK;x.lineWidth=22;x.beginPath();x.arc(cx,cy,R,0,7);x.fill();
 x.save();x.beginPath();x.arc(cx,cy,R,0,7);x.clip();
 drawThing(x,'pine',cx+170,cy+40,58,{});drawThing(x,'car',cx-40,cy-40,118,{v:0});drawThing(x,'snowman',cx+120,cy+230,100,{});drawThing(x,'gift',cx-170,cy+200,170,{v:1});drawThing(x,'person',cx-210,cy-40,70,{v:4});
 x.restore();x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();
 x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.ellipse(cx-120,cy-150,60,30,-.6,0,7);x.fill();
 for(let i=0;i<40;i++){x.fillStyle='#fff';x.beginPath();x.arc(820-i*9+Math.sin(i)*40,880-Math.random()*120,8+Math.random()*14,0,7);x.fill();}
 return c.toDataURL('image/png');}"""

def page(p):
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=3)
    pg.goto(URL); pg.wait_for_timeout(1500); pg.add_script_tag(path=AUTO)
    return b, pg

with sync_playwright() as p:
    os.makedirs(ST + "/icons", exist_ok=True); os.makedirs(ST + "/screens", exist_ok=True)
    b, pg = page(p)
    data = pg.evaluate(ICON_JS); open(ST + "/icons/icon_1024.png", "wb").write(base64.b64decode(data.split(",")[1]))
    pg.evaluate("()=>{Save.d.coins=420;Save.save();}"); pg.reload(); pg.wait_for_timeout(1500)
    pg.screenshot(path=ST + "/screens/1_start.png")
    pg.add_script_tag(path=AUTO); pg.click("#bPlay")
    shots = {14: "2_roll", 40: "3_big", 66: "4_huge"}
    for i in range(160):
        pg.wait_for_timeout(500)
        if i in shots: pg.evaluate("()=>{document.querySelectorAll('.pop').forEach(e=>e.remove());document.getElementById('hint').classList.remove('on')}"); pg.screenshot(path=ST + f"/screens/{shots[i]}.png")
        if pg.evaluate("Game.state") != "run": break
    pg.wait_for_timeout(1400); pg.screenshot(path=ST + "/screens/5_finish.png")
    b.close()
im = Image.open(ST + "/icons/icon_1024.png").convert("RGB")
im.resize((512, 512), Image.LANCZOS).save(ST + "/icons/icon_512.png")
for n, s in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]: im.resize((s, s), Image.LANCZOS).save(ST + f"/icons/ic_launcher_{n}.png")
im.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "games", "snowball", "icon.png"))
os.remove(ST + "/icons/icon_1024.png")
print(sorted(os.listdir(ST + "/screens")))

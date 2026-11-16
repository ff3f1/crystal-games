from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image,ImageStat
import functools,http.server,threading,sys
root=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'games')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
out=Path(sys.argv[1] if len(sys.argv)>1 else 'test-output');out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2);pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 pg.goto(f'http://127.0.0.1:{srv.server_port}/fish/');pg.wait_for_function('window.__game');pg.click('#mGo')
 for loc,hour,sky,name in [('pond',12,'clear','day'),('pond',0,'clear','night'),('pond',12,'rain','rain'),('katun',10,'clear','katun')]:
  pg.evaluate('''([loc,hour,sky])=>{const G=__game.G;G.startSession(loc,'summer');G.sess().hour=hour;G.sess().wx.sky=sky;}''',[loc,hour,sky])
  pg.wait_for_function('loc=>!!FZ.Assets.bg(loc,"summer")',arg=loc);pg.wait_for_timeout(1000);pg.screenshot(path=str(out/(name+'.png')))
 pg.evaluate("__game.G.startSession('pond','winter');__game.G.sess().hour=13")
 pg.wait_for_function('!!FZ.Assets.bg("pond","winter")',timeout=20000)
 pg.wait_for_timeout(600)
 pg.screenshot(path=str(out/'winter-ice.png'))
 winter=pg.evaluate("FZ.Scene.graphicsInfo().hole")
 assert winter and winter['open']==0,winter
 pg.evaluate("__game.G.startSession('pond','summer')")
 result=pg.evaluate('''()=>{const G=__game.G,s=G.sess();const before=s.wx.sky;s.weatherAge=149.9;G.update(.2,1);return {before,after:s.wx.sky,front:s.weatherFront};}''');assert result['front']==1 and result['before']!=result['after'],result
 skip=pg.evaluate("()=>{__game.G.skipTo('night');const s=__game.G.sess();return {period:s.period,front:s.weatherFront};}")
 assert skip['period']=='night' and skip['front']>1,skip
 assert not errors,errors
 print('PASS shader compilation; 3 lighting/weather states; Katun; automatic weather front',result);b.close()
means={n:sum(ImageStat.Stat(Image.open(out/(n+'.png')).convert('RGB').crop((0,200,780,1200))).mean)/3 for n in ['day','night']};assert means['night']<means['day']*.5,means;print('Day/night luminance',means)

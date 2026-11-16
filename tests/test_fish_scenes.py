"""Capture real WebGL scenery in every summer and winter location with weather variants.

This exhaustive visual audit is separate from the fast Android release gate.
"""
import functools
import http.server
import json
import pathlib
import sys
import threading
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "scene-output")
out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT/"games")))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={"width":360,"height":640},device_scale_factor=2)
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(f"http://127.0.0.1:{srv.server_port}/fish/")
 page.wait_for_function("window.__game && FZ.Scene.graphicsInfo().renderer==='webgl'")
 page.click("#mGo")
 page.evaluate("__game.G.state().tut=4")
 # Visual evidence: every water has a summer and winter scene, in daylight and
 # adverse weather. Capture the game canvas itself rather than a mocked render.
 from PIL import Image
 page.set_viewport_size({'width':360,'height':640})
 locations=page.evaluate("FZ.LOCATIONS.map(l=>l.id)")
 assert len(locations)>=20
 captures=[]
 for loc_id in locations:
  for season in ('summer','winter'):
   for variant in ('day','weather'):
    hour=12 if variant=='day' else (11 if season=='winter' else 19)
    sky='clear' if variant=='day' else ('snow' if season=='winter' else 'rain')
    scene_info=page.evaluate("""async p=>{
      const G=__game.G;
      G.startSession(p.id,p.season);
      const s=G.sess();
      s.hour=p.hour;s.period=FZ.Scene.period(p.hour,p.season);
      s.wx.sky=p.sky;s.wx.wind=3;s.wx.dir='З';
      const im=await FZ.Assets.ensure(FZ.Assets.backdropKey(p.id,p.season));
      if(!im)throw Error('Missing backdrop '+p.id+'/'+p.season);
      FZ.Scene.render(G.view(3.5),1/60);
      const info=FZ.Scene.graphicsInfo();
      return {id:p.id,season:p.season,variant:p.variant,sky:p.sky,
        ice:!!s.ice,renderer:info.renderer,photoWidth:im.width,photoHeight:im.height};
    }""",{'id':loc_id,'season':season,'hour':hour,'sky':sky,'variant':variant})
    assert scene_info['renderer']=='webgl',scene_info
    name=f"scene_{loc_id}_{season}_{variant}.jpg"
    image_path=out/name
    page.locator('#cv').screenshot(path=str(image_path),type='jpeg',quality=87)
    with Image.open(image_path) as im:
     assert im.width>=390 and im.height>=844,(name,im.size)
     assert len(im.convert('RGB').resize((48,96)).getcolors(4608) or [])>16,name
    captures.append(dict(scene_info,screen=name))
 (out/'all-locations-validation.json').write_text(json.dumps(captures,ensure_ascii=False,indent=2))
 assert len(captures)==len(locations)*4,len(captures)
 page.set_viewport_size({'width':390,'height':844})

 assert not errors,errors
 print(f"PASS: {len(captures)} summer/winter visual evidence images over {len(locations)} locations")
 b.close()
srv.shutdown()

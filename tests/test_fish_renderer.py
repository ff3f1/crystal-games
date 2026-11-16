"""GPU route, all portrait resources, cache bounds and phone/tablet layouts."""
import functools,http.server,json,pathlib,threading,sys
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'test-output');out.mkdir(exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'games')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{srv.server_port}/fish/');page.wait_for_function('window.__game')
 assert page.evaluate("FZ.Scene.graphicsInfo().renderer==='webgl'")
 results=page.evaluate('''async()=>{const r=[];for(const s of FZ.SPECIES){const im=await FZ.Fish3D.ready(s);r.push({id:s.id,width:im&&im.width,height:im&&im.height});}return r;}''')
 assert len(results)==62 and all(x['width']>=1600 for x in results),results
 assert page.evaluate("Object.keys(FZ.Assets.img).filter(x=>x.startsWith('fishhd/')).length<=4")
 page.click('#mGo');page.evaluate("__game.G.state().tut=4;__game.G.startSession('pond','summer');__game.G.sess().hour=9")
 page.wait_for_function("FZ.Assets.bg('pond','summer')")
 page.screenshot(path=str(out/'new_pond.png'))
 # Regression: the line must follow the hooked fish rather than the cast point.
 alignment=page.evaluate('''()=>{
   const G=__game.G,r=G.rig(),saved={state:r.state,fish:r.fish,X:r.X,Z:r.Z};
   try{
     r.state='fight';r.X=3;r.Z=38;r.fish={hooked:true,X:-4.5,Z:11};
     const v=G.view(1);
     return {state:v.tackle.state,X:v.tackle.X,Z:v.tackle.Z};
   }finally{r.state=saved.state;r.fish=saved.fish;r.X=saved.X;r.Z=saved.Z;}
 }''')
 assert alignment=={'state':'fight','X':-4.5,'Z':11},alignment

 snap=page.evaluate('''()=>{const c=FZ.Scene.snapshot(),g=c.getContext('2d');return Array.from(g.getImageData(c.width/2,c.height/2,1,1).data);}''')
 assert snap[3]==255 and sum(snap[:3])>20,snap
 for size in [(360,640),(390,844),(800,1280)]:
  page.set_viewport_size({'width':size[0],'height':size[1]})
  page.evaluate('__game.UI.showMenu()')
  assert page.locator('#mGo').bounding_box()['y']>0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.locator('#mSet').bounding_box()['y']+page.locator('#mSet').bounding_box()['height']<=size[1],size
  page.screenshot(path=str(out/f'menu_{size[0]}.png'))
 page.set_viewport_size({'width':390,'height':844})
 page.evaluate("__game.UI.closeMenu()")
 # Winter ice hole must agree with the legacy canvas coordinates, including after drilling.
 page.evaluate("__game.G.startSession('pond','winter')")
 page.wait_for_timeout(400)
 winter=page.evaluate("""()=>{
   const h=FZ.Scene.holeGeom(),i=FZ.Scene.graphicsInfo();
   return {open:i.hole.open,delta:Math.max(
     Math.abs(i.hole.x-h.x/innerWidth),Math.abs(i.hole.y-h.y/innerHeight),
     Math.abs(i.hole.rx-h.rx/innerWidth),Math.abs(i.hole.ry-h.ry/innerHeight))};
 }""")
 assert winter['delta']<.001,winter
 assert winter['open']==0,winter
 ready=page.evaluate("""()=>{
   const G=__game.G,r=G.rig();r.state='wait';
   G.sess().hole={id:13,depth:1.5,lure:.8};
   FZ.Scene.render(G.view(2),.016);
   return FZ.Scene.graphicsInfo().hole.open;
 }""")
 assert ready==1,ready
 # Animated 2D reel crank angle follows the reel rotation from gameplay.
 turned=page.evaluate("""()=>{
   const G=__game.G,r=G.rig(),S=FZ.Scene;
   r.rod.reelAngle=0;S.render(G.view(2),.016);
   const start=S.graphicsInfo().reelCrankAngle;
   r.rod.reelAngle=1.8;S.render(G.view(2.05),.016);
   const end=S.graphicsInfo().reelCrankAngle;
   return Math.abs(end-start);
 }""")
 assert turned>1.5,turned
 page.screenshot(path=str(out/'winter-hole.png'))
 page.evaluate("__game.G.startSession('pond','summer');__game.UI.showSettings()")
 page.locator('#ambienceVolume').fill('23');page.locator('#ambienceVolume').dispatch_event('input')
 assert page.evaluate('__game.G.state().settings.ambienceVolume')==.23
 page.evaluate('__game.G.save(true)');page.reload();page.wait_for_function('window.__game')
 assert page.evaluate('__game.G.state().settings.ambienceVolume')==.23

 # A delayed reward popup must not interrupt the cast after pressing Fish.
 page.click('#mGo')
 page.wait_for_timeout(500)
 assert not page.evaluate("__game.UI.anyOpen()")
 page.evaluate("__game.G.startSession('pond','summer')")
 page.evaluate("FZ.Scene.initFallback(document.getElementById('cv'))")
 assert page.evaluate("FZ.Scene.graphicsInfo().renderer")=='canvas'
 page.mouse.move(195,470);page.mouse.down()
 assert page.evaluate("__game.aim()!==null"),'fallback failed to forward pointerdown'
 page.mouse.move(190,480);page.mouse.up()
 assert page.evaluate("__game.aim()===null"),'fallback failed to forward pointerup'
 assert not errors,errors
 (out/'portrait-validation.json').write_text(json.dumps(results,indent=2))
 print('PASS WebGL; 62 native portraits; bounded cache; snapshot; 3 viewports; mixer save migration')
 b.close();srv.shutdown()

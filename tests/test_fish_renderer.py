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
 # All four complete rod assets share the same calibrated screen projection.
 page.wait_for_function("Object.keys(FZ.RodArt.info('spin')).includes('reelX')")
 for mode in ['float','feeder','spin','ice']:
  assert page.evaluate("(m)=>FZ.RodArt.image(m).naturalWidth===1440",mode),mode
 # Cover all 20 seasonal locations without loading all photos at once.
 winter_waters=page.evaluate("""()=>{
   const G=__game.G;
   return FZ.LOCATIONS.map(l=>({
     id:l.id,coast:l.style==='coast',
     ice:G.isFrozen(l,'winter'),mode:G.modeFor('winter',l)
   }));
 }""")
 assert len(winter_waters)>=20,winter_waters
 assert all(x['ice']!=x['coast'] and (x['mode']=='ice')==x['ice'] for x in winter_waters),winter_waters
 # New single-image rods must load in both climates; no ferrules or joint sprites.
 dimensions=page.evaluate("""()=>{
   const G=__game.G,S=FZ.Scene;
   G.startSession('pond','summer');S.render(G.view(4),.016);
   const warm=S.graphicsInfo().tackle;
   G.startSession('pond','winter');S.render(G.view(4.1),.016);
   return {warm,cold:S.graphicsInfo().tackle};
 }""")
 assert dimensions['warm']['rodLength']>dimensions['cold']['rodLength']*1.8,dimensions
 assert dimensions['cold']['tipScreenY']<dimensions['cold']['holeScreenY'],dimensions
 assert dimensions['warm']['assetMode']=='float' and dimensions['cold']['assetMode']=='ice',dimensions
 assert dimensions['warm']['assetReady'] and dimensions['cold']['assetReady'],dimensions
 assert not dimensions['cold']['reelVisible'] and dimensions['cold']['iceDrumVisible'],dimensions
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
 # A drill must animate on ice without opening the hole early.
 drilling=page.evaluate("""()=>{
   const G=__game.G,S=FZ.Scene;
   G.startSession('pond','winter');
   const r=G.rig();r.state='drill';r.drillT=1;r.drillDur=2;
   S.render(G.view(1.5),.016);
   const h=S.graphicsInfo().hole;
   return {open:h.open,drilling:h.drilling};
 }""")
 assert drilling['open']==0 and .49<drilling['drilling']<.51,drilling
 # Winter seas stay open, inland lakes keep the ice-fishing mechanic.
 coasts=page.evaluate("""()=>{
   return ['blacksea','kamchatka','barents'].map(id=>{
     const s=__game.G.startSession(id,'winter');
     return {id,ice:s.ice,mode:s.mode};
   });
 }""")
 assert all(not x['ice'] and x['mode']!='ice' for x in coasts),coasts
 page.evaluate("__game.G.startSession('pond','winter')")
 page.screenshot(path=str(out/'winter-hole.png'))
 page.evaluate("__game.G.startSession('pond','summer');__game.UI.showSettings()")
 page.locator('#ambienceVolume').fill('23');page.locator('#ambienceVolume').dispatch_event('input')
 assert page.evaluate('__game.G.state().settings.ambienceVolume')==.23
 page.evaluate('__game.G.save(true)');page.reload();page.wait_for_function('window.__game')
 assert page.evaluate('__game.G.state().settings.ambienceVolume')==.23


 # Enforce bait tables in the actual running game, not only in data fixtures.
 bait_check=page.evaluate("""()=>{
   const G=__game.G,loc=FZ.LOCATIONS.find(l=>l.fish.bream);
   if(!loc)throw Error('No bream habitat');
   G.startSession(loc.id,'summer');G.sess().mode='float';
   G.sess().hour=12;G.sess().period='day';
   const load=G.state().load.float,old=load.bait;
   try{
     load.bait='livebait';
     const predatorBait=G.biteTable().filter(([s])=>s.id==='bream').length;
     load.bait='worm';
     const worm=G.biteTable().filter(([s])=>s.id==='bream').length;
     return {predatorBait,worm};
   }finally{load.bait=old;}
 }""")
 assert bait_check=={'predatorBait':0,'worm':1},bait_check

 # Native Chromium touch events exercise browser pointer capture and two fingers.
 page.evaluate("""()=>{
   window.__pointerTrace=[];
   for(const node of [document.getElementById('cv'),document.getElementById('bAct')])
     for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])
       node.addEventListener(type,e=>window.__pointerTrace.push({target:e.currentTarget.id,type,id:e.pointerId,at:performance.now()}));
 }""")
 page.click('#mGo');page.wait_for_timeout(500)
 for width,height in [(360,800),(390,844),(412,915)]:
  page.set_viewport_size({'width':width,'height':height})
  page.evaluate("""()=>{
    const G=__game.G;G.startSession('pond','summer');G.state().tut=4;
    G.state().load.spin={rod:'s2',line:'l4',hook:'h3',bait:'jig'};
    G.state().lures.jig=1;G.sess().mode='spin';
    const r=G.rig();r.state='wait';r.Z=24;r.idleT=-100;
    G.biteTable=()=>[];
    __game.UI.frame(.016,1);
  }""")
  cdp=page.context.new_cdp_session(page)
  box=page.locator('#bAct').bounding_box()
  reel={'id':11,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
  rod={'id':22,'x':width*.25,'y':height*.55}
  def touch(kind,points): cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
  touch('touchStart',[reel]);page.wait_for_timeout(100)
  assert page.evaluate('__game.G.rig().reeling')
  angle=page.evaluate('__game.G.rig().rod.reelAngle')
  touch('touchStart',[reel,rod])
  rod['x']+=40;touch('touchMove',[reel,rod]);page.wait_for_timeout(120)
  assert page.evaluate('__game.G.rig().tilt>0 && __game.G.rig().reeling')
  assert page.evaluate('__game.G.rig().rod.reelAngle')>angle
  touch('touchEnd',[rod]);page.wait_for_timeout(60)
  after_release=page.evaluate("""()=>({input:FZ.Input.snapshot(),reeling:__game.G.rig().reeling,
    state:__game.G.rig().state,mode:__game.G.sess().mode,open:__game.UI.anyOpen(),
    button:document.getElementById('bAct').className,
    trace:window.__pointerTrace.slice(-20)})""")
  assert after_release['reeling'] and after_release['input']['actions']==1 and after_release['input']['pointers']==0,f'multitouch release {width}x{height}: {after_release}'
  touch('touchEnd',[]);page.wait_for_timeout(100)
  assert not page.evaluate('__game.G.rig().reeling')
  angle=page.evaluate('__game.G.rig().rod.reelAngle');page.wait_for_timeout(100)
  assert abs(page.evaluate('__game.G.rig().rod.reelAngle')-angle)<.001
  touch('touchStart',[reel]);touch('touchCancel',[])
  assert not page.evaluate('__game.G.rig().reeling')
  touch('touchStart',[reel]);page.evaluate('__game.UI.showMenu()');page.wait_for_timeout(80)
  assert not page.evaluate('__game.G.rig().reeling')
  touch('touchEnd',[]);page.evaluate('__game.UI.closeMenu()')
  page.screenshot(path=str(out/f'multitouch-{width}.png'))
  cdp.detach()
 # Render actual net/fish trajectory at sampled phases and save framebuffer.
 import base64
 page.set_viewport_size({'width':390,'height':844})
 page.evaluate("FZ.Fish3D.ready(FZ.SP.pike)")
 previous=None
 for k in [0,.25,.5,.75,1]:
  sample=page.evaluate("""k=>{
    const G=__game.G,r=G.rig(),S=FZ.Scene;
    r.fish={s:FZ.SP.pike,w:3,lenM:.8,X:0,Z:4.5,surface:1,hooked:true};
    r.state='landing';r.landing={k,duration:1000};
    S.render(G.view(8+k),.016);
    return {pose:S.graphicsInfo().landing,png:S.snapshot().toDataURL()};
  }""",k)
  assert sample['pose']['visible']
  (out/f'net-{k}.png').write_bytes(base64.b64decode(sample['png'].split(',')[1]))
  if previous: assert sample['pose']['fishY']<=previous['fishY']
  previous=sample['pose']
 # The synthetic landing at k=1 is processed by the real frame loop and
 # legitimately opens a catch card. Resolve it before testing menu controls.
 if page.locator('#ovCatch.on').count():
  page.locator('#cKeep').click(timeout=5000)
 page.evaluate("__game.G.startSession('pond','summer')")

 # Capture real WebGL reel mechanism at two angles (not just angle metrics).
 page.evaluate("""()=>{
   const G=__game.G,r=G.rig();
   G.state().load.spin={rod:'s2',line:'l4',hook:'h3',bait:'jig'};
   G.state().lures.jig=1;G.sess().mode='spin';r.state='wait';r.Z=24;
   r.rod.reelAngle=0;FZ.Scene.render(G.view(10),.016);
 }""")
 page.screenshot(path=str(out/'reel-start.png'))
 page.evaluate("""()=>{
   const G=__game.G,r=G.rig();r.rod.reelAngle=2.2;
   FZ.Scene.render(G.view(10.1),.016);
 }""")
 page.screenshot(path=str(out/'reel-turn.png'))

 # A delayed reward popup must not interrupt the cast after pressing Fish.
 page.evaluate('__game.UI.showMenu()')
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

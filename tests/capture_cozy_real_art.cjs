/* Screenshots directly from the existing game renderer; no Android build. */
const assert=require("node:assert/strict");
const fs=require("fs"),path=require("path"),{chromium}=require("playwright");
const url=process.env.FISH_URL||"http://127.0.0.1:8080";
const dir="work/real-art-review";fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--no-sandbox"]});
 const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 let errs=[];
 page.on("pageerror",e=>errs.push(String(e)));
 page.on("response",r=>{if(r.status()>=400&&r.url().includes("/assets/equipment/"))errs.push(r.url()+" "+r.status())});
 await page.goto(url,{waitUntil:"domcontentloaded"});await page.waitForSelector("#mGo",{timeout:30000});
 await page.waitForTimeout(1000);await page.screenshot({path:path.join(dir,"01-menu.png")});
 for(const [tab,n] of Object.entries({rod:14,line:8,hook:5,bait:13,lure:11,extra:3})){
   await page.evaluate(t=>FZ.UI.showShop(t),tab);
   await page.waitForSelector(".cozy-catalog-row");await page.waitForTimeout(500);
   assert.equal(await page.locator(".cozy-catalog-row").count(),n,"catalog "+tab);
   const images=await page.evaluate(()=>[...document.querySelectorAll(".cozy-catalog-row .pic img")].slice(0,3).map(x=>({path:x.getAttribute("src"),ok:x.complete&&x.naturalWidth>0})));
   assert(images.every(i=>i.ok),"broken pictures "+tab+" "+JSON.stringify(images));
   await page.screenshot({path:path.join(dir,"02-"+tab+".png")});
   if(tab==="lure"){
      await page.locator('[data-cozy-id="spoon"]').click({position:{x:90,y:20}});
      await page.waitForTimeout(200);
      assert((await page.locator('[data-cozy-id="spoon"] .pic img').getAttribute("src")).includes("equipment/spoon.png"));
      await page.screenshot({path:path.join(dir,"03-spoon-selected.png")});
      for(const [pos,label] of [[450,"04-lures-middle"],[950,"05-lures-winter-sea"]]){
         await page.evaluate(y=>document.querySelector("#ovSheet .scroll").scrollTop=y,pos);
         await page.waitForTimeout(180);await page.screenshot({path:path.join(dir,label+".png")});
      }
   }
 }
 await page.evaluate(()=>FZ.UI.showTackle());await page.waitForSelector(".cozy-skins button");
 assert.equal(await page.locator(".cozy-skins button").count(),3);
 await page.waitForTimeout(250);await page.screenshot({path:path.join(dir,"06-tackle.png")});
 await page.evaluate(()=>{FZ.UI.closeSheet&&FZ.UI.closeSheet();FZ.UI.closeMenu&&FZ.UI.closeMenu();FZ.Game.startSession("pond","summer")});
 await page.waitForTimeout(650);await page.screenshot({path:path.join(dir,"07-game-water.png")});
 // Test a real float on a windy day, then restore the world state untouched.
 const bobState=await page.evaluate(()=>{
   const G=FZ.Game,s=G.sess(),r=G.rig(),wind=s.wx.wind;
   r.state="wait";r.X=1;r.Z=13;
   const originalWind=wind;
   s.wx.wind=0;
   const calm=Array.from({length:20},(_,i)=>G.view(i*.25).tackle.bob);
   s.wx.wind=10;
   const breezy=Array.from({length:20},(_,i)=>G.view(i*.25).tackle.bob);
   s.wx.wind=originalWind;
   const span=a=>Math.max(...a)-Math.min(...a);
   return{calm:span(calm),breezy:span(breezy),mode:s.mode};
 });
 assert(bobState.mode==="float"&&bobState.breezy>bobState.calm*2.5,
   "real float must move with session wind "+JSON.stringify(bobState));
 await page.evaluate(()=>{
   const G=FZ.Game,s=G.sess(),r=G.rig();
   r.state="wait";r.X=0;r.Z=12;s.wx.__reviewWind=s.wx.wind;s.wx.wind=8;
 });
 await page.waitForTimeout(150);
 await page.screenshot({path:path.join(dir,"07b-windy-float.png")});
 await page.evaluate(()=>{const s=FZ.Game.sess();s.wx.wind=s.wx.__reviewWind;delete s.wx.__reviewWind});
 // Real engine renders the equipped lure; set up a playable spin scene.
 await page.evaluate(()=>{
   const G=FZ.Game,st=G.state();
   st.active="spin";if(!st.rods.includes("s1"))st.rods.push("s1");
   st.load.spin.rod="s1";
   st.lures.wobbler=1;st.load.spin.bait="wobbler";
   G.startSession("pond","summer");
   const r=G.rig();r.state="wait";r.X=1;r.Z=15;r.reeling=true;r.spinPause=0;
 });
 await page.waitForTimeout(450);
 const moving=await page.evaluate(()=>({angle:FZ.Game.rig().rod.reelAngle,active:FZ.Game.rig().reeling,
   lure:FZ.Game.loadout("spin").bait,spinMode:FZ.Game.sess().mode}));
 assert(moving.active&&moving.spinMode==="spin"&&moving.lure==="wobbler",JSON.stringify(moving));
 assert(Math.abs(moving.angle)>.1,"real spool handle rotated while retrieving");
 await page.screenshot({path:path.join(dir,"08-wobbler-retrieve.png")});
 await page.evaluate(()=>{FZ.Game.rig().reeling=false});
 await page.waitForTimeout(420);
 await page.screenshot({path:path.join(dir,"09-wobbler-paused.png")});
 // Touch the genuine canvas; do not use a fake overlay or force a catch.
 await page.evaluate(()=>{const r=FZ.Game.rig();r.state='wait';r.bite=null;r.spinPause=.45;r.reeling=false;r.twitchCooldown=0});
 await page.touchscreen.tap(195,410);
 await page.waitForTimeout(65);
 const twitch=await page.evaluate(()=>({pulse:FZ.Game.rig().spinPulse||0,state:FZ.Game.rig().state}));
 assert(twitch.pulse>.1&&twitch.state==='wait','short canvas tap must twitch the real lure '+JSON.stringify(twitch));
 await page.screenshot({path:path.join(dir,"09b-wobbler-twitch.png")});
 await page.evaluate(()=>{FZ.Game.state().lures.mouse=1;FZ.Game.state().load.spin.bait="mouse";FZ.Game.rig().reeling=true});
 await page.waitForTimeout(330);
 await page.screenshot({path:path.join(dir,"10-mouse-retrieve.png")});
 // Exercise the actual gameplay fight renderer, never a composited illustration.
 await page.evaluate(()=>{
   const G=FZ.Game,st=G.state();
   st.active="spin";st.load.spin.rod="s1";st.lures.wobbler=1;
   st.load.spin.bait="wobbler";
   const r=G.rig();r.state="bite";
   r.bite={s:FZ.SP.pike,w:3,take:2,style:"drag",t:.6,phase:"take"};
   G.strike();
   if(r.state!=="fight"||!r.fish)throw Error("real game failed to hook pike");
   r.reeling=false;
   Object.assign(r.fish,{X:1,Z:10,D:.1,surface:.9,phase:"run",phaseT:1.4,
     nextPhase:null,vx:2.2,vz:.35,S:.7,slackT:0});
 });
 await page.waitForTimeout(130);
 const pike=await page.evaluate(()=>{
   const f=FZ.Game.rig().fish;return{phase:f?.phase,energy:FZ.CozyMotion.surfaceEnergy(f),hud:document.querySelector('#cozyFightSignal')?.textContent};
 });
 assert(pike.phase==="run"&&pike.energy>.20&&pike.hud,"real pike fight must animate and update the HUD "+JSON.stringify(pike));
 const runCoach=await page.locator('#hHint').textContent();
 assert(!runCoach.includes('Удерживайте — подмотка'),
   'active pike run must not be accompanied by a contradictory tutorial '+runCoach);
 await page.screenshot({path:path.join(dir,"11-pike-fight-real.png")});
 await page.evaluate(()=>{
   // Freeze the simulation, but keep real game graphics and HUD rendering.
   FZ.appSuspended=true;
   const G=FZ.Game,r=G.rig(),f=r.fish;
   f.s=FZ.SP.catfish;f.w=12;f.phase="dive";f.phaseT=1.1;
   f.X=0;f.Z=14;f.D=2.6;f.surface=.03;f.vx=.1;f.vz=.65;
   f.S=.7;f.slackT=0;r.reeling=false;
 });
 await page.waitForTimeout(130);
 const catfish=await page.evaluate(()=>{
   const f=FZ.Game.rig().fish;return{phase:f?.phase,energy:FZ.CozyMotion.surfaceEnergy(f),hud:document.querySelector('#cozyFightSignal')?.textContent};
 });
 assert(catfish.phase==="dive"&&catfish.energy<.12&&catfish.hud.includes("глубине"),
   "deep catfish must not render fake surface wake "+JSON.stringify(catfish));
 assert((await page.locator('#hHint').textContent()).includes('давит на глубину'),
   'the real fight coach must show a deep dive, even during the first trophy');
 await page.screenshot({path:path.join(dir,"12-catfish-deep-real.png")});
 // The first fish must not be coached to reel into a deep dive or a line break.
 const tutorial=await page.evaluate(()=>{
   const G=FZ.Game,UI=FZ.UI,r=G.rig(),f=r.fish,st=G.state(),s=G.sess();
   st.tut=1;f.phase="dive";f.tension=.42;f.overload=0;f.diveWarning=true;
   f.warning=false;f.slipping=false;f.slackT=0;
   UI.hint(s,r,st,0);
   const dive=document.querySelector('#hHint').textContent;
   f.diveWarning=false;f.phase="rest";f.slipping=true;f.tension=.71;
   UI.hint(s,r,st,0);UI.frame(.016,0);
   const slip=document.querySelector('#hHint').textContent;
   const slipPanel=document.querySelector('#hTens').dataset.cozyRisk;
   f.tension=.97;f.slipping=false;UI.hint(s,r,st,0);UI.frame(.016,0);
   const danger=document.querySelector('#hHint').textContent;
   const dangerPanel=document.querySelector('#hTens').dataset.cozyRisk;
   return{dive,slip,slipPanel,danger,dangerPanel};
 });
 assert(tutorial.dive.includes('Уход на глубину')&&!tutorial.dive.includes('Удерживайте'),
   'tutorial must not override the urgent dive warning '+JSON.stringify(tutorial));
 assert(tutorial.slip.includes('Фрикцион')&&tutorial.slipPanel==='slip',
   'safe slipping drag has its own clear HUD signal '+JSON.stringify(tutorial));
 assert(tutorial.danger.includes('Опасное натяжение')&&tutorial.dangerPanel==='danger',
   'critical tension overrides tutorial and normal drag '+JSON.stringify(tutorial));
 await page.screenshot({path:path.join(dir,"12b-line-warning-tutorial.png")});
 // Leave the live game unpaused before exiting the browser test.
 await page.evaluate(()=>{FZ.appSuspended=false});
 // Verify the real render extensions are loaded and physical states gate effects.
 const waterPhysics=await page.evaluate(()=>{
   const g=FZ.CozyGear,b=FZ.CozyFeedback;
   return{
     bobberVisible:g.meniscusStrength(0,0,0),
     bobberBite:g.meniscusStrength(.10,.9,9),
     bobberSubmerged:g.meniscusStrength(1.15,.9,9),
     shallow:b.surfaceActivity({phase:"run",D:.1,surface:.9,vx:2,vz:.5}),
     deep:b.surfaceActivity({phase:"dive",D:3.1,surface:1,vx:3,vz:2})
   };
 });
 assert(waterPhysics.bobberBite>waterPhysics.bobberVisible*2 &&
   waterPhysics.bobberSubmerged===0,
   'float creates realistic water contact only at its actual surface '+JSON.stringify(waterPhysics));
 assert(waterPhysics.shallow>.5&&waterPhysics.deep===0,
   'no fake droplets over a deep fish '+JSON.stringify(waterPhysics));
 assert.deepEqual(errs,[]);console.log("PASS: actual gameplay/real pike fight/deep catfish/speed-driven reel/true float contact/6 shop tabs");
 await b.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

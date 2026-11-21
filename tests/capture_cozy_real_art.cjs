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
 assert.deepEqual(errs,[]);console.log("PASS: actual gameplay/6 shop tabs/real asset paths/no broken images");
 await b.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

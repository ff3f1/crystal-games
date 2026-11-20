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
 assert.deepEqual(errs,[]);console.log("PASS: actual gameplay/6 shop tabs/real asset paths/no broken images");
 await b.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

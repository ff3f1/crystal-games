/* UI and gear checks for cozy fishing, no paid ad calls. */
const {chromium}=require("playwright"),assert=require("assert"),fs=require("fs"),path=require("path");
const url=process.env.FISH_URL||"http://127.0.0.1:8080";
const out=process.env.FISH_OUT||"work/cozy";fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",headless:true,args:["--no-sandbox","--autoplay-policy=no-user-gesture-required"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const failures=[];
 page.on("pageerror",e=>failures.push(e.stack||e.message));
 page.on("response",r=>{if(r.status()>=400&&r.url().includes("/assets/cozy/"))failures.push("Missing art: "+r.url())});
 await page.goto(url);await page.waitForSelector("#mGo",{timeout:30000});
 assert.equal(await page.locator("#ovMenu.cozy-lodge .tile").count(),9);
 // Screenshot only after entrance transitions have completed, not at opacity:0.
 await page.waitForTimeout(1000);
 const menuStatus=await page.evaluate(()=>{
   const ov=document.getElementById("ovMenu"),buttons=[...ov.querySelectorAll(".lodge-grid .tile")];
   return { count:buttons.length,visible:buttons.every(b=>{
     const r=b.getBoundingClientRect(),cs=getComputedStyle(b);
     return r.width>35&&r.height>35&&cs.opacity>.98&&cs.visibility!=="hidden";
   }), go:getComputedStyle(document.getElementById("mGo")).opacity};
 });
 assert(menuStatus.visible&&Number(menuStatus.go)>.98,JSON.stringify(menuStatus));
 await page.screenshot({path:path.join(out,"menu.png")});
 await page.evaluate(()=>FZ.UI.showTackle());
 await page.waitForSelector(".cozy-skins button");
 assert.equal(await page.locator(".cozy-skins button").count(),3);
 await page.screenshot({path:path.join(out,"tackle.png")});
 await page.locator('[data-cozy="forest"]').click();
 assert.equal(await page.evaluate(()=>FZ.Game.state().settings.cozyFloatSkin),"forest");
 await page.locator('[data-cozy="match"]').click();
 assert.equal(await page.evaluate(()=>FZ.Game.state().settings.cozyFloatSkin),"match");
 await page.reload();await page.waitForSelector("#mGo");
 assert.equal(await page.evaluate(()=>FZ.Game.state().settings.cozyFloatSkin),"match");
 assert(await page.evaluate(()=>FZ.Art.icon("float",64).includes("float_match.svg")));
 const tint=await page.evaluate(()=>{
   FZ.Game.state().load.float.line="l1";
   const one=FZ.CozyGear.lineStyle({mode:"float"},{dark:0});
   FZ.Game.state().load.float.line="l5";
   const two=FZ.CozyGear.lineStyle({mode:"float"},{dark:0});
   return {one,two};
 });
 assert(tint.two.width>tint.one.width&&tint.two.color!==tint.one.color);
 await page.evaluate(()=>{FZ.UI.closeMenu();FZ.Game.startSession("pond","summer");FZ.Game.cast(0,8)});
 await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,"water.png")});
 await page.evaluate(()=>{FZ.Scene.ring(0,8,.5,1.4);FZ.Scene.splash(0,8,.4)});
 await page.waitForTimeout(170);
 await page.screenshot({path:path.join(out,"splash.png")});
 // Real scene preview with a staged hooked-fish state. This is NOT a recorded catch;
 // it ensures the live Canvas renderer draws the real species asset without errors.
 await page.evaluate(()=>{
   const fish=FZ.SP.pike,rig=FZ.Game.rig(),w=6.8;
   FZ.Game.update=()=>{};
   rig.state="fight";rig.reeling=false;rig.X=2;rig.Z=8;
   rig.fish={s:fish,w,lenCm:89,lenM:.89,hooked:true,X:2,Z:8,D:0,vx:1.2,vz:.2,
     S:.7,effort:.5,phase:"run",phaseT:.8,T:1.5,Fmax:7,slackT:0,snagT:0,
     surface:.92,jump:null,jumped:0,t:4,tension:.4,strained:false,warning:false};
 });
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,"fight-scene.png")});
 assert.deepEqual(failures,[],failures.join("\n"));
 console.log("PASS menu, 3 bobber skins, save reload, icon, line tint, cast and splash");
 await browser.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

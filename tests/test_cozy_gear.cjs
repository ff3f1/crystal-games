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
 // Confirm all model-specific assets are used, not one generic icon.
 const art=await page.evaluate(()=>({
   rod1:FZ.Art.icon("f1",80),rod3:FZ.Art.icon("f3",80),
   line1:FZ.Art.icon("l1",80),line7:FZ.Art.icon("l7",80),
   hook1:FZ.Art.icon("h1",80),hook4:FZ.Art.icon("h4",80),
   worm:FZ.Art.icon("worm",80),jig:FZ.Art.icon("jig",80),
   echo:FZ.Art.icon("echo",80),corn:FZ.Art.icon("corn",80),
   oceanRod:FZ.Art.icon("s4",80),seaLine:FZ.Art.icon("l8",80),seaHook:FZ.Art.icon("h5",80),
   seaLure:FZ.Art.icon("sea_wobbler",80),seaJig:FZ.Art.icon("deep_jig",80)
 }));
 assert(art.rod1.includes("rod_f1.svg")&&art.rod3.includes("rod_f3.svg"));
 assert(art.line1.includes("line_l1.svg")&&art.line7.includes("line_l7.svg"));
 assert(art.hook1.includes("hook_h1.svg")&&art.hook4.includes("hook_h4.svg"));
 assert(art.worm.includes("bait_worm.svg")&&art.jig.includes("bait_jig.svg"));
 assert(art.echo.includes("extra_echo.svg")&&art.corn.includes("bait_corn.svg"));
 assert(art.oceanRod.includes("rod_s4.svg")&&art.seaLine.includes("line_l8.svg"));
 assert(art.seaHook.includes("hook_h5.svg")&&art.seaLure.includes("bait_sea_wobbler.svg"));
 assert(art.seaJig.includes("bait_deep_jig.svg"));
 // Every enumerated catalog item must map to a real SVG path.
 const required=await page.evaluate(()=>[
    ...FZ.RODS,...FZ.LINES,...FZ.HOOKS,...FZ.BAITS,
    ...Object.values(FZ.EXTRAS),FZ.GROUNDBAIT
  ].map(x=>FZ.Art.icon(x.id,80)));
 assert.equal(required.length,14+8+5+23+3+1);
 assert(required.every(u=>u.startsWith("assets/cozy/")&&u.endsWith(".svg")));
 await page.evaluate(()=>FZ.UI.showShop("rod"));
 await page.waitForSelector(".cozy-preview img");
 const shopDiag=await page.evaluate(()=>({
   tab:document.querySelector('#ovSheet .tabs .tab.on')?.dataset.tab,
   rows:document.querySelector('#ovSheet .scroll')?.querySelectorAll('.row').length,
   direct:[...(document.querySelector('#ovSheet .scroll')?.children||[])].filter(x=>x.classList.contains('row')).length,
   decorated:document.querySelectorAll('.cozy-catalog-row').length,
   initial:document.querySelector('#ovSheet .sheet')?.innerHTML.slice(0,400),
   modules:{inventory:!!FZ.CozyInventory,shop:typeof FZ.UI.showShop}
 }));
 console.log("SHOP DEBUG",JSON.stringify(shopDiag));
 assert.equal(await page.locator(".cozy-catalog-row").count(),14,"14 rods in full game catalog");
 const source=await page.locator(".cozy-catalog-row").first().locator(".pic img").getAttribute("src");
 assert(source.includes("rod_f1.svg"),source);
 await page.screenshot({path:path.join(out,"shop-rods.png")});
 await page.evaluate(()=>FZ.UI.showShop("line"));
 assert.equal(await page.locator(".cozy-catalog-row").count(),8,"8 line models");
 await page.screenshot({path:path.join(out,"shop-lines.png")});
 await page.evaluate(()=>FZ.UI.showShop("lure"));
 assert.equal(await page.locator(".cozy-catalog-row").count(),11,"11 distinct lures incl sea");
 await page.screenshot({path:path.join(out,"shop-lures.png")});
 await page.evaluate(()=>FZ.UI.showShop("hook"));
 assert.equal(await page.locator(".cozy-catalog-row").count(),5,"5 hooks");
 await page.screenshot({path:path.join(out,"shop-hooks.png")});
 await page.evaluate(()=>FZ.UI.showShop("extra"));
 assert.equal(await page.locator(".cozy-catalog-row").count(),3,"3 extra tools");
 await page.screenshot({path:path.join(out,"shop-tools.png")});
 await page.evaluate(()=>FZ.UI.showShop("bait"));
 assert.equal(await page.locator(".cozy-catalog-row").count(),13,"12 baits and groundbait");
 await page.screenshot({path:path.join(out,"shop-bait.png")});
 await page.evaluate(()=>FZ.UI.showBait());
 assert(await page.locator(".cozy-bait-advice").count()>4);
 await page.screenshot({path:path.join(out,"bait-recommendations.png")});
 await page.evaluate(()=>FZ.UI.showTackle());
 await page.waitForSelector(".cozy-skins button");
 assert.equal(await page.locator(".cozy-skins button").count(),3);
 assert.equal(await page.locator(".cozy-loadout .cozy-slot").count(),4,"poplar float setup shows 4 selected gear slots");
 assert(await page.locator(".cozy-equipped-row .pic img").count()>3);
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

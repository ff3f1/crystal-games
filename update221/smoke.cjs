const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage({viewport:{width:412,height:860},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',msg=>{if(msg.type()==='error')console.log('console',msg.text())});
 await page.goto('http://localhost:8246');
 await page.locator('#mGo').waitFor();await page.waitForTimeout(650);
 await page.screenshot({path:'out/cabin.png'});
 await page.locator('#cabinExtras').click();await page.locator('#mAtlas').waitFor();await page.locator('#cabinClose').click();
 await page.locator('#mGo').click();
 const wait=fn=>page.waitForFunction(fn,null,{timeout:45000});
 await page.evaluate(()=>{FZ.Game.startSession('pond','summer'); FZ.Game.equip('float','bait','bread');FZ.UI.refreshTools()});
 await page.locator('#bAct').click();
 await wait(()=>FZ.Game.rig().state==='wait'&&FZ.Game.rig().hunt?.fish);
 assert(await page.evaluate(()=>{const r=FZ.Game.rig(),h=r.hunt,y=h.y,x=h.x;FZ.Dive.twitch(r);return h.x===x&&h.y===y&&h.liftSpeed<0}));
 await page.waitForTimeout(1800);await page.screenshot({path:'out/bread.png'});
 await wait(()=>FZ.Game.rig().bite?.phase==='take');
 await page.keyboard.press('Space');await wait(()=>FZ.Game.rig().state==='fight');
 // Render known jump poses in both orientations and prove that line and art use the same mouth in canvas coordinates.
 await page.evaluate(()=>{
   const {Game:g,Scene:sc,Art:art}=FZ, r=g.rig();r.fish.s=FZ.SP.pike;r.fish.lenM=.85;r.fish.Z=4.3;r.fish.X=-.1;
   const canvas=document.querySelector('#cv'),ctx=canvas.getContext('2d');
   for(const dir of [-1,1])for(const k of [.1,.5,.85]){
     r.fish.jump={k,dir};const v=g.view(12),p=sc.proj(v.fish.X,v.fish.Z),pose=sc.fightPose(v.fish,p,12),mouth=art.mouth(v.fish.s,pose);
     const original=ctx.quadraticCurveTo,line=ctx.lineTo;let matched=false;
     const check=(x,y)=>{if(Math.hypot(x-mouth.x,y-mouth.y)<.05)matched=true};
     ctx.lineTo=function(x,y){check(x,y);return line.call(this,x,y)};
     ctx.quadraticCurveTo=function(a,b,x,y){check(x,y);return original.call(this,a,b,x,y)};
     try{sc.render(v,0)}finally{ctx.lineTo=line;ctx.quadraticCurveTo=original}
     if(!matched)throw Error('Line missed mouth');
   }
   r.fish.jump={k:.46,dir:1};r.fish.t=6;sc.render(g.view(12),0);FZ.appSuspended=true;
 });
 await page.screenshot({path:'out/pike.png'});
 await page.evaluate(()=>{const g=FZ.Game;FZ.appSuspended=false;g.endSession();g.startSession('pond','summer');g.state().lvl=5;g.state().money=5000;g.buy('rod','s1');g.setActive('spin');FZ.UI.refreshTools()});
 await page.locator('#bAct').click();await wait(()=>FZ.Game.rig().state==='wait'&&FZ.Game.rig().hunt);
 const point=()=>page.evaluate(()=>{const r=FZ.Game.rig();return [r.hunt.lx,r.hunt.ly,r.Z]});await wait(()=>FZ.Game.rig().hunt.age>.15);const before=await point();
 await page.keyboard.down('Space');await page.waitForTimeout(950);await page.keyboard.up('Space');
 const after=await point();assert(after[0]>before[0] && after[2]<before[2] && Math.abs(after[1]-before[1])<.025,JSON.stringify({before,after}));
 await page.waitForTimeout(650);const paused=await point();assert(paused[1]>after[1] && Math.abs(paused[0]-after[0])<.004);
 await page.screenshot({path:'out/spin.png'});
 await page.evaluate(()=>{const g=FZ.Game;g.endSession();g.startSession('pond','winter');FZ.UI.refreshTools()});
 await page.locator('#bAct').click();await wait(()=>FZ.Game.rig().state==='wait'&&FZ.Game.rig().hunt);
 await page.locator('#bAct').click();assert(await page.evaluate(()=>{const g=FZ.Game,h=g.rig().hunt;g.setLure(.25);return g.rig().hunt===h}));await page.waitForTimeout(1400);
 assert(await page.evaluate(()=>FZ.Game.rig().hunt.depth<.38));
 await page.screenshot({path:'out/ice.png'});
 for(const size of [{width:412,height:860},{width:860,height:412}]){
   await page.setViewportSize(size);
   await page.evaluate(()=>{
     const {Game:g,Dive:d}=FZ,ctx=document.querySelector('#cv').getContext('2d');
     const draw=ctx.drawImage,move=ctx.moveTo;let hole,anchored=false;
     ctx.drawImage=function(im,x,y,w,h,...extra){
       if(im.src?.endsWith('/winter.webp'))hole=[x+w*.698,y+h*.178];
       return draw.call(this,im,x,y,w,h,...extra);
     };
     ctx.moveTo=function(x,y){if(hole && Math.hypot(x-hole[0],y-hole[1])<.05)anchored=true;return move.call(this,x,y)};
     try{d.render(g.rig(),g.sess(),12)}finally{ctx.drawImage=draw;ctx.moveTo=move}
     if(!anchored)throw Error('Ice line did not start inside the painted hole');
   });
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

/* Capture actual unmodified Fishing 1.0.10 gameplay with Playwright. No fake fish or CGI footage. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{chromium}=require('playwright');
const out=path.resolve(process.env.PROMO_OUT||'promo-output');
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:540,height:960},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),t0=Date.now(),marks={},states=[],errors=[];
 const mark=s=>{marks[s]=(Date.now()-t0)/1000;};
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400 && r.url().startsWith('http://127.0.0.1'))errors.push(r.status()+' '+r.url())});
 const state=()=>page.evaluate(()=>({state:FZ.Game.rig().state,phase:FZ.Game.rig().bite&&FZ.Game.rig().bite.phase,fish:FZ.Game.rig().fish&&FZ.Game.rig().fish.s.n,season:FZ.Game.sess().season,map:FZ.Game.sess().loc.id}));
 const frames=path.join(out,'frames');
 fs.mkdirSync(frames,{recursive:true});
 const cdp=await context.newCDPSession(page);
 let frameCount=0,firstFrame=null,lastFrame=null,recording=true,shotError=null;
 // CDP screencast only captures Chrome's host surface (wrong mobile aspect).
 // Capture the actual 540x960 emulated viewport, with all DOM/CSS/canvas layers.
 const captureLoop=(async()=>{
  while(recording){
   try{
    const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:76,
      captureBeyondViewport:false,fromSurface:true});
    const at=(Date.now()-t0)/1000;
    if(firstFrame===null)firstFrame=at;
    lastFrame=at;
    fs.writeFileSync(path.join(frames,String(frameCount).padStart(6,'0')+'.jpg'),
      Buffer.from(shot.data,'base64'));
    frameCount++;
   }catch(e){if(recording){shotError=String(e);recording=false;}}
   await pause(25);
  }
 })();
 async function tickUntil(kind,max=1500) {
  return page.evaluate(({kind,max})=>{
   const G=FZ.Game,UI=FZ.UI;
   for(let i=0;i<max;i++){
    const r=G.rig();
    if(kind==='bite' && r.state==='bite')return i;
    if(kind==='take' && r.state==='bite'&&r.bite.phase==='take')return i;
    if(r.state==='result'||r.lost)throw Error('Unexpected state before '+kind+': '+r.state);
    G.update(1/60,G.sess().t+1/60);
    for(const e of G.events())UI.onEvent(e);
   }
   throw Error('Timed out waiting for '+kind+' at '+G.rig().state);
  },{kind,max});
 }
 await page.goto(process.env.FISH_URL||'http://127.0.0.1:8080/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#mGo',{timeout:90000});
 await page.waitForTimeout(650);
 mark('menu');
 await page.screenshot({path:path.join(out,'source-menu.png')});
 await pause(3300);
 await page.locator('#mMap').click();
 mark('map');
 await pause(3100);
 await page.screenshot({path:path.join(out,'source-maps.png')});
 await page.evaluate(()=>{
  FZ.UI.closeSheet();
  if(FZ.UI.closeMenu)FZ.UI.closeMenu();
  FZ.Game.startSession('pond','summer');
  FZ.Game.skipTo('dawn');
  for(const e of FZ.Game.events())FZ.UI.onEvent(e);
  FZ.UI.refreshTools();
 });
 mark('water');
 await pause(3200);
 await page.screenshot({path:path.join(out,'source-pond.png')});
 if((await state()).state!=='idle')throw Error('Not ready for real cast: '+JSON.stringify(await state()));
 await page.locator('#bAct').click();
 mark('cast');
 await pause(2100);
 await tickUntil('bite');
 mark('bite');
 await pause(750);
 await tickUntil('take');
 mark('take');
 await pause(280);
 await page.locator('#bAct').click();
 if((await state()).state!=='fight')throw Error('Genuine strike failed: '+JSON.stringify(await state()));
 mark('fight');
 await page.screenshot({path:path.join(out,'source-fight.png')});
 const started=Date.now();
 let current='fight';
 while(Date.now()-started<9800){
  current=await page.evaluate(()=>{
   const G=FZ.Game,UI=FZ.UI,r=G.rig();
   for(let i=0;i<7;i++){
    if(r.state!=='fight')break;
    const f=r.fish,line=G.gear(G.sess().mode).line.test;
    r.tilt=f.vx>0?-.9:.9;
    r.reeling=f.phase!=='run' && f.T<line*.77;
    G.update(1/60,G.sess().t+1/60);
    for(const e of G.events())UI.onEvent(e);
   }
   return r.state;
  });
  if(current!=='fight')break;
  await pause(100);
 }
 if(current==='fight'){
  // Time-lapse only the normal game physics, with adaptive reeling. No state injection.
  for(let k=0;k<300 && current==='fight';k++){
   current=await page.evaluate(()=>{
    const G=FZ.Game,UI=FZ.UI,r=G.rig();
    for(let i=0;i<14;i++){
     if(r.state!=='fight')break;
     const f=r.fish,line=G.gear(G.sess().mode).line.test;
     r.tilt=f.vx>0?-.9:.9;
     r.reeling=f.phase!=='run'&&f.T<line*.76;
     G.update(1/60,G.sess().t+1/60);
     for(const e of G.events())UI.onEvent(e);
    }
    return r.state;
   });
   if(k%10===0)await pause(30);
  }
 }
 if(current==='landing'){
  await page.waitForFunction(()=>FZ.Game.rig().state==='result',{timeout:8000}).catch(()=>{});
 }
 current=(await state()).state;
 if(current!=='result')throw Error('No natural catch reached: '+JSON.stringify(await state()));
 await page.locator('#cRel, #cKeep').first().waitFor({timeout:6000});
 mark('catch');
 await page.screenshot({path:path.join(out,'source-catch.png')});
 await pause(4400);
 if(await page.locator('#cKeep').count())await page.locator('#cKeep').click();
 else await page.locator('#cRel').click();
 await page.evaluate(()=>FZ.UI.showMenu());
 mark('outro');
 await pause(3700);
 mark('end');
 states.push(await state());
 await pause(300);
 recording=false;
 await captureLoop;
 if(shotError)throw Error('Viewport screen capture failed: '+shotError);
 await context.close();
 await browser.close();
 if(frameCount<150)throw Error('Too few real screencast frames: '+frameCount);
 const fps=(frameCount-1)/Math.max(.01,lastFrame-firstFrame);
 if(fps<6)throw Error('Screencast frame rate too low: '+fps);
 for(const key of Object.keys(marks))marks[key]=+(marks[key]-firstFrame).toFixed(3);
 const dest=path.join(out,'real-1.0.10-footage.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',fps.toFixed(5),
   '-i',path.join(frames,'%06d.jpg'),'-c:v','libx264','-preset','ultrafast',
   '-crf','26','-vf','scale=540:960:flags=lanczos','-pix_fmt','yuv420p','-movflags','+faststart',dest],{stdio:'inherit'});
 if(errors.length)throw Error('Game errors: '+errors.join(' | '));
 fs.writeFileSync(path.join(out,'timeline.json'),JSON.stringify({marks,states,source:'Original Fishing 1.0.10',baseCommit:'b77f8443f482b4de083b4b88ada2d2f99f232bc9',footage:path.basename(dest),captureFPS:fps,frameCount},null,2));
 console.log('CAPTURE SUCCESS '+JSON.stringify({marks,states,file:dest,bytes:fs.statSync(dest).size,frameCount,fps}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

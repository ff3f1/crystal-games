const {chromium}=require('playwright');const assert=require('assert');const fs=require('fs');fs.mkdirSync('work/fishing2-checks',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await page.goto(process.env.FISH_URL||'http://127.0.0.1:8080');await page.waitForTimeout(300);
 assert(await page.locator('#homeScreen').isVisible());
 await page.click('#homeMaps');assert.equal(await page.locator('.map-card:visible').count(),6);
 await page.click('[data-season="Зима"]');assert.equal(await page.locator('.map-card:visible').count(),3);
 await page.click('#closeMaps');await page.click('#homeSettings');
 await page.locator('#musicVolume').fill('24');await page.locator('#musicVolume').dispatchEvent('input');
 assert.equal(await page.evaluate(()=>Fishing2.save.volumes.music),.24);
 await page.click('#closeSettings');await page.click('#homeCollection');assert.equal(await page.locator('.fish-tile').count(),22);
 await page.locator('.fish-tile').first().click();assert(await page.locator('#detailHabitat').textContent());await page.click('#closeFish');await page.click('#closeGear');
 await page.click('#continueGame');await page.waitForTimeout(300);
 for(const key of await page.evaluate(()=>Object.keys(Fishing2.maps))){
  await page.evaluate(k=>Fishing2.changeMap(k),key);await page.waitForTimeout(100);
  await page.click('#bait');assert.equal(await page.locator('.bait-option').count(),4);await page.click('#closeBait');
  await page.evaluate(()=>{const a=Fishing2.maps[Fishing2.game.map].spots[1];Fishing2.aimAt(innerWidth*a[1],innerHeight*a[2])});
  await page.locator('#action').dispatchEvent('pointerdown',{pointerId:1});await page.locator('#action').dispatchEvent('pointerup',{pointerId:1});
  let mode=await page.evaluate(()=>{for(let i=0;i<1000;i++){Fishing2.physics(1/60);if(Fishing2.game.mode==='take')break}return Fishing2.game.mode});
  assert.equal(mode,'take',key+' must reach bite');
  // Allow a realistic human reaction before pressing the strike button.
  await page.evaluate(()=>{for(let i=0;i<15;i++)Fishing2.physics(1/60)});
  await page.locator('#action').dispatchEvent('pointerdown',{pointerId:2});await page.locator('#action').dispatchEvent('pointerup',{pointerId:2});
  assert.equal(await page.evaluate(()=>Fishing2.game.mode),'fight');
  // Adaptive reeling uses the same warnings shown to a player. No forced catch.
  for(let i=0;i<1600;i++){
   const state=await page.evaluate(()=>({mode:Fishing2.game.mode,run:Fishing2.game.run,runTime:Fishing2.game.runTime}));
   if(state.mode==='caught')break;
   if(state.mode==='ready')throw new Error('Fish escaped on '+key);
   if(state.mode==='fight')await page.locator('#action').dispatchEvent(state.run>.08||state.runTime<.63?'pointerup':'pointerdown',{pointerId:3});
   await page.evaluate(()=>{for(let i=0;i<6;i++)Fishing2.physics(1/60)});
  }
  assert.equal(await page.evaluate(()=>Fishing2.game.mode),'caught',key+' lands');
  assert(await page.locator('#catchScreen').isVisible());
  console.log('PASS natural catch loop',key,await page.locator('#catchSpecies').textContent());
  if(key==='pond_summer')await page.screenshot({path:'work/fishing2-checks/catch.png'});
  await page.click('#again');
 }
 await page.click('#pause');const before=await page.evaluate(()=>Fishing2.game.wait);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Fishing2.game.wait),before);
 await page.click('#toHome');await page.click('#homeJournal');
 const claim=page.locator('[data-quest="first"]');await claim.click();const balance=await page.evaluate(()=>Fishing2.save.coins);
 assert(await claim.isDisabled());await page.click('#closeJournal');await page.click('#homeGear');
 const upgrade=page.locator('[data-gear="rod"]');await upgrade.click();assert.equal(await page.evaluate(()=>Fishing2.save.gear.rod),1);await page.click('#closeGear');
 await page.reload();assert.equal(await page.evaluate(()=>Fishing2.save.gear.rod),1);assert.equal(await page.evaluate(()=>Fishing2.save.catches),6);assert.equal(await page.evaluate(()=>Fishing2.save.volumes.music),.24);
 await page.click('#continueGame');await page.click('#pause');await page.click('#resumeGame');
 await page.evaluate(()=>window.__appPause());assert(await page.locator('#pauseScreen').isVisible());assert.equal(await page.evaluate(()=>FishingAudio.status.hidden),true);await page.evaluate(()=>window.__appResume());assert.equal(await page.evaluate(()=>FishingAudio.status.hidden),false);
 assert.equal(await page.locator('#action').evaluate(el=>getComputedStyle(el).userSelect),'none');
 await page.click('#toHome');
 for(const viewport of [{width:360,height:640},{width:412,height:915},{width:320,height:568}]){await page.setViewportSize(viewport);await page.screenshot({path:'work/fishing2-checks/home-'+viewport.width+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 assert.deepEqual(errors,[]);console.log('PASS menu, all maps, audio settings, fish album, quests, upgrades, persistence, pause, no text selection and compact screens');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

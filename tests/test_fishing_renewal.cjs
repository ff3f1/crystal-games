/* Real state transitions plus a save produced by the installed 1.0.10 engine. */
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const URL=process.env.FISH_URL||'http://127.0.0.1:8081';
const OUT=process.env.FISH_OUT||path.resolve('work/renewal-checks');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 async function page(fixture){
  const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await p.addInitScript(({fixture})=>{if(fixture&&!localStorage.getItem('fz_save'))localStorage.setItem('fz_save',fixture);window.__adRequests=[];window.__rewardOK=false;window.AndroidAds={showRewarded(id){__adRequests.push(['reward',id]);setTimeout(()=>window.__adResult(id,__rewardOK),60)},showInterstitial(id){__adRequests.push(['inter',id]);setTimeout(()=>window.__adResult(id,false),30)}}},{fixture});
  await p.goto(URL);await p.waitForSelector('#mGo');await p.waitForTimeout(250);return p;
 }
 const raw=fs.readFileSync(path.join(__dirname,'fixtures/fishing-1.0.10-save.json'),'utf8'),old=JSON.parse(raw),migration=await page(raw);
 const migrated=await migration.evaluate(()=>FZ.Game.state());assert.equal(migrated.money,old.money);assert.deepEqual(migrated.records,old.records);assert.deepEqual(migrated.rods,old.rods);assert.deepEqual(migrated.lines,old.lines);assert.equal(migrated.inv.corn,old.inv.corn);assert.equal(migrated.stats.total,old.stats.total);assert.equal(migrated.settings.volumes.music,0);assert.equal(await migration.evaluate(()=>localStorage.getItem('fz_save.backup.1.0.10')),raw);console.log('PASS 1.0.10 save: money, rods, line, bait, records, stats, mute settings and backup');await migration.close();
 const p=await page();assert.equal(await p.evaluate(()=>FZ.SPECIES.length),62);assert.equal(await p.evaluate(()=>FZ.LOCATIONS.length),20);assert((await p.evaluate(()=>Object.keys(FZ.Assets.img).length))<15);
 await p.screenshot({path:path.join(OUT,'menu.png')});
 await p.click('#mAtlas');assert.equal(await p.locator('.acard').count(),62);await p.locator('[data-sp="cod"]').scrollIntoViewIfNeeded();await p.locator('[data-sp="cod"]').click();assert((await p.locator('.facts').textContent()).includes('Наживки'));await p.evaluate(()=>FZ.UI.closeSheet());
 await p.click('#mSet');await p.locator('#musicVolume').fill('21');await p.locator('#musicVolume').dispatchEvent('input');assert.equal(await p.evaluate(()=>FZ.Game.settings().volumes.music),.21);await p.evaluate(()=>FZ.UI.closeSheet());
 // The first trip must be uninterrupted. An interstitial here blocks the game.
 await p.click('#mMap');await p.click('[data-season="winter"]');await p.click('[data-travel="pond"]');
 await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>window.__adRequests.filter(r=>r[0]==='inter').length),0,'The first trip must not open a fullscreen ad');
 assert.equal(await p.evaluate(()=>FZ.Game.sess().season),'winter');
 await p.evaluate(()=>FZ.UI.showMenu());
 await p.click('#mGo');await p.evaluate(()=>{FZ.Game.state().rateAsked=2;FZ.Game.startSession('pond','summer');FZ.Game.skipTo('dawn')});
 // Touch selection is distinct from casting; use actual pointer input for the first cast.
 await p.mouse.click(195,480);assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'idle');assert(await p.evaluate(()=>FZ.Game.rig().aimSelected));await p.locator('#bAct').click();assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'fly');
 async function tickUntil(fn,limit=8000){return p.evaluate(({predicate,limit})=>{const G=FZ.Game;let t=G.sess().t;for(let i=0;i<limit;i++){G.update(1/60,t+=1/60);for(const e of G.events())FZ.UI.onEvent(e);if(Function('return '+predicate)())return G.rig().state}throw new Error('Timeout: '+G.rig().state)},{predicate:fn,limit})}
 async function catchFish(){
  await tickUntil('FZ.Game.rig().state==="bite"&&FZ.Game.rig().bite.phase==="take"');
  await p.evaluate(()=>{for(let i=0;i<12;i++)FZ.Game.update(1/60,FZ.Game.sess().t+1/60);FZ.Input.actionDown();FZ.Input.actionUp();for(const e of FZ.Game.events())FZ.UI.onEvent(e)});
  assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'fight');
  const result=await p.evaluate(()=>{
   const G=FZ.Game;let t=G.sess().t;
   for(let i=0;i<18000;i++){
    const r=G.rig(),f=r.fish;if(r.state==='result')return {id:r.result.s.id,price:r.result.price,mode:r.result.mode};if(r.lost)throw Error('Unexpected loss: '+r.lost.why);
    if(r.state==='fight'){
     if(f.warning||f.phase==='run'||f.tension>.87)FZ.Input.actionUp();else FZ.Input.actionDown();
     r.tilt=f.vx>0?-.9:.9;
    }
    G.update(1/60,t+=1/60);for(const e of G.events())FZ.UI.onEvent(e);
   }throw Error('Fight did not finish');
  });assert(await p.locator('#cKeep').isVisible()||await p.locator('#cRel').isVisible());return result;
 }
 let result=await catchFish();console.log('PASS selected cast, natural bite, strike, adaptive fight and landing:',result.id);await p.waitForTimeout(700);await p.screenshot({path:path.join(OUT,'catch.png')});
 // Rejected reward callback must grant nothing; confirmed callback survives process restart.
 await p.click('#cDbl');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>!!FZ.Game.state().pendingCatch.doubled),false);
 await p.evaluate(()=>window.__rewardOK=true);await p.click('#cDbl');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>FZ.Game.state().pendingCatch.doubled),true);
 const balance=await p.evaluate(()=>FZ.Game.state().money);await p.reload();await p.waitForSelector('#cKeep');assert.equal(await p.evaluate(()=>FZ.Game.rig().result.s.id),result.id);await p.click('#cKeep');assert.equal(await p.evaluate(()=>FZ.Game.state().money),balance+result.price*2);assert.equal(await p.evaluate(()=>FZ.Game.state().journal.length),1);assert.equal(await p.evaluate(()=>FZ.Game.state().pendingCatch||null),null);console.log('PASS ad rejection, confirmed multiplier, pending-catch recovery and single payout');
 // Additional real catch cycles use the original four distinct methods.
 const scenarios=[['oka','summer','feeder','d2','worm'],['taiga','summer','spin','s3','spinner'],['pond','winter','ice','i3','bloodworm']];
 for(const [loc,season,mode,rod,bait] of scenarios){
  await p.evaluate(({loc,season,mode,rod,bait})=>{const G=FZ.Game,s=G.state();s.lvl=40;s.active=mode==='ice'?'float':mode;s.load[mode].rod=rod;s.load[mode].line='l7';s.load[mode].hook='h2';s.inv[bait]=100;s.lures[bait]=100;s.load[mode].bait=bait;G.startSession(loc,season);G.skipTo('day');if(mode==='ice')G.drill();else G.cast(0,11);for(const e of G.events())FZ.UI.onEvent(e)},{loc,season,mode,rod,bait});
  result=await catchFish();console.log('PASS natural catch',mode,loc,result.id);await p.click('#cRel');
 }
 // Exhaustive reachability: every species must have at least one compatible real table.
 const reachable=await p.evaluate(()=>{
  const G=FZ.Game,s=G.state(),seen=new Set();s.lvl=99;
  for(const l of FZ.LOCATIONS)for(const season of FZ.SEASON_ORDER){G.startSession(l.id,season);for(const period of Object.keys(FZ.TIMES)){G.sess().period=period;for(const mode of G.sess().ice?['ice']:['float','feeder','spin']){G.sess().mode=mode;s.load[mode].rod=FZ.RODS.find(r=>r.type===mode).id;s.load[mode].line='l7';for(const bait of FZ.BAITS.filter(b=>b.m.includes(mode))){s.load[mode].bait=bait.id;for(const x of G.biteTable())if(x[1]>0)seen.add(x[0].id)}}}}
  return {count:seen.size,missing:FZ.SPECIES.filter(x=>!seen.has(x.id)).map(x=>x.id)};
 });assert.equal(reachable.count,62,JSON.stringify(reachable));console.log('PASS all 62 species reachable in valid habitat/season/method/bait tables');
 await p.evaluate(()=>{const G=FZ.Game,s=G.state();s.money=99999;s.rods.push('f2');s.journey.maps.pond=3;G.startSession('pond','summer')});const before=await p.evaluate(()=>FZ.Game.state().money);assert.equal(await p.evaluate(()=>FZ.Game.buy('rod','f2')),'Уже есть в снастях');assert.equal(await p.evaluate(()=>FZ.Game.state().money),before);const reward=await p.evaluate(()=>FZ.Game.claimJourney('pond'));assert(reward>0);assert.equal(await p.evaluate(()=>FZ.Game.claimJourney('pond')),0);
 // Ad failure never revives or invents an award; revive restores the exact consumed bait.
 const revive=await p.evaluate(()=>{const G=FZ.Game,s=G.state(),r=G.rig();s.load.float.rod='f1';s.load.float.line='l1';s.load.float.bait='worm';s.inv.worm=12;r.state='bite';r.X=0;r.Z=9;r.bite={s:FZ.SP.carp,w:9,style:'drag',phase:'take',t:.3,take:2};G.strike();r.fish.T=50;for(let i=0;i<40&&!r.lost;i++){G.update(1/60,G.sess().t+1/60);if(r.fish)r.fish.T=50}const consumed=s.inv.worm;const ok=G.revive();return {consumed,now:s.inv.worm,ok,again:G.revive()}});assert.equal(revive.consumed,11);assert.equal(revive.now,12);assert(revive.ok);assert.equal(revive.again,false);console.log('PASS duplicate purchases, expedition claims and revive bait accounting');
 await p.evaluate(()=>{FZ.Game.rig().reeling=true;window.__appPause();FZ.Sound.suspend('ad');FZ.Sound.resume('ad')});assert.equal(await p.evaluate(()=>FZ.Game.rig().reeling),false);assert((await p.evaluate(()=>FZ.Sound.status().paused)).includes('app'));const stamp=await p.evaluate(()=>FZ.Game.sess().t);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>FZ.Game.sess().t),stamp);await p.evaluate(()=>window.__appResume());
 // Visit every water and season; this catches missing artwork and renderer fallbacks.
 for(const key of await p.evaluate(()=>FZ.LOCATIONS.map(l=>l.id))){for(const season of ['summer','winter']){await p.evaluate(({key,season})=>{FZ.Game.startSession(key,season);FZ.Game.skipTo('day')},{key,season});await p.waitForTimeout(80)} }
 await p.evaluate(()=>FZ.UI.showMenu());for(const size of [{width:360,height:640},{width:320,height:568},{width:412,height:915}]){await p.setViewportSize(size);await p.screenshot({path:path.join(OUT,'menu-'+size.width+'.png')});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 assert.equal(await p.locator('#mGo').evaluate(el=>getComputedStyle(el).userSelect),'none');
 await p.evaluate(()=>FZ.Game.save(true));const savedMoney=await p.evaluate(()=>FZ.Game.state().money);await p.reload();await p.waitForSelector('#mGo');assert.equal(await p.evaluate(()=>FZ.Game.state().money),savedMoney);assert.equal(await p.evaluate(()=>FZ.Game.settings().volumes.music),.21);
 assert.deepEqual(errors,[]);console.log('PASS 40 map/season render paths, pause gates, save persistence, compact screens and no JS/resource errors');
 fs.writeFileSync(path.join(OUT,'BROWSER_RESULT.txt'),'PASS: original 1.0.10 save migration; four natural catch loops; all 62 species reachable; ad reward rejection/confirmation; pending catch recovery; economy guards; 40 map-season paths; lifecycle and responsive interface.\n');await p.close();await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

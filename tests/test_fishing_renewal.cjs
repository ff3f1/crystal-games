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
 const previous=JSON.parse(raw);previous.renewal=1;previous.journey={maps:{pond:3},claimed:[]};previous.journal=[{sid:'roach',loc:'pond',w:.3,mode:'float',kept:false}];
 const legacy=await page(JSON.stringify(previous));assert.equal(await legacy.evaluate(()=>FZ.Expeditions.challenge('pond').got),1);assert((await legacy.evaluate(()=>FZ.Game.claimJourney('pond')))>0);assert((await legacy.evaluate(()=>FZ.Game.claimChallenge('pond')))>0);assert.equal(await legacy.evaluate(()=>FZ.Game.claimChallenge('pond')),0);await legacy.close();console.log('PASS previous expedition reward and diary progress migrate without duplicate payout');
 const p=await page();assert.equal(await p.evaluate(()=>FZ.SPECIES.length),62);assert.equal(await p.evaluate(()=>FZ.LOCATIONS.length),20);assert((await p.evaluate(()=>Object.keys(FZ.Assets.img).length))<15);
 await p.screenshot({path:path.join(OUT,'menu.png')});
 await p.click('#mAtlas');assert.equal(await p.locator('.acard').count(),62);await p.locator('[data-sp="cod"]').scrollIntoViewIfNeeded();await p.locator('[data-sp="cod"]').click();assert((await p.locator('.facts').textContent()).includes('Наживки'));await p.evaluate(()=>FZ.UI.closeSheet());
 await p.click('#mSet');await p.locator('#musicVolume').fill('21');await p.locator('#musicVolume').dispatchEvent('input');assert.equal(await p.evaluate(()=>FZ.Game.settings().volumes.music),.21);await p.evaluate(()=>FZ.UI.closeSheet());
 // The first trip must be uninterrupted. An interstitial here blocks the game.
 await p.click('#mMap');await p.click('[data-season="summer"]');await p.click('[data-biome="sea"]');assert((await p.locator('[data-travel="blacksea"]').textContent()).includes('Морская ловля'));await p.click('[data-biome="river"]');assert.equal(await p.locator('[data-travel="blacksea"]').count(),0);await p.click('[data-biome="all"]');await p.click('[data-season="winter"]');await p.click('[data-travel="pond"]');
 await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>window.__adRequests.filter(r=>r[0]==='inter').length),0,'The first trip must not open a fullscreen ad');
 assert.equal(await p.evaluate(()=>FZ.Game.sess().season),'winter');
 await p.evaluate(()=>FZ.UI.showMenu());
 await p.click('#mGo');await p.evaluate(()=>{FZ.Game.state().rateAsked=2;FZ.Game.startSession('pond','summer');FZ.Game.skipTo('dawn')});
 await p.evaluate(()=>{FZ.Game.loadout().bait=null;FZ.UI.showGuide()});assert((await p.locator('.empty-state').textContent()).includes('маловероятны'));await p.evaluate(()=>{FZ.UI.closeSheet();FZ.Game.loadout().bait='worm'});
 // Touch selection is distinct from casting; use actual pointer input for the first cast.
 await p.mouse.click(195,480);assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'idle');assert(await p.evaluate(()=>FZ.Game.rig().aimSelected));await p.locator('#bAct').click();assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'fly');
 async function tickUntil(fn,limit=8000){return p.evaluate(({predicate,limit})=>{const G=FZ.Game;let t=G.sess().t;for(let i=0;i<limit;i++){G.update(1/60,t+=1/60);for(const e of G.events())FZ.UI.onEvent(e);if(Function('return '+predicate)())return G.rig().state}throw new Error('Timeout: '+G.rig().state)},{predicate:fn,limit})}
 let guardChecked=false;
 async function catchFish(attempt=0){
  await tickUntil('FZ.Game.rig().state==="bite"&&FZ.Game.rig().bite.phase==="take"');
  await p.evaluate(()=>{for(let i=0;i<12;i++)FZ.Game.update(1/60,FZ.Game.sess().t+1/60);FZ.Input.actionDown();FZ.Input.actionUp();for(const e of FZ.Game.events())FZ.UI.onEvent(e)});
  assert.equal(await p.evaluate(()=>FZ.Game.rig().state),'fight');
  if(!guardChecked){
   const guard=await p.evaluate(async()=>{const G=FZ.Game,r=G.rig(),fish=r.fish,money=G.state().money,active=G.state().active;const switched=G.setActive('float'),bought=G.buy('bait','worm'),equipped=G.equip('float','rod','f1');await FZ.UI.travel('pond','winter');const before={phase:fish.phase,vx:fish.vx,warning:fish.warning,tension:fish.tension,slackT:fish.slackT};Object.assign(fish,{phase:'run',vx:1,warning:false,tension:.3,slackT:0});FZ.UI.hint(G.sess(),r,G.state(),0);const hint=document.querySelector('#hHint').textContent;Object.assign(fish,before);const cv=document.querySelector('#cv'),event=type=>new PointerEvent(type,{bubbles:true,pointerId:71,clientX:30,clientY:450});FZ.Input.actionUp();cv.dispatchEvent(event('pointerdown'));const steerDoesNotReel=!r.reeling&&r.tilt<0;cv.dispatchEvent(event('pointerup'));FZ.Input.actionDown();cv.dispatchEvent(event('pointerdown'));cv.dispatchEvent(event('pointerup'));const holdKept=r.reeling;FZ.Input.actionUp();return {switched,bought,equipped,hint,steerDoesNotReel,holdKept,state:G.rig().state,same:G.rig().fish===fish,money:G.state().money===money,active:G.state().active===active,season:G.sess().season}});
   assert.equal(guard.switched,false);assert.equal(guard.equipped,false);assert(guard.bought.includes('закончи'));assert(guard.same&&guard.money&&guard.active);assert(guard.steerDoesNotReel&&guard.holdKept,'Steering must not operate or cancel the reel');assert.equal(guard.state,'fight');assert.equal(guard.season,'summer');assert(guard.hint.includes('вправо')&&guard.hint.includes('влево'));guardChecked=true;console.log('PASS fighting fish survives attempts to change gear, buy or travel; steering and reeling are independent');
  }
  const result=await p.evaluate(()=>{
   const G=FZ.Game;let t=G.sess().t;
   for(let i=0;i<18000;i++){
    const r=G.rig(),f=r.fish;if(r.state==='result')return {id:r.result.s.id,price:r.result.price,mode:r.result.mode};if(r.lost&&r.state!=='fight')return {lost:r.lost.why};
    if(r.state==='fight'){
     if(f.warning||f.phase==='run'||f.tension>.87)FZ.Input.actionUp();else FZ.Input.actionDown();
     r.tilt=f.vx>0?-.9:.9;
    }
    G.update(1/60,t+=1/60);for(const e of G.events())FZ.UI.onEvent(e);
   }throw Error('Fight did not finish');
  });
  if(result.lost){if(attempt>=5)throw Error('Six natural fights were lost: '+result.lost);if(await p.locator('#lNo').isVisible())await p.click('#lNo');await p.evaluate(()=>{const G=FZ.Game;if(G.sess().ice)G.jig();else G.cast(0,7);for(const e of G.events())FZ.UI.onEvent(e)});return catchFish(attempt+1)}
  assert(await p.locator('#cKeep').isVisible()||await p.locator('#cRel').isVisible());return result;
 }
 let result=await catchFish();console.log('PASS selected cast, natural bite, strike, adaptive fight and landing:',result.id);await p.waitForTimeout(700);await p.screenshot({path:path.join(OUT,'catch.png')});
 for(const size of [{width:320,height:568},{width:360,height:640}]){await p.setViewportSize(size);await p.waitForTimeout(80);await p.screenshot({path:path.join(OUT,'catch-'+size.width+'.png')});const box=await p.locator('#cShare').boundingBox();assert(box&&box.y>=0&&box.y+box.height<=size.height,'Catch decisions must fit on a compact phone')};await p.setViewportSize({width:390,height:844});
 // Rejected reward callback must grant nothing; confirmed callback survives process restart.
 await p.click('#cDbl');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>!!FZ.Game.state().pendingCatch.doubled),false);
 await p.evaluate(()=>window.__rewardOK=true);await p.click('#cDbl');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>FZ.Game.state().pendingCatch.doubled),true);
 const balance=await p.evaluate(()=>FZ.Game.state().money);await p.reload();await p.waitForSelector('#cKeep');assert.equal(await p.evaluate(()=>FZ.Game.rig().result.s.id),result.id);await p.click('#cKeep');assert.equal(await p.evaluate(()=>FZ.Game.state().money),balance+result.price*2);assert.equal(await p.evaluate(()=>FZ.Game.state().journal.length),1);assert.equal(await p.evaluate(()=>FZ.Game.state().pendingCatch||null),null);console.log('PASS ad rejection, confirmed multiplier, pending-catch recovery and single payout');
 // Complete a distinct shore objective through a real catch and the visible reward button.
 await p.evaluate(()=>{FZ.Game.cast(0,11);for(const e of FZ.Game.events())FZ.UI.onEvent(e)});await catchFish();await p.click('#cRel');
 assert.equal(await p.evaluate(()=>FZ.Expeditions.challenge('pond').got),1);await p.evaluate(()=>FZ.UI.showMenu());assert(await p.locator('#mJourney .reward-dot').count());await p.click('#mJourney');assert((await p.locator('.shore-challenge').first().textContent()).includes('Отпусти рыбу'));const bounty=await p.evaluate(()=>({money:FZ.Game.state().money,lvl:FZ.Game.state().lvl}));await p.click('[data-claim-challenge="pond"]');const paid=await p.evaluate(()=>({money:FZ.Game.state().money,lvl:FZ.Game.state().lvl}));let levels=0;for(let n=bounty.lvl+1;n<=paid.lvl;n++)levels+=150*n;assert.equal(paid.money,bounty.money+260+levels);assert.equal(await p.evaluate(()=>FZ.Game.claimChallenge('pond')),0);await p.evaluate(()=>{FZ.UI.closeSheet();FZ.UI.closeMenu();FZ.Game.save(true)});console.log('PASS real release completes shore objective and reward is paid exactly once');
 // Additional real catch cycles use the original four distinct methods.
 const scenarios=[['oka','summer','feeder','d2','worm'],['taiga','summer','spin','s3','spinner'],['pond','winter','ice','i3','bloodworm']];
 for(const [loc,season,mode,rod,bait] of scenarios){
  await p.evaluate(({loc,season,mode,rod,bait})=>{const G=FZ.Game,s=G.state();s.lvl=40;s.active=mode==='ice'?'float':mode;s.load[mode].rod=rod;s.load[mode].line='l7';s.load[mode].hook='h2';s.inv[bait]=100;s.lures[bait]=100;s.load[mode].bait=bait;G.startSession(loc,season);G.skipTo('day');if(mode==='ice')G.drill();else G.cast(0,11);for(const e of G.events())FZ.UI.onEvent(e)},{loc,season,mode,rod,bait});
  result=await catchFish();console.log('PASS natural catch',mode,loc,result.id);await p.click('#cRel');
 }
 // Exhaustive reachability: every species must have at least one compatible real table.
 const reachable=await p.evaluate(()=>{
  const G=FZ.Game,s=G.state(),seen=new Set(),byLoc={},spin={};s.lvl=99;
  for(const l of FZ.LOCATIONS)for(const season of FZ.SEASON_ORDER){G.startSession(l.id,season);for(const period of Object.keys(FZ.TIMES)){G.sess().period=period;for(const mode of G.sess().ice?['ice']:['float','feeder','spin']){G.sess().mode=mode;s.load[mode].rod=FZ.RODS.find(r=>r.type===mode).id;s.load[mode].line='l7';for(const bait of FZ.BAITS.filter(b=>b.m.includes(mode))){s.load[mode].bait=bait.id;for(const x of G.biteTable())if(x[1]>0){seen.add(x[0].id);(byLoc[l.id]||(byLoc[l.id]=new Set())).add(x[0].id);if(mode==='spin')spin[l.id]=true}}}}}
  const impossible=FZ.LOCATIONS.filter(l=>{const q=FZ.Expeditions.challenge(l.id);if(!q)return true;if(q.label.startsWith('Поймай: ')){const f=FZ.SPECIES.find(f=>q.label==='Поймай: '+f.n);return !f||!byLoc[l.id]?.has(f.id)}return q.label==='Поймай на спиннинг'&&!spin[l.id]}).map(l=>l.id);
  return {count:seen.size,missing:FZ.SPECIES.filter(x=>!seen.has(x.id)).map(x=>x.id),impossible};
 });assert.equal(reachable.count,62,JSON.stringify(reachable));assert.deepEqual(reachable.impossible,[]);console.log('PASS all 62 species and every named shore challenge reachable in valid habitat/season/method/bait tables');
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

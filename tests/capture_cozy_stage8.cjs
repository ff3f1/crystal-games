const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.FISH_URL||'http://127.0.0.1:8080';
const output='work/cozy-stage8-review';fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:true});
for(const [w,h,name] of [[390,844,'01-phone'],[360,740,'02-small-phone'],[432,932,'03-large-phone'],[320,700,'04-compact-phone']]){
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('menu-reference'))errors.push(r.status()+' '+r.url())});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#mRate',{timeout:30000});
 await page.waitForTimeout(950);
 const report=await page.evaluate(()=>{
   const o=document.querySelector('#ovMenu'),l=o.querySelector('.lodge'),b=o.querySelector('.lodge-bottom');
   const ids=['mGo','mDuel','mMap','mShop','mAtlas','mJourney','mJournal','mQuests','mTour','mForecast','mSet','mHelp','mRate'];
   const buttons=ids.map(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect();return{id,visible:!!e&&r.width>0&&r.height>0,centerY:r?Math.round(r.y+r.height/2):null}});
   const tileTexts=[...o.querySelectorAll('.lodge-grid .tile')].map(tile=>{
     const box=tile.getBoundingClientRect(),aria=tile.getAttribute('aria-label')||'';
     return{id:tile.id,label:aria,lines:1,
       fits:box.left>=-1&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1&&
        box.width>=75&&box.height>=39&&getComputedStyle(tile).backgroundImage.includes('tiles.webp')};
   });
   return{duplicateReel:!!o.querySelector('.cozy-reel-still'),tileTexts,weather:!!o.querySelector('.go[data-current-weather]'),viewport:{w:innerWidth,h:innerHeight},title:!!o.querySelector('.cozy-sign-fish'),floatingRod:!!o.querySelector('.cozy-rod-still'),shopArt:!!o.querySelector('#mShop .cozy-tile-art img'),
     width:l.scrollWidth,windowW:innerWidth,bottom:b.getBoundingClientRect().bottom,buttons};
 });
 assert(report.title&&report.shopArt,'menu title and game section assets render '+JSON.stringify(report));
 assert(await page.locator('#cozyFightSignal').count()===1,'real fight meter is installed once');
 const fightStates=await page.evaluate(()=>{
   const p=FZ.CozyPolish.describe;
   return{
     overload:p({tension:.92,slackT:0,phase:'run'},.7).tone,
     slack:p({tension:.08,slackT:.7,phase:'rest'},.7).tone,
     dive:p({tension:.4,slackT:0,phase:'dive',diveWarning:true},.7).title,
     resting:p({tension:.35,slackT:0,phase:'tired'},.7).action
   };
 });
 assert.deepEqual(fightStates,{overload:'danger',slack:'slack',dive:'Уход на глубину',resting:'Подтягивайте'},
   'fight UI must reflect real phase and line pressure');
 assert(!report.floatingRod,'main menu must not have a rod levitating in the lake');
 assert(!report.duplicateReel,'duplicate floating reel must not exist in main menu');
 assert(report.weather,'current fishing weather must be shown in menu');
 const rebuilt=await page.evaluate(()=>{
   const menu=document.querySelector('#ovMenu'),grid=menu.querySelector('.lodge-grid');
   const go=menu.querySelector('#mGo'),profile=menu.querySelector('.lodge-profile');
   const tiles=[...grid.querySelectorAll('.tile')];
   const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
   const rows=getComputedStyle(grid).gridTemplateRows.split(' ').length;
   const goRect=go.getBoundingClientRect();
   return{active:menu.classList.contains('reference-menu-v4'),
     columns,rows,count:tiles.length,ids:tiles.map(e=>e.id),
     profile:!!profile.querySelector('.ref-experience')&&!!profile.querySelector('.ref-record'),
     hasHero:!!menu.querySelector('.reference-hero'),
     liveXP:profile.textContent.includes('/'),
     goVisible:goRect.width>100&&goRect.height>39,
     noArrow:!menu.querySelector('#conceptMoreSections'),
     noHidden:tiles.every(e=>e.offsetWidth>0&&e.getBoundingClientRect().bottom<innerHeight),
     rate:!!menu.querySelector('#mRate'),skills:!!menu.querySelector('#mSkills')};
 });
 assert(rebuilt.active&&rebuilt.columns===3&&rebuilt.rows===3&&rebuilt.count===9&&
   rebuilt.profile&&rebuilt.hasHero&&rebuilt.liveXP&&rebuilt.goVisible&&rebuilt.noArrow&&
   rebuilt.noHidden&&rebuilt.rate&&rebuilt.skills,
   'approved menu MUST show all nine live destinations on one screen '+JSON.stringify(rebuilt));
 assert.deepEqual(rebuilt.ids,['mMap','mShop','mAtlas','mJourney','mJournal','mQuests','mTour','mForecast','mSet']);
 assert(report.tileTexts.every(x=>x.lines===1&&x.fits&&x.label),'nine accessible art buttons must fit '+JSON.stringify(report.tileTexts));
 assert(report.buttons.every(x=>x.visible),'missing menu button '+JSON.stringify(report));
 assert(report.width<=w+3,'horizontal menu overflow '+JSON.stringify(report));
 assert(report.buttons.every(x=>x.centerY<=h+10),'menu overflows screen height '+JSON.stringify(report));
 // The real drawn cards must react to an actual pointer press.
 if(name==='01-phone'){
   const target=page.locator('#mMap'),rect=await target.boundingBox();
   await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
   assert(await target.evaluate(el=>el.classList.contains('ref-pressed')),
     'button must visibly depress as soon as the finger touches it');
   await page.screenshot({path:path.join(output,'00-pressed-menu-button.png')});
   await page.mouse.up();
   await page.waitForTimeout(90);
 }
 await page.screenshot({path:path.join(output,name+'.png')});
 // Real finger release on the golden button MUST uncover the game on every
 // tested phone size. The 2.1.0 APK was blocked by display:flex!important.
 await page.locator('#mGo').click();
 await page.waitForTimeout(240);
 const started=await page.evaluate(()=>{
   const menu=document.querySelector('#ovMenu'),hud=document.querySelector('#hud');
   const canvas=document.querySelector('#cv').getBoundingClientRect();
   return{
     classOff:!menu.classList.contains('on'),
     display:getComputedStyle(menu).display,
     pointerEvents:getComputedStyle(menu).pointerEvents,
     hudVisible:!hud.classList.contains('hide'),
     menuOpen:FZ.UI.menuOpen,
     canvasWidth:canvas.width,
     state:FZ.Game.rig().state
   };
 });
 assert(started.classOff&&started.display==='none'&&started.pointerEvents==='none'&&
   started.hudVisible&&started.menuOpen===false&&started.canvasWidth>w*.9,
   'golden CTA MUST start fishing on phone without overlay '+JSON.stringify(started));
 await page.screenshot({path:path.join(output,name+'-fishing-started.png')});
 await page.evaluate(()=>FZ.UI.showMenu());
 await page.waitForSelector('#mGo');
 console.log('SCREEN',name,JSON.stringify(report));
 if(name==='01-phone'){
   const ok=await page.evaluate(()=>{let count=0;FZ.Platform.rate=()=>count++;document.querySelector('#mRate').click();return count});
   assert.equal(ok,1,'rate button invokes actual store handler once');
   await page.evaluate(()=>FZ.UI.showShop('lure'));
   await page.waitForSelector('.cozy-catalog-row');
   const theme=await page.evaluate(()=>{
     const sheet=document.querySelector('#ovSheet .sheet'),css=getComputedStyle(sheet);
     const h2=sheet.querySelector('h2'),title=h2?getComputedStyle(h2):null;
     return{background:css.backgroundImage,border:css.borderTopColor,titleColor:title?.color};
   });
   assert(theme.background.includes('linear-gradient')&&theme.titleColor==='rgb(255, 235, 189)',
     'shop must use the same brass and pine color system as the menu '+JSON.stringify(theme));
   await page.screenshot({path:path.join(output,'04-shop-unified-gold.png')});
   const shopView=await page.evaluate(()=>{
     const sh=document.querySelector('#ovSheet .sheet'),items=sh.querySelectorAll('.cozy-catalog-row');
     if(items.length<2)return{};
     const a=items[0].getBoundingClientRect(),b=items[1].getBoundingClientRect();
     return{newSkin:sh.classList.contains('concept-shop'),sameRow:Math.abs(a.y-b.y)<5,differentX:Math.abs(a.x-b.x)>30};
   });
   assert(shopView.newSkin&&shopView.sameRow&&shopView.differentX,
     'catalog must show actual two-column gear cards '+JSON.stringify(shopView));
   const layout=await page.evaluate(()=>{
     const rows=[...document.querySelectorAll('.cozy-catalog-row')];
     return{count:rows.length,overflow:rows.filter(r=>r.scrollWidth>r.clientWidth+2).map(r=>r.textContent.trim().slice(0,35)),
       font:parseFloat(getComputedStyle(rows[0].querySelector('.body .d')).fontSize)};
   });
   assert(layout.count>=8&&layout.overflow.length===0&&layout.font>=10.5,'shop typography/width '+JSON.stringify(layout));
   await page.screenshot({path:path.join(output,'04-shop-lures.png')});
   await page.evaluate(()=>FZ.UI.showTackle());
   await page.waitForSelector('.cozy-loadout .cozy-slot');
   await page.screenshot({path:path.join(output,'04-tackle.png')});
   await page.evaluate(()=>{FZ.UI.closeSheet();FZ.UI.showMap()});
   await page.waitForSelector('#ovSheet .destination');
   await page.screenshot({path:path.join(output,'06-polished-waters.png')});
   await page.evaluate(()=>{FZ.UI.closeSheet();FZ.UI.showAtlas()});
   await page.waitForSelector('#ovSheet .acard');
   await page.screenshot({path:path.join(output,'07-polished-atlas.png')});
   await page.evaluate(()=>{FZ.UI.closeSheet();FZ.UI.showMenu()});
   await page.locator('#mHelp').click();await page.waitForTimeout(200);
   assert(await page.locator('#ovSheet').evaluate(e=>e.classList.contains('on')),'tutorial button still works');
 }
 if(name==='04-compact-phone'){
   await page.evaluate(()=>FZ.UI.showShop('lure'));
   await page.waitForSelector('.cozy-catalog-row');
   const narrow=await page.evaluate(()=>{
     const sheet=document.querySelector('#ovSheet .sheet'),rows=[...document.querySelectorAll('.cozy-catalog-row')];
     const bad=rows.filter(row=>row.scrollWidth>row.clientWidth+2 || row.getBoundingClientRect().right>innerWidth+2);
     const tabs=document.querySelector('#ovSheet .tabs');
     const banner=document.querySelector('#ovSheet .cozy-shelf-summary');
     const strip=document.querySelector('#ovSheet .cozy-tab-strip');
     const bannerBeforeTabs=!!banner&&!!strip&&banner.getBoundingClientRect().bottom<=strip.getBoundingClientRect().top+2;
     return{bannerBeforeTabs,rows:rows.length,clipped:bad.map(r=>r.textContent.trim().slice(0,20)),tabCanScroll:tabs.scrollWidth>tabs.clientWidth,screenWidth:innerWidth,sheetWidth:sheet.getBoundingClientRect().width};
   });
   assert(narrow.bannerBeforeTabs,'shop header must not overlap category tabs '+JSON.stringify(narrow));
   assert(narrow.rows>=8 && narrow.clipped.length===0 && narrow.sheetWidth<=320+2,'compact shop layout '+JSON.stringify(narrow));
   assert(narrow.tabCanScroll,'shop categories must remain horizontally scrollable on narrow phones');
   const arrow=page.locator('.cozy-tab-next');
   assert(await arrow.isVisible(),'small-shop category arrow must be visible');
   await arrow.click();
   assert(await page.locator('#ovSheet .tabs').evaluate(el=>el.scrollLeft>0),'category arrow must scroll tabs');
   const aligned=await page.locator('#ovSheet .tabs').evaluate(el=>{
     const frame=el.getBoundingClientRect();
     const first=[...el.querySelectorAll('.tab')].find(t=>t.getBoundingClientRect().right>frame.left+3);
     return !!first&&first.getBoundingClientRect().left>=frame.left-3;
   });
   assert(aligned,'the first visible shop tab must not start with clipped letters');
   await page.screenshot({path:path.join(output,'05-compact-lure-shop.png')});
 }
 assert.deepEqual(errors,[]);
 await page.close();
}
await browser.close();
console.log('PASS: restored menu on three phone sizes, official rating button, tutorial and tackle');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

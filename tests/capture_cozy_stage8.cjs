const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.FISH_URL||'http://127.0.0.1:8080';
const output='work/cozy-stage8-review';fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:true});
for(const [w,h,name] of [[390,844,'01-phone'],[360,740,'02-small-phone'],[432,932,'03-large-phone'],[320,700,'04-compact-phone']]){
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#mRate',{timeout:30000});
 await page.waitForTimeout(950);
 const report=await page.evaluate(()=>{
   const o=document.querySelector('#ovMenu'),l=o.querySelector('.lodge'),b=o.querySelector('.lodge-bottom');
   const ids=['mGo','mDuel','mMap','mShop','mAtlas','mJourney','mJournal','mQuests','mTour','mForecast','mSet','mHelp','mRate'];
   const buttons=ids.map(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect();return{id,visible:!!e&&r.width>0&&r.height>0,centerY:r?Math.round(r.y+r.height/2):null}});
   const tileTexts=[...o.querySelectorAll('.lodge-grid .tile')].map(tile=>{
     const label=tile.querySelector('span:last-child');const range=document.createRange();range.selectNodeContents(label);
     const textRect=label.getBoundingClientRect(),buttonRect=tile.getBoundingClientRect();
     return{id:tile.id,lines:range.getClientRects().length,fits:textRect.left>=buttonRect.left-2&&textRect.right<=buttonRect.right+2};
   });
   return{tileTexts,weather:!!o.querySelector('.go[data-current-weather]'),viewport:{w:innerWidth,h:innerHeight},title:!!o.querySelector('.cozy-sign-fish'),rod:!!o.querySelector('.cozy-rod-still'),shopArt:!!o.querySelector('#mShop .cozy-tile-art img'),
     width:l.scrollWidth,windowW:innerWidth,bottom:b.getBoundingClientRect().bottom,buttons};
 });
 assert(report.title&&report.rod&&report.shopArt,'real art assets are rendered '+JSON.stringify(report));
 assert(report.weather,'current fishing weather must be shown in menu');
 assert(report.tileTexts.every(x=>x.lines===1&&x.fits),'split or clipped Russian menu text '+JSON.stringify(report.tileTexts));
 assert(report.buttons.every(x=>x.visible),'missing menu button '+JSON.stringify(report));
 assert(report.width<=w+3,'horizontal menu overflow '+JSON.stringify(report));
 assert(report.buttons.every(x=>x.centerY<=h+10),'menu overflows screen height '+JSON.stringify(report));
 await page.screenshot({path:path.join(output,name+'.png')});
 console.log('SCREEN',name,JSON.stringify(report));
 if(name==='01-phone'){
   const ok=await page.evaluate(()=>{let count=0;FZ.Platform.rate=()=>count++;document.querySelector('#mRate').click();return count});
   assert.equal(ok,1,'rate button invokes actual store handler once');
   await page.evaluate(()=>FZ.UI.showShop('lure'));
   await page.waitForSelector('.cozy-catalog-row');
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
     return{rows:rows.length,clipped:bad.map(r=>r.textContent.trim().slice(0,20)),tabCanScroll:tabs.scrollWidth>tabs.clientWidth,screenWidth:innerWidth,sheetWidth:sheet.getBoundingClientRect().width};
   });
   assert(narrow.rows>=8 && narrow.clipped.length===0 && narrow.sheetWidth<=320+2,'compact shop layout '+JSON.stringify(narrow));
   assert(narrow.tabCanScroll,'shop categories must remain horizontally scrollable on narrow phones');
   await page.screenshot({path:path.join(output,'05-compact-lure-shop.png')});
 }
 assert.deepEqual(errors,[]);
 await page.close();
}
await browser.close();
console.log('PASS: restored menu on three phone sizes, official rating button, tutorial and tackle');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

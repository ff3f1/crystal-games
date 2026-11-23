const {chromium} = require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 try {
 const page=await b.newPage({viewport:{width:412,height:860},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://localhost:8246');await page.locator('#mGo').click();
 await page.evaluate(()=>{FZ.Game.startSession('pond','summer');FZ.UI.refreshTools()});
 await page.locator('#bAct').click();
 await page.waitForFunction(()=>FZ.Game.rig().state==='wait' && FZ.Game.rig().hunt);
 await page.locator('#bAct').click();
 await page.waitForTimeout(350);
 await page.locator('#bAct').click();
 await page.waitForFunction(()=>FZ.Game.rig().hunt.shy>0);
 await page.waitForTimeout(1700);await page.locator('#bAct').click();
 await page.screenshot({path:'out/dive.png'});
 await page.waitForFunction(()=>FZ.Game.rig().bite?.phase==='take');
 await page.keyboard.press('Space');
 if(!await page.evaluate(()=>FZ.Game.rig().state==='fight'))await page.keyboard.press('Space');
 await page.waitForFunction(()=>FZ.Game.rig().state==='fight');
 await page.screenshot({path:'out/fight.png'});
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});

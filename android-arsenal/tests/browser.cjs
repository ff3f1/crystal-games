const { chromium }=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.resolve('app/src/main/assets/index.html')).href);
  await page.getByText('Нравится приложение?',{exact:true}).waitFor();
  await page.locator('nav').getByText('Трофеи',{exact:true}).click();
  await page.getByRole('button',{name:'Добавить',exact:true}).click();
  await page.locator('[name=species]').fill('Щука');
  await page.locator('[name=weight]').fill('5.4');
  await page.locator('[name=length]').fill('92');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=400;const x=c.getContext('2d');x.fillStyle='#375748';x.fillRect(0,0,640,400);x.fillStyle='#dcb877';x.fillRect(50,50,500,300);return c.toDataURL('image/png').split(',')[1]});
  await page.locator('input[type=file]').setInputFiles({name:'catch.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.querySelector('#galleryStatus')?.textContent.includes('1 из 4 фото готовы'));
  await page.locator('#modal').getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.locator('.catch-card img').waitFor();
  assert.ok(await page.locator('.catch-card img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await page.reload();
  await page.locator('nav').getByText('Трофеи',{exact:true}).click();
  await page.locator('.catch-card').click();
  await page.locator('#galleryMain').waitFor();
  assert.ok(await page.locator('#galleryMain').evaluate(i=>i.complete&&i.naturalWidth>0));
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();
  assert.equal(await page.locator('.gallery-tile img').count(),1);
  await page.locator('#modal').getByRole('button',{name:'Сохранить',exact:true}).click();
  assert.equal(await page.locator('.catch-card img').count(),1);
  await page.locator('nav').getByText('Главная',{exact:true}).click();
  assert.ok(await page.getByText('Нравится приложение?',{exact:true}).isVisible());
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'trophy-smoke.png',fullPage:true});
  console.log('PASS: real browser file selection, decode, preview, save, reload, edit, render, navigation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

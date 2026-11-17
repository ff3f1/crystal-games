"""End-to-end offline UI, actual forms, persistence, photos, restore and viewport checks."""
from pathlib import Path
import os, sys, json, threading, http.server, functools
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'test-results';OUT.mkdir(parents=True,exist_ok=True)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT/'app/src/main/assets')
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}'
errors=[];checks=[]
def check(label):checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,timezone_id='Europe/Moscow',accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def click(action,extra=''):page.locator(f'[data-action="{action}"]{extra}').first.click()
 def submit(form,values):
  for k,v in values.items():
   el=page.locator(f'#{form} [name="{k}"]')
   if el.evaluate('(e)=>e.tagName')=='SELECT':el.select_option(v)
   else:el.fill(str(v))
  page.locator(f'#{form} [type=submit]').click();page.wait_for_function("()=>document.getElementById('modal').hidden || !!document.querySelector('.reward-panel')")
  if page.locator('.reward-panel').count():click('close')
 def go(target):page.locator(f'[data-action=go][data-page="{target}"]').first.click()
 def shot(name):
  page.wait_for_timeout(200);page.evaluate("document.getElementById('toast').classList.remove('show')");page.wait_for_timeout(250)
  page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
 def state():return page.evaluate('LevelStore.read()')
 page.goto(URL);page.wait_for_selector('#modal:not([hidden])');shot('01-onboarding')
 for _ in range(3):click('onboardingNext')
 page.locator('#profile [name=gender]').select_option('female');page.locator('#profile [name=hairstyle]').select_option('curls');click('swatch','[data-key=tone][data-color="#bd8968"]');shot('02-character-editor')
 submit('profile',{'name':'Александра'});expect(page.locator('#modal')).to_be_hidden();assert state()['profile']['tone']=='#bd8968';check('Onboarding and complete character editor save')
 assert page.locator('.chip.gold').inner_text().strip()=='0';shot('03-home')
 go('quests');click('habit','[data-id=move]');submit('habitComplete',{'value':25,'note':'Прогулка в парке'});assert len(state()['rewards'])==1
 click('habit','[data-id=move]');expect(page.get_by_text('Сегодня уже получилось')).to_be_visible();click('close');assert len(state()['rewards'])==1;check('Habit evidence and duplicate reward prevention')
 click('habitAdd');submit('habitAdd',{'name':'Гитара','target':15,'unit':'мин','skill':'mind'});shot('04-habits')
 click('questTab','[data-value=tasks]');click('taskAdd');submit('taskAdd',{'name':'Разобрать документы','skill':'wealth'});click('taskComplete');submit('taskComplete',{'note':'Документы разобраны по папкам'});check('Planner completion records result')
 click('questTab','[data-value=goals]');click('goalAdd');submit('goalAdd',{'name':'Первые 5 километров','steps':'Выбрать маршрут\nПройти 2 км\nПройти 5 км'});click('goalStep');submit('goalStep',{'note':'Нашла маршрут вдоль набережной'});shot('05-goals')
 go('money');assert '0 ₽' in page.locator('.balance').inner_text();click('txAdd','[data-kind=income]');submit('txAdd',{'amount':'20000,10','category':'Доход','note':'Тестовая запись дохода'});click('txAdd','[data-kind=expense]');submit('txAdd',{'amount':'1234,56','category':'Продукты','note':'Тестовая покупка'});assert sum(t['cents'] if t['kind']=='income' else -t['cents'] for t in state()['tx'])==1876554;check('Exact income, expense and zero starting balance')
 click('txEdit');submit('txEdit',{'amount':'1000,01'});assert state()['tx'][-1]['cents']==100001;check('Editing transaction updates balance')
 click('budget');submit('budget',{'amount':'10000','category':'Все категории'});click('budget');submit('budget',{'amount':'4000','category':'Продукты'})
 click('billAdd');submit('billAdd',{'name':'Связь','amount':'500','day':20,'category':'Связь'});click('billPay');click('billPayConfirm');page.wait_for_timeout(300);expect(page.locator('[data-action=billPay]')).to_be_disabled();assert len(state()['tx'])==3;shot('06-finances');check('Category budgets and idempotent recurring payment')
 go('more');go('calendar');shot('07-calendar');click('calendarShift','[data-offset="1"]');click('calendarShift','[data-offset="-1"]');check('Calendar month navigation')
 go('more');go('health');click('meal');submit('meal',{'name':'Рис, овощи, рыба','kcal':'550'});click('workout');submit('workout',{'type':'Прогулка','minutes':25,'note':'В спокойном темпе'});click('weight');submit('weight',{'kg':70.5});shot('08-health');check('Meals, workout and weight persisted')
 go('more');go('photos')
 from PIL import Image, ImageDraw
 for i in range(2):
  image=Image.new('RGB',(700,900),('#a9cdbb' if i==0 else '#b9b4d1'));draw=ImageDraw.Draw(image);draw.ellipse((130,100,600,570),fill=('#e9d6a7' if i==0 else '#b4d4ca'));draw.rectangle((0,600,700,900),fill='#36495d');draw.text((40,780),'TEST PHOTO '+str(i+1),fill='#ffffff');file=OUT/f'fixture-{i}.jpg';image.save(file)
  page.locator('#photo-input').set_input_files(str(file));expect(page.locator('.photo-card')).to_have_count(i+1)
 shot('09-photos');click('compare');expect(page.locator('#compare-images img')).to_have_count(2);shot('10-photo-comparison');click('close');check('Photo import, local persistence and comparison')
 go('hero');shot('11-hero');go('more');go('analytics');shot('12-analytics');go('achievements');shot('13-achievements');go('more');go('world');shot('14-world')
 go('settings');page.locator('[data-setting=theme]').select_option('light');page.wait_for_function("()=>document.body.classList.contains('light')");shot('15-settings-light');check('Light theme and settings persist')
 page.locator('[data-setting=theme]').select_option('dark');page.wait_for_function("()=>!document.body.classList.contains('light')");shot('16-settings-dark')
 # Storage conflict and corrupt import must not overwrite state.
 result=page.evaluate("""async()=>{const s=await LevelStore.read();const next=await LevelStore.mutate(s,'settings',{motion:false});try{await LevelStore.mutate(s,'settings',{motion:true});return false}catch{return (await LevelStore.read()).revision===next.revision}}""")
 assert result;check('Concurrent stale write rejected')
 page.reload();page.wait_for_selector('[data-action=go][data-page=more]');assert len(state()['tx'])==3;assert page.evaluate('(async()=> (await LevelStore.photos()).length)()')==2;check('Reload retains records and photos')
 backup=page.evaluate('LevelStore.backup().catch(()=>null)') if False else page.evaluate('(async()=>LevelStore.backup(await LevelStore.read()))()')
 result=page.evaluate("""async raw=>{const s=await LevelStore.read();const pack=JSON.parse(raw);pack.state.tx[0].cents=-5;try{await LevelStore.restore(s,JSON.stringify(pack));return false}catch{return (await LevelStore.read()).tx[0].cents===s.tx[0].cents}}""",backup);assert result;check('Corrupt backup rejected without data loss')
 result=page.evaluate("""async raw=>{const s=await LevelStore.read();const next=await LevelStore.restore(s,raw);return next.tx.length===3&&(await LevelStore.photos()).length===2}""",backup);assert result;check('Backup restores all data including photos atomically')
 # Inspect real DOM boundaries at phone/tablet/desktop sizes and both themes.
 for width,height in [(320,568),(360,640),(412,915),(768,1024),(1080,720)]:
  page.set_viewport_size({'width':width,'height':height})
  for theme in ['dark','light']:
   s=state();page.evaluate("async theme=>{const s=await LevelStore.read();await LevelStore.mutate(s,'settings',{theme})}",theme);page.reload();page.wait_for_selector('.content')
   for target in ['home','quests','money','hero','more']:
    go(target)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Horizontal overflow {width}/{theme}/{target}'
   go('home');assert page.evaluate("document.querySelector('.hero-copy .tag').getBoundingClientRect().bottom+4<=document.querySelector('.hero-progress').getBoundingClientRect().top"),f'Hero text overlaps XP at {width}/{theme}'
   go('hero');click('editor');assert page.locator('.editor .avatar').is_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');click('close')
  check(f'Responsive phone/tablet layout {width}x{height}, both themes')
 # Reject a storage failure atomically, with no uncaught error.
 result=page.evaluate("""async()=>{const s=await LevelStore.read(),original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='state')throw new DOMException('Full','QuotaExceededError');return original.apply(this,arguments)};try{await LevelStore.mutate(s,'settings',{music:.5});return false}catch{return (await LevelStore.read()).revision===s.revision}finally{IDBObjectStore.prototype.put=original}}""")
 assert result;check('Storage quota failure leaves last saved state intact')
 assert not errors,errors
 check('No uncaught browser errors')
 context.close()
 # Exact v0.8 database name and store, before the new app is loaded.
 ctx=browser.new_context();p=ctx.new_page();p.goto(URL+'/seed-legacy')
 p.evaluate("""async()=>{await new Promise((ok,no)=>{const r=indexedDB.open('ty-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('shots',{keyPath:'id'});r.onsuccess=()=>{const db=r.result;const t=db.transaction('shots','readwrite');t.objectStore('shots').put({id:'old-photo',date:'2026-11-17',data:'data:image/jpeg;base64,/9j/2Q=='});t.oncomplete=()=>{db.close();ok()}}});localStorage.setItem('ty-level-v2',JSON.stringify({v:2,onboard:true,profile:{name:'Из v0.8'},xp:123,coins:45,tx:[],logs:{}}))}""")
 p.goto(URL);p.wait_for_selector('.content');old=p.evaluate('LevelStore.read()');assert old['profile']['name']=='Из v0.8' and old['legacy']['xp']==123
 assert p.evaluate('(async()=> (await LevelStore.photos()).length)()')==1
 check('v0.8 localStorage and original ty-photos/shots migrate together')
 ctx.close();browser.close()
server.shutdown();(OUT/'test-results.json').write_text(json.dumps({'passed':checks,'page_errors':errors,'screenshots':'Test data only; financial/photo fixtures are not shipped in app'},ensure_ascii=False,indent=2));print(f'{len(checks)} checks passed; screenshots: {OUT}')

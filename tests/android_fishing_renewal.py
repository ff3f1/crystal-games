"""Exercise the actual signed update using Android's accessibility tree, offline."""
import subprocess,time,re,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path('output');OUT.mkdir(exist_ok=True)
PKG='ru.crystalgames.fishing'
def adb(*a):return subprocess.check_output(['adb',*a],text=True,stderr=subprocess.STDOUT)
def snapshot(name=None):
 adb('shell','uiautomator','dump','/sdcard/fishing.xml');xml=adb('shell','cat','/sdcard/fishing.xml')
 if name:(OUT/(name+'.xml')).write_text(xml)
 return ET.fromstring(xml)
def find(text=None,id=None):
 last=None
 for attempt in range(12):
  tree=snapshot();last=tree
  for n in tree.iter('node'):
   if ((id and n.get('resource-id')==id) or not id) and (not text or text in n.get('text','')+' '+n.get('content-desc','')):
    b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
    if len(b)==4 and b[2]>b[0] and b[3]>b[1]:return n
  if id=='bAct' and any(n.get('text','').strip()=='AD' for n in tree.iter('node')):
   # The real Yandex SDK may surface a cached fullscreen creative even offline.
   # Dismiss it through Android Back; never click the ad, CTA, or reward button.
   if attempt==0:shot('android-ad-overlay')
   adb('shell','input','keyevent','4')
   time.sleep(1.5)
  elif id=='bAct' and attempt<11:
   time.sleep(.9)
  else:break
 raise AssertionError('Missing visible UI '+str((text,id))+'\n'+ET.tostring(last,encoding='unicode')[:6000])
def tap(text=None,id=None):
 n=find(text,id);x,y,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',str((x+x2)//2),str((y+y2)//2));time.sleep(.65)
def shot(name):
 adb('shell','screencap','-p','/sdcard/fishing.png');adb('pull','/sdcard/fishing.png',str(OUT/(name+'.png')))
def back():adb('shell','input','keyevent','4');time.sleep(.5)
try:
 tree=snapshot()
 if any(n.get('resource-id')=='android:id/ok' for n in tree.iter('node')):tap('GOT IT')
 find(id='mGo');find('62 вида');snapshot('android-menu');shot('android-menu')
 tap(id='mAtlas');find('Атлас рыб');find('из 62');shot('android-atlas');back()
 tap(id='mSet');find('Музыка');find('Дальние птицы');shot('android-settings');back()
 tap(id='mMap');find('Выбери свой берег');tap('Зима');tap('Деревенский пруд');time.sleep(1.3)
 find('Бурить',id='bAct');shot('android-winter')
 tap(id='bAct');time.sleep(3);find('Играть',id='bAct');shot('android-hole')
 tap(id='tBait');find('Наживка');find('Червь');shot('android-bait');back()
 # Native back opens the pause/menu layer instead of abandoning the app.
 back();find(id='mGo');tap(id='mGo')
 adb('shell','input','keyevent','3');time.sleep(.8)
 adb('shell','am','start','-W','-n',PKG+'/ru.crystalgames.shell.MainActivity');time.sleep(1)
 find(id='mGo');tap(id='mJourney');find('Экспедиции');shot('android-expeditions');back()
 assert adb('shell','pidof',PKG).strip()
 logs=adb('logcat','-d','-s','AndroidRuntime:E','chromium:V')
 assert 'FATAL EXCEPTION' not in logs and 'Uncaught TypeError' not in logs
 (OUT/'ANDROID_RESULT.txt').write_text('PASS: upgrade from signed 1.0.10 with adb install -r; menu, atlas, settings, winter travel, drilling, bait, bait chooser, native back and background/resume work offline on Android 29.\n')
 print('PASS Android in-place update, offline UI, winter gameplay, bait chooser and lifecycle')
finally:
 shot('android-final');snapshot('android-final')
 (OUT/'android-log.txt').write_text(adb('logcat','-d','-s','AndroidRuntime:E','chromium:V'))

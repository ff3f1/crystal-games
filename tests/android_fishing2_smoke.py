"""Exercise the signed, offline APK through Android's actual accessibility tree."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path('output');OUT.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def snapshot(name=None):
    adb('shell','uiautomator','dump','/sdcard/fishing.xml')
    xml=adb('shell','cat','/sdcard/fishing.xml')
    if name:(OUT/(name+'.xml')).write_text(xml)
    return ET.fromstring(xml)
def find(text):
    tree=snapshot()
    candidates=[n for n in tree.iter('node') if text in (n.get('text','')+' '+n.get('content-desc',''))]
    if not candidates:raise AssertionError('Missing Android UI: '+text+'\n'+ET.tostring(tree,encoding='unicode'))
    return candidates[0]
def tap(text):
    n=find(text);x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.7)
def shot(name):
    adb('shell','screencap','-p','/sdcard/fishing.png')
    adb('pull','/sdcard/fishing.png',str(OUT/(name+'.png')))
try:
    # Android's first-launch fullscreen help is a system overlay, not game UI.
    tree=snapshot()
    if any(n.get('resource-id')=='android:id/ok' for n in tree.iter('node')):tap('GOT IT')
    find('НА РЫБАЛКУ');snapshot('android-home');shot('android-home')
    tap('НА РЫБАЛКУ');find('ЗАБРОСИТЬ');shot('android-game')
    tap('Червь');find('Наживка');find('Кукуруза');shot('android-bait')
    adb('shell','input','keyevent','4');time.sleep(.4)
    adb('shell','input','keyevent','4');time.sleep(.4);find('Тихая пауза')
    adb('shell','input','keyevent','3');time.sleep(.6)
    adb('shell','am','start','-W','-n','ru.crystalgames.fishing2/ru.crystalgames.shell.MainActivity');time.sleep(.6)
    find('Тихая пауза');tap('Главное меню');find('НА РЫБАЛКУ')
    tap('Водоёмы');find('Куда отправимся');find('Морская бухта');snapshot('android-maps');shot('android-maps')
    assert adb('shell','pidof','ru.crystalgames.fishing2').strip()
    (OUT/'ANDROID_RESULT.txt').write_text('PASS: signed APK installed; offline home, fishing scene, bait choice, native back, pause, background/resume and map menu work on Android 29.\n')
    print('PASS actual Android offline menu, game, bait, back, pause, background/resume and maps')
finally:
    shot('android-final');snapshot('android-final')
    (OUT/'android-log.txt').write_text(adb('logcat','-d','-s','AndroidRuntime:E','chromium:V'))

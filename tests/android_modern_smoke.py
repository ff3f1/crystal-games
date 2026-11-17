"""Android 15 smoke test with network blocked for the app UID."""
import re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path


def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, stderr=subprocess.STDOUT)


def visible(*, element=None, text=None):
    for _ in range(12):
        adb('shell', 'uiautomator', 'dump', '/sdcard/fishing35.xml')
        root=ET.fromstring(adb('shell', 'cat', '/sdcard/fishing35.xml'))
        assert not any(n.get('text','').strip()=='AD' for n in root.iter('node')), 'Unexpected ad in offline test'
        for n in root.iter('node'):
            val=n.get('text','')+' '+n.get('content-desc','')
            if (not element or n.get('resource-id')==element) and (not text or text in val):
                b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]: return b
        time.sleep(.7)
    raise AssertionError(f'Not visible: {element=} {text=}\n'+ET.tostring(root,encoding='unicode')[:9000])


def tap(**kwargs):
    x,y,x2,y2=visible(**kwargs)
    adb('shell','input','tap',str((x+x2)//2),str((y+y2)//2));time.sleep(.7)

try:
    try:
        visible(element='mGo')
    except AssertionError:
        tap(text='GOT IT')
        visible(element='mGo')
    tap(element='mGo')
    visible(element='bAct',text='Заброс')
    visible(text='Выбери место')
    tap(element='bMenu')
    tap(element='mMap')
    visible(text='Выбери свой берег')
    assert adb('shell','pidof','ru.crystalgames.fishing').strip()
    logs=adb('logcat','-d','-s','AndroidRuntime:E','chromium:V')
    assert 'FATAL EXCEPTION' not in logs and 'Uncaught TypeError' not in logs
    print('PASS: Android 15, in-place upgrade from 1.0.10, menu, fishing screen and map, app network blocked')
finally:
    out=Path('output');out.mkdir(exist_ok=True)
    try:
        adb('shell','uiautomator','dump','/sdcard/fishing35.xml')
        (out/'android35.xml').write_text(adb('shell','cat','/sdcard/fishing35.xml'))
        adb('shell','screencap','-p','/sdcard/fishing35.png')
        adb('pull','/sdcard/fishing35.png',str(out/'android35.png'))
        (out/'android35.log').write_text(adb('logcat','-d','-s','AndroidRuntime:E','chromium:V','WebViewFactory:V'))
    except Exception as exc:
        print('Diagnostic capture failed:',exc)

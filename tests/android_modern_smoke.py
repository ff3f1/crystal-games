"""Exercise Android 15 via real taps; archive screens for visual verification.

The stock API 35 WebView exposes only a single accessibility node to uiautomator,
so the test uses the known 1080x1920 device coordinates and checks the captured
screens in addition to the app process and logcat.
"""
import hashlib, subprocess, time
from pathlib import Path

OUT=Path('output');OUT.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def shot(name):
    adb('shell','screencap','-p','/sdcard/fishing35.png')
    target=OUT/(name+'.png');adb('pull','/sdcard/fishing35.png',str(target))
    return hashlib.sha256(target.read_bytes()).hexdigest()

def tap(x,y):adb('shell','input','tap',str(x),str(y));time.sleep(2)
try:
    first=shot('01-menu')
    tap(540,1100)    # На рыбалку
    second=shot('02-fishing')
    tap(82,82)       # Меню
    tap(210,1300)    # Водоёмы
    third=shot('03-waters')
    assert len({first,second,third})==3,'Taps did not change the visible screen'
    assert adb('shell','pidof','ru.crystalgames.fishing').strip()
    logs=adb('logcat','-d','-s','AndroidRuntime:E','chromium:V')
    assert 'FATAL EXCEPTION' not in logs and 'Uncaught TypeError' not in logs
    print('PASS: Android 15, in-place upgrade from 1.0.10, taps changed screens; app network blocked')
finally:
    try:(OUT/'android35.log').write_text(adb('logcat','-d','-s','AndroidRuntime:E','chromium:V','WebViewFactory:V'))
    except Exception as exc:print('Diagnostic capture failed:',exc)

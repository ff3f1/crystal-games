#!/usr/bin/env bash
# A single-file script because android-emulator-runner runs script: lines
# as separate sh -c commands; heredocs cannot be embedded in script: YAML.
set -euo pipefail
PKG="ru.crystalgames.fishing"
ACTIVITY="ru.crystalgames.shell.MainActivity"
APK="${1:?Expected path to APK}"
mkdir -p out
adb logcat -c || true
trap 'adb logcat -d -v brief > out/emulator-logcat.txt 2>/dev/null || true' EXIT
adb install -r "$APK" | tee out/emulator-install.txt
adb shell pm path "$PKG" | tee out/emulator-package.txt
grep -q '^package:' out/emulator-package.txt
adb shell am start -W -n "$PKG/$ACTIVITY" | tee out/emulator-start.txt
sleep 20
adb shell pidof "$PKG" | tee out/emulator-pid.txt
test -s out/emulator-pid.txt
# Native process alive is not sufficient: a missing menu is also a failed launch.
adb logcat -d -s FishBootAudit:I '*:S' > out/emulator-boot-audit.txt
grep -q 'UI_READY true' out/emulator-boot-audit.txt || {
  cat out/emulator-boot-audit.txt
  echo 'WebView did not render the game menu within 20 seconds' >&2
  exit 1
}
adb exec-out screencap -p > out/emulator-game.png
python - <<'PY'
from PIL import Image, ImageStat
with Image.open('out/emulator-game.png') as img:
    img.load()
    contrast = max(ImageStat.Stat(img.convert('RGB')).stddev)
    if img.width < 300 or img.height < 500 or contrast < 1.0:
        raise SystemExit(f'Invalid/blank Android screen: {img.size}, contrast={contrast}')
    print(f'Emulator screenshot OK: {img.size}, contrast={contrast:.2f}')
PY
# Restarting must not clear the player's app storage.
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/$ACTIVITY" | tee out/emulator-restart.txt
sleep 6
adb shell pidof "$PKG" > out/emulator-restart-pid.txt
test -s out/emulator-restart-pid.txt
echo 'INSTALL_AND_LAUNCH=PASS' > out/emulator-result.txt

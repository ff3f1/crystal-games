#!/usr/bin/env bash
# Run while the emulator is alive; retain evidence even if an assertion fails.
set -eu
cd "$(dirname "$0")/.."
mkdir -p device-evidence
collect() {
    task_status=$?
    trap - EXIT
    timeout 20s adb pull /sdcard/Android/data/ru.uroven.adventurepreview/files/screenshots device-evidence/ || true
    timeout 20s adb logcat -d > device-evidence/logcat.txt || true
    exit "$task_status"
}
trap collect EXIT
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
test "$(adb shell settings get global airplane_mode_on | tr -d '\r')" = 1
gradle connectedDebugAndroidTest --no-daemon --stacktrace

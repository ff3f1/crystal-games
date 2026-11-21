#!/usr/bin/env python3
"""Patch ONLY the SHA-256-pinned published 2.0.1 APK (binary-safe source for signed CI update).
No change to gameplay, existing save data, ads frequency, or publisher ad IDs.
IMPORTANT: output must be zipaligned and release-signed with ORIGINAL signing key.
"""
import hashlib
import struct
import sys
import zipfile
from pathlib import Path

ORIGINAL_SHA = "d94f32a9434905c630adc1addbaed753e42bc9909edd75e9948d7394ef7c02c5"
ORIGINAL_VERSION = "2.0.1"
HOTFIX_VERSION = "2.0.2"

def replace_once(text, old, new, purpose):
    if text.count(old) != 1:
        raise RuntimeError(f"{purpose}: expected exactly one original pattern, got {text.count(old)}")
    return text.replace(old, new)

def patch_manifest(data):
    old_name = ORIGINAL_VERSION.encode("utf-16le")
    new_name = HOTFIX_VERSION.encode("utf-16le")
    old_code = struct.pack("<I", 2001)
    new_code = struct.pack("<I", 2002)
    if data.count(old_name) != 1 or data.count(old_code) != 1:
        raise RuntimeError("Unknown AndroidManifest binary layout; cannot safely change version")
    output = data.replace(old_name, new_name).replace(old_code, new_code)
    assert len(data) == len(output)
    return output

def patch_platform(data):
    text = data.decode("utf-8")
    text = replace_once(text,
      '  const pending = {};\n  window.__adResult = function (id, ok) { if (pending[id]) { pending[id](!!ok); delete pending[id]; } };',
      '''  const pending = Object.create(null);
  window.__adResult = function (id, ok) {
    const job = pending[id];
    if (!job) return;
    delete pending[id];
    clearTimeout(job.timer);
    job.resolve(!!ok);
  };''', "ad callback")
    text = replace_once(text,
      '''          const id = ++seq; pending[id] = res;
          kind === "reward" ? window.AndroidAds.showRewarded(id) : window.AndroidAds.showInterstitial(id);
          setTimeout(function () { if (pending[id]) { pending[id](false); delete pending[id]; } }, 60e3);''',
      '''          const id = ++seq;
          const job = { resolve: res, timer: null };
          pending[id] = job;
          // Timeout only protects against a permanently missing native SDK callback.
          job.timer = setTimeout(function () {
            if (pending[id] !== job) return;
            delete pending[id];
            res(false);
          }, 180e3);
          try {
            kind === "reward" ? window.AndroidAds.showRewarded(id) : window.AndroidAds.showInterstitial(id);
          } catch (error) {
            if (pending[id] === job) {
              delete pending[id];
              clearTimeout(job.timer);
              res(false);
            }
          }''', "native SDK request")
    return text.encode("utf-8")

def patch_ui(data):
    text=data.decode("utf-8")
    return replace_once(text,
      '    $("lRev").onclick = async () => { const lost=G.rig().lost;$("lRev").disabled=true;const ok = await FZ.Ads.rewarded(); ov.classList.remove("on"); if (ok&&G.rig().lost===lost) G.revive(); else UI.toast("Реклама сейчас недоступна", "bad"); };',
      '''    $("lRev").onclick = async () => {
      const btn = $("lRev"), originalRig = G.rig();
      if (!btn || btn.disabled || !originalRig || !originalRig.lost) return;
      const lost = originalRig.lost;
      btn.disabled = true;
      let ok = false;
      try { ok = await FZ.Ads.rewarded(); }
      catch (e) { ok = false; }
      const unchanged = G.rig() === originalRig && originalRig.lost === lost;
      if (ok && unchanged && G.revive()) {
        ov.classList.remove("on");
      } else if (unchanged) {
        btn.disabled = false;
        UI.toast(ok ? "Второй шанс не сработал" : "Реклама сейчас недоступна. Попробуйте ещё раз", "bad");
      } else {
        ov.classList.remove("on");
      }
    };''', "revive retry").encode("utf-8")

def patch(source: Path, dest: Path):
    if hashlib.sha256(source.read_bytes()).hexdigest() != ORIGINAL_SHA:
        raise RuntimeError("Source APK is not the user-approved 2.0.1 build, refusing")
    with zipfile.ZipFile(source) as z:
        if z.testzip() is not None:
            raise RuntimeError("Source APK failed ZIP integrity")
        replace = {
            "AndroidManifest.xml": patch_manifest(z.read("AndroidManifest.xml")),
            "assets/js/platform.js": patch_platform(z.read("assets/js/platform.js")),
            "assets/js/ui.js": patch_ui(z.read("assets/js/ui.js")),
        }
        with zipfile.ZipFile(dest, "w", allowZip64=True) as out:
            for info in z.infolist():
                out.writestr(info, replace.get(info.filename, z.read(info.filename)))
    with zipfile.ZipFile(dest) as z:
        if z.testzip() is not None:
            raise RuntimeError("Patched ZIP failed CRC")
        assert HOTFIX_VERSION.encode("utf-16le") in z.read("AndroidManifest.xml")
        assert struct.pack("<I", 2002) in z.read("AndroidManifest.xml")
        assert b"180e3" in z.read("assets/js/platform.js")
    print("Patched ONLY: " + ", ".join(replace))
    print("Unsigned SHA-256 " + hashlib.sha256(dest.read_bytes()).hexdigest())

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: python tools/fishing_201_hotfix.py published-2.0.1.apk unsigned-hotfix.apk")
    patch(Path(sys.argv[1]), Path(sys.argv[2]))

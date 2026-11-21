#!/usr/bin/env python3
"""Fetch currently published fishing APK from RuStore; never use an unverified substitute."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

BASE = "https://backapi.rustore.ru"
PKG = "ru.crystalgames.fishing"
EXPECTED_SHA = "d94f32a9434905c630adc1addbaed753e42bc9909edd75e9948d7394ef7c02c5"
HEADERS = {
    "ruStoreVerCode": "12000",
    "User-Agent": "RuStore/12000 Android",
    "Accept": "application/json",
}

def api(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = dict(HEADERS)
    if payload is not None: headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(BASE + path, headers=headers, data=data)
    with urllib.request.urlopen(req, timeout=40) as response:
        obj = json.load(response)
    if obj.get("code") != "OK":
        raise RuntimeError(f"RuStore API failed at {path}: {obj.get('message')}")
    return obj["body"]

def download(dest):
    info = api("/applicationData/overallInfo/" + PKG)
    if str(info.get("versionCode")) != "2001" or info.get("versionName") != "2.0.1":
        raise RuntimeError("RuStore currently publishes a DIFFERENT build; will not modify it")
    app_id = info["appId"]
    urls = []
    try:
        resp = api("/applicationData/v2/download-link", {
            "appId": app_id,
            "firstInstall": True,
            "screenDensity": 480,
            "sdkVersion": 33,
            "withoutSplits": True,
            "supportedAbis": ["arm64-v8a", "armeabi-v7a"],
        })
        if str(resp.get("versionCode")) != "2001":
            raise RuntimeError("RuStore download version mismatch")
        urls.extend([v["url"] for v in resp.get("downloadUrls", []) if v.get("url")])
    except Exception as exc:
        print("RuStore v2 download-link unavailable:", exc, file=sys.stderr)
    if not urls:
        resp = api("/applicationData/download-link", {"appId": app_id, "firstInstall": True})
        if str(resp.get("versionCode")) != "2001":
            raise RuntimeError("RuStore v1 download version mismatch")
        urls.append(resp["apkUrl"])
    if len(urls) != 1:
        raise RuntimeError("Unexpected split APK; only an original unified APK is allowed")
    req = urllib.request.Request(urls[0], headers={"User-Agent": "RuStore/12000 Android"})
    h = hashlib.sha256()
    with urllib.request.urlopen(req, timeout=180) as stream, open(dest, "wb") as out:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk: break
            h.update(chunk); out.write(chunk)
    if h.hexdigest() != EXPECTED_SHA:
        dest.unlink(missing_ok=True)
        raise RuntimeError("Downloaded APK SHA-256 differs from the user's original. No output generated.")
    print("Exact original 2.0.1 APK recovered from RuStore and SHA-256 checked")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python tools/fishing_201_download.py original.apk")
    download(Path(sys.argv[1]))

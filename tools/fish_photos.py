#!/usr/bin/env python3
"""Build photographed, attributed water backdrops for the Fishing 1.2 game.

Sources: Wikimedia Commons MediaWiki API. Reuse is limited to PD/CC0/CC BY/CC BY-SA.
All selected photos and the derived seasonal variants are attributed in-game.
This script is safe to re-run; it never overwrites files if fewer than 20
legally licensed photos were downloaded.
"""
from __future__ import annotations

import html
import io
import json
import re
import sys
import time
from pathlib import Path

import requests
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "games/fish/assets/bg"
MANIFEST = ROOT / "games/fish/assets/assets.js"
ATTRIBUTIONS = ROOT / "games/fish/assets/PHOTO_CREDITS.md"
UA = "CrystalGamesFishingPhotoreal/1.2 (open-source game https://github.com/ff3f1/crystal-games)"
API = "https://commons.wikimedia.org/w/api.php"
SEASONS = ("spring", "summer", "autumn", "winter")
# Include distinct original and newly introduced waters.
WATERS = {
    "pond": ("forest pond reflection shore","forest pond winter snow"),
    "oka": ("Oka river Russia landscape","Russian river snow"),
    "platnik": ("fishing lake reeds forest","frozen pond forest"),
    "volga": ("Volga river landscape","Volga river winter"),
    "ladoga": ("Lake Ladoga shore water","Lake Ladoga winter"),
    "akhtuba": ("Akhtuba river landscape","Volga delta winter river"),
    "baikal": ("Lake Baikal landscape shore","Lake Baikal frozen lake"),
    "taiga": ("Siberian forest river taiga","Siberian snowy river"),
    "northstream": ("Karelia river forest landscape","Karelia river winter"),
    "mountainlake": ("Altai mountain lake landscape","Altai mountain lake winter"),
    "don": ("Don river Russia landscape","Don river winter Russia"),
    "polar": ("Yamal tundra river landscape","Yamal tundra snow river"),
    "kamchatka": ("Kamchatka volcano bay landscape","Kamchatka volcano snow sea"),
    "seliger": ("Lake Seliger landscape","Lake Seliger winter frozen"),
    "onega": ("Lake Onega landscape shore","Lake Onega winter"),
    "katun": ("Katun river Altai landscape","Katun river winter Altai"),
    "kola": ("Kola Peninsula river landscape","Kola Peninsula winter river"),
    "amur": ("Amur river Khabarovsk landscape","Amur river winter snow"),
    "blacksea": ("Black Sea Russia coast landscape","Black Sea coast winter waves"),
    "barents": ("Barents Sea Norway coast landscape","Barents Sea snowy coast"),
}
DEFAULT_SEARCH = (
    "mountain lake landscape photograph",
    "river forest landscape photograph",
    "coastal landscape photograph",
)
# Commerical reuse permitted; attribution and share-alike terms are written to credits.
LICENSE_RX = re.compile(r"(CC0|PUBLIC DOMAIN|CC BY(?:-SA)?(?:\s+\d(?:\.\d)?)?)", re.I)
FORBIDDEN = re.compile(r"(painting|drawing|artwork|illustrat|vector|map of|flag of|coat of arms|postcard|portrait|watercolor|oil on canvas|digital art)", re.I)
client = requests.Session()
client.headers.update({"User-Agent": UA, "Accept": "application/json"})

def api_search(query: str):
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": "filetype:bitmap " + query,
        "gsrnamespace": "6", "gsrlimit": "30",
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": "1100",
    }
    for attempt in range(3):
        try:
            r = client.get(API, params=params, timeout=35)
            r.raise_for_status()
            j = r.json()
            return list(j.get("query", {}).get("pages", {}).values())
        except Exception as exc:
            print("Commons query retry:", query, repr(exc), flush=True)
            time.sleep(2 + 3*attempt)
    return []

def clean(text):
    return html.unescape(re.sub("<[^>]+>", "", text or "")).strip()

def score(page, query):
    ii = (page.get("imageinfo") or [{}])[0]
    title = page.get("title", "")
    if FORBIDDEN.search(title) or not ii.get("mime", "").startswith("image/"):
        return None
    w, h = ii.get("width", 0), ii.get("height", 0)
    if w < 750 or h < 430 or not 1.25 <= w / max(1, h) <= 3.8:
        return None
    ext = ii.get("extmetadata", {})
    license = clean((ext.get("LicenseShortName") or {}).get("value", ""))
    if not LICENSE_RX.fullmatch(license):
        return None
    if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
        return None
    tokens = [x for x in re.findall(r"[a-zA-Z]{4,}", query.lower()) if x not in ("landscape","photograph","water","shore")]
    match = sum(1 for token in tokens if token in title.lower()) 
    # Prefer a shoreline panorama with geographic relevance, not a close-up object.
    merit = 10 * match + min(w, 4500) / 1000 + min(w/h, 2.4)
    if "panorama" in title.lower(): merit += 2
    return merit, {
        "url": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl") or "",
        "title": title, "author": clean((ext.get("Artist") or {}).get("value", "")),
        "license": license, "source": ii.get("url", ""),
        "width": w, "height": h
    }

def pick_photo(label, query, generic):
    for q in (query, generic, *DEFAULT_SEARCH):
        pages = api_search(q)
        cand = [score(x, query) for x in pages]
        cand = sorted((x for x in cand if x), key=lambda x: x[0], reverse=True)
        for val, d in cand[:10]:
            try:
                r = client.get(d["url"], timeout=45, headers={"Accept":"image/*"})
                r.raise_for_status()
                raw = Image.open(io.BytesIO(r.content)).convert("RGB")
                if raw.width < 700 or raw.height < 400:
                    continue
                print(label, "source:", d["title"], "|", d["license"], "|", raw.size, flush=True)
                return raw, d
            except Exception as exc:
                print("image unavailable", d["title"], str(exc)[:90], flush=True)
    raise RuntimeError("No licensed photo available for "+label+" / "+query)

def grade(image, season):
    image = ImageOps.fit(image, (960, 600), method=Image.Resampling.LANCZOS, centering=(.5, .49))
    if season == "spring":
        image=ImageEnhance.Color(image).enhance(.94)
        image=ImageEnhance.Brightness(image).enhance(1.04)
    elif season == "summer":
        image=ImageEnhance.Color(image).enhance(1.07)
    elif season == "autumn":
        # Golden-hour grading without flattening photographic details.
        r,g,b=image.split()
        image=Image.merge("RGB",(r.point(lambda x:min(255,round(x*1.12))),
                                  g.point(lambda x:round(x*.92)),
                                  b.point(lambda x:round(x*.79))))
        image=ImageEnhance.Contrast(image).enhance(1.06)
    elif season == "winter":
        image=ImageEnhance.Color(image).enhance(.59)
        image=Image.blend(image,Image.new("RGB",image.size,(174,207,231)),.15)
        image=ImageEnhance.Contrast(image).enhance(1.09)
    image=ImageEnhance.Sharpness(image).enhance(1.14)
    return image

def main():
    BG.mkdir(parents=True,exist_ok=True)
    images = {}
    credits = {}
    # Download everything before committing manifest. Fail closed on license issues.
    for name, (warm_query, winter_query) in WATERS.items():
        warm, credit = pick_photo(name + "/summer", warm_query, name + " lake or river")
        cold, cold_credit = pick_photo(name + "/winter", winter_query, name + " winter")
        credits[name] = {"summer":credit, "winter":cold_credit}
        for season in SEASONS:
            src=cold if season=="winter" else warm
            out=io.BytesIO()
            grade(src, season).save(out, "WEBP", quality=76, method=5)
            images["bg/"+name+"_"+season] = out.getvalue()
    text=MANIFEST.read_text(encoding="utf-8")
    for key in images:
        # Add or replace path without affecting other game assets/audio.
        path=key+".webp"
        pat=r'("'+re.escape(key)+r'"\s*:\s*")[^"]*(")'
        if re.search(pat,text):
            text=re.sub(pat,lambda m:m.group(1)+path+m.group(2),text,count=1)
        else:
            text=text.replace('"images": {','"images": {\n  "'+key+'": "'+path+'",',1)
    for key in images:
        # All selected scenes are cropped to a stable horizon around 53%.
        pat=r'("'+re.escape(key)+r'"\s*:\s*)[\d.]+'
        idx=text.index('"waterline"')
        before, wl=text[:idx],text[idx:]
        if re.search(pat,wl):
            wl=re.sub(pat,lambda m:m.group(1)+"0.53",wl,count=1)
        else:
            wl=wl.replace('"waterline": {','"waterline": {\n   "'+key+'": 0.53,',1)
        text=before+wl
    MANIFEST.write_text(text,encoding="utf-8")
    for key,raw in images.items():
        target=BG/(key[3:]+".webp")
        target.write_bytes(raw)
        print("photo",target.relative_to(ROOT),len(raw),flush=True)
    lines=["# Photographic backgrounds — Fishing 1.2","","All original works below are Wikimedia Commons photographs used under their indicated",
           "license. Crops and color-graded seasonal variants retain the source license.",
           "Commercial use is permitted by these licenses; CC BY-SA derivatives remain under",
           "their respective ShareAlike terms. Attribution must ship with the game.",
           ""]
    for name,v in credits.items():
        for season,p in v.items():
            lines.append("* **"+name+" / "+season+"**: "+p["title"]+" — "+(p["author"] or "uncredited")+
                         "; license "+p["license"]+"; "+p["page"])
    ATTRIBUTIONS.write_text("\n".join(lines)+"\n",encoding="utf-8")
    print("DONE: generated",len(images),"photo-backed seasonal locations",flush=True)

if __name__=="__main__":
    main()

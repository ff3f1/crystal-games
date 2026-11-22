import requests,json,re,html
names=[
'Hooked alligator gar jumps out of the water.webm',
'Silver carp jumping out of the Illinois River.webm',
'Fish jumping on the Green River in Kanaskat-Palmer State Park.webm',
'Jumping Sea Trout.webm',
'Eel caught by rod and line.webm',
'Fishing bells alerting to bites.webm',
'Fishing bells demo.webm',
'Fishing 1.webm',
'Fishing.webm',
'Fishing - video.webm',
]
S=requests.Session();S.headers.update({'User-Agent':'ShpargalkaFilm/1.0 (contact: https://github.com/ff3f1/crystal-games)'})
r=S.get('https://commons.wikimedia.org/w/api.php',params={'action':'query','format':'json','titles':'|'.join('File:'+x for x in names),'prop':'imageinfo','iiprop':'url|size|mime|extmetadata'},timeout=45)
r.raise_for_status()
for p in r.json()['query']['pages'].values():
 i=p.get('imageinfo',[{}])[0];meta=i.get('extmetadata',{})
 clean=lambda x:re.sub('<.*?>','',html.unescape(x))
 print('FILE',p.get('title'),json.dumps({'bytes':i.get('size'),'width':i.get('width'),'height':i.get('height'),'url':i.get('url'),'license':meta.get('LicenseShortName',{}).get('value'),'artist':clean(meta.get('Artist',{}).get('value',''))[:130],'usage':meta.get('UsageTerms',{}).get('value','')[:150]},ensure_ascii=False),flush=True)

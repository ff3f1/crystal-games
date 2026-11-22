import requests,re,html,json,urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup
sources={
'POV':'https://www.vecteezy.com/video/53663037-fisherman-pov-fighting-fish-in-the-river-fishing-catch-and-release-sport-and-nature-equipment',
'NET':'https://www.vecteezy.com/video/13426043-a-fisherman-pulls-a-trout-out-of-the-water-on-a-spinning-rod-and-puts-it-in-a-net-fishing-on-the-pond-fishing-equipment-breeding-of-river-trout',
}
s=requests.Session();s.headers['User-Agent']='Mozilla/5.0'
for name,url in sources.items():
 try:
  r=s.get(url,timeout=30)
  print('PAGE',name,r.status_code,r.url,'length',len(r.content),flush=True)
  t=r.text
  matches=list(dict.fromkeys(re.findall(r'https?[^"\\\s<>]{15,250}(?:\\.mp4|\\.webm|\\.m3u8)[^"\\\s<>]{0,150}',t,re.I)))
  print('DIRECT URL COUNT',name,len(matches),flush=True)
  for k,u in enumerate(matches[:24]):print('DIRECT',name,k,html.unescape(u)[:330],flush=True)
  for regex in ['video_preview','preview.mp4','videopreview','watermark','video_url','downloadUrl','encoded_file_url','720p','1080p','mp4']:
   a=t.lower().find(regex.lower())
   print('MARKER',name,regex,a,repr(t[max(0,a-100):a+170]) if a>=0 else '',flush=True)
 except Exception as e:print('ERROR',name,repr(e),flush=True)

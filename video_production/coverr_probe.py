import requests,re,html,json,subprocess,os
from pathlib import Path
from bs4 import BeautifulSoup
U={
'reel1':'https://coverr.co/videos/a-man-reeling-a-fishing-rod-2ganoqidzb',
'reel2':'https://coverr.co/videos/a-fisherman-reeling-his-fishing-rod-hwhkdgnght',
'cast':'https://coverr.co/videos/a-fisherman-casting-his-hook-into-the-sea-t1iwyawaxt',
'hook':'https://coverr.co/videos/a-fisherman-attaches-a-hook-to-a-fishing-line-keqlvc68b5',
'man':'https://coverr.co/videos/man-holding-a-fishing-rod-2bjdh6rlan',
'fish':'https://coverr.co/stock-video-footage/fish',
'fishing':'https://coverr.co/stock-video-footage/fishing',
'jump':'https://coverr.co/stock-video-footage/fish-jumping',
'splash':'https://coverr.co/stock-video-footage/water-splash',
}
s=requests.Session();s.headers.update({'User-Agent':'Mozilla/5.0'})
for name,url in U.items():
 try:
  r=s.get(url,timeout=25);t=r.text
  print('PAGE',name,r.status_code,len(t),flush=True)
  mp4=re.findall(r'https://cdn(?:-staging)?\.coverr\.co/videos/[^\s"<>\\]{5,180}?(?:360p|720p|1080p)\.mp4',t)
  mp4=list(dict.fromkeys(html.unescape(x).replace('\\u0026','&') for x in mp4))
  print('COUNT',name,len(mp4),'HEAD',mp4[:14],flush=True)
  if '/videos/' in url:
   for x in mp4[:5]:print('MP4',name,x,flush=True)
   for e in ['"title"','"description"','"videoUrl"','"downloadUrl"','"slug"','"video"','"variants"','"mp4Url"']:
    k=t.find(e)
    print('NEAR',name,e,k,t[max(0,k-160):k+260].replace('\n',' ') if k>=0 else '',flush=True)
  else:
   for m in mp4[:40]:print('COLLECTION',name,m,flush=True)
 except Exception as e:print('ERROR',name,repr(e),flush=True)

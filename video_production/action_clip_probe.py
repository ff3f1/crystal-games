#!/usr/bin/env python3
import requests,re,html,json,subprocess,sys
from bs4 import BeautifulSoup
u={
 'pexels_cast':'https://www.pexels.com/video/man-fishing-on-the-river-5534696/',
 'pexels_line':'https://www.pexels.com/video/close-up-shot-of-a-fishing-line-hitting-the-water-6739545/',
 'pexels_gear':'https://www.pexels.com/video/close-up-view-of-man-getting-his-fish-hook-ready-4822324/',
 'pexels_rod':'https://www.pexels.com/video/man-with-his-fishing-rod-trying-to-catch-fish-5236941/',
 'pexels_reel':'https://www.pexels.com/video/low-angle-view-of-a-fisherman-reeling-in-a-double-catch-16929615/',
 'pexels_lake':'https://www.pexels.com/video/man-walking-in-the-lake-while-holding-a-fishing-rod-4327965/',
 'pixabay_salmon':'https://pixabay.com/videos/fish-salmon-jumping-river-313965/',
 'pixabay_lure':'https://pixabay.com/videos/bait-fishing-hook-nature-water-238658/',
 'pixabay_fish':'https://pixabay.com/videos/fish-carp-pike-eel-flow-85684/',
 'pixabay_ai_angler':'https://pixabay.com/videos/ai-generated-fisherman-river-forest-174568/',
 'pixabay_ai_fish':'https://pixabay.com/videos/ai-is-generated-fish-water-animal-380642/',
 'coverr_fish':'https://coverr.co/stock-video-footage/fish-hook',
}
sess=requests.Session();sess.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9'})
for k,url in u.items():
 try:
  r=sess.get(url,timeout=18)
  h=r.text
  print('PAGE',k,r.status_code,len(r.content),r.url,flush=True)
  vv=re.findall(r'https?[^"\\\s<>]{10,250}(?:\.mp4|\.webm|\.m3u8)[^"\\\s<>]{0,100}',h,re.I)
  for x in dict.fromkeys(vv):print('VIDEOURL',k,html.unescape(x)[:360],flush=True)
  markers=['videos.pexels.com/video-files','cdn.pixabay.com/video','videos.ctfassets.net','pixabay.com/videos/','pexels.com/video/','og:video']
  for m in markers:
   q=h.find(m)
   if q>=0:print('MARKER',k,m,repr(h[max(0,q-80):q+260]),flush=True)
  soup=BeautifulSoup(h,'html.parser')
  for a in soup.select('meta[property="og:video"], meta[property="og:video:url"],meta[property="og:video:secure_url"]'):
   print('OGVID',k,a.get('content',''),flush=True)
 except Exception as e:print('ERR',k,type(e).__name__,str(e)[:220],flush=True)

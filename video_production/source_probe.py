import requests, re, json, subprocess, sys
from bs4 import BeautifulSoup
ids={'grayling_pike':'1c8ce64d-525d-4f7c-bda6-2a88f5c6e838','brook_trout':'d9413087-4bef-4d2f-952c-11ca4af83bde','florida7':'1de5aaf3-673b-4cc4-890b-fe5a93f5eea8'}
base='https://fws.rev.vbrick.com'
s=requests.Session();s.headers.update({'User-Agent':'Mozilla/5.0'})
for key,vid in ids.items():
 for pat in [f'/api/v2/videos/{vid}/details',f'/api/v2/videos/{vid}/playback-url',f'/api/v2/videos/{vid}/download',f'/embed?id={vid}']:
  try:
   r=s.get(base+pat,timeout=15)
   print(key,pat,r.status_code,r.url, 'contenttype',r.headers.get('Content-Type'),'sample',r.text[:350].replace('\n',' '),flush=True)
  except Exception as e:print('ERR',key,pat,str(e)[:120],flush=True)
 if key=='grayling_pike':
  page=s.get(base+f'/embed?id={vid}',timeout=15)
  print('EMBED MARKERS',re.findall(r'.{0,60}(?:mp4|m3u8|api/v2|playback).{0,80}',page.text,re.I)[:15],flush=True)
try:
 subprocess.run([sys.executable,'-m','pip','install','-q','yt-dlp'],timeout=50,check=True)
 for key,vid in ids.items():
  if key=='florida7':continue
  r=subprocess.run(['yt-dlp','-J',base+f'/embed?id={vid}'],capture_output=True,text=True,timeout=45)
  print('YTDLP',key,'exit',r.returncode,'out',r.stdout[:350],'err',r.stderr[-500:],flush=True)
except Exception as e:print('YT ERROR',repr(e),flush=True)

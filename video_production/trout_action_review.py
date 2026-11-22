import requests,time,subprocess,re,math,json,urllib.parse,hashlib,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
OUT=Path("video_production/trout_action_review");OUT.mkdir(parents=True,exist_ok=True)
S=requests.Session();S.headers.update({'User-Agent':'FishingDocumentaryOpenLicense/1.0 (https://github.com/ff3f1/crystal-games)'})
def fetch(name):
 link="https://commons.wikimedia.org/wiki/Special:Redirect/file/"+urllib.parse.quote(name.replace(' ','_'),safe='')
 f=OUT/(re.search(r'video (\d+)\.webm',name,re.I).group(1)+'.webm')
 for i in range(3):
  try:
   resp=S.get(link,timeout=(10,30),stream=True)
   print('DOWNLOAD',f.name,resp.status_code,resp.headers.get('content-length'),flush=True)
   if resp.status_code==429:time.sleep(2+i*3);continue
   resp.raise_for_status()
   if not resp.headers.get('content-type','').startswith('video/'):
    print('BAD TYPE',resp.headers.get('content-type'));return
   with f.open('wb') as out:
    for chunk in resp.iter_content(256*1024):
     if chunk:out.write(chunk)
   if f.stat().st_size>100000:return f
  except Exception as e:print('ERROR',f.name,str(e)[:100],flush=True)
  time.sleep(2+i*2)
s=[
'Trout Area Tour 2026 ( III. závod Líheň Liběchov) video '+str(i).zfill(2)+'.webm'
for i in [1,3,5,6,7,9,11,12,14,16,18,20,24,27,31,36,42,50]
]
allshots=[]
for name in s:
 f=fetch(name)
 if not f:continue
 rr=subprocess.run([FF,'-hide_banner','-i',str(f)],capture_output=True,text=True)
 mt=re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',rr.stderr)
 if not mt:continue
 total=int(mt.group(1))*3600+int(mt.group(2))*60+float(mt.group(3))
 print('VIDEO',f.name,'duration',total,'bytes',f.stat().st_size,flush=True)
 for j,fraction in enumerate((.2,.5,.8)):
  t=total*fraction
  jpg=OUT/f'{f.stem}_{j}.png'
  p=subprocess.run([FF,'-y','-loglevel','error','-ss',f'{t:.2f}','-i',str(f),'-frames:v','1','-vf','scale=360:203:flags=bicubic,format=rgb24',str(jpg)],capture_output=True,text=True)
  if jpg.exists():allshots.append((f.stem,round(t,1),jpg))
w,h=360,233; cols=6
page=Image.new('RGB',(cols*w,h*math.ceil(len(allshots)/cols)),(7,18,25));d=ImageDraw.Draw(page)
for i,(code,t,jpg) in enumerate(allshots):
 x=i%cols*w;y=i//cols*h
 page.paste(Image.open(jpg).convert('RGB'),(x,y))
 d.rectangle((x,y+202,x+w,y+h),fill=(10,13,20))
 d.text((x+10,y+207),f'{code}    {t:.1f} s',fill='white')
page.save(OUT/'TR0UT_CONTACT.jpg',quality=91)
print('COUNT',len(list(OUT.glob('*.webm'))),'FRAMES',len(allshots),flush=True)

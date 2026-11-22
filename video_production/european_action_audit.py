import requests,hashlib,urllib.parse,subprocess,re,time,json,sys,math
from pathlib import Path
from PIL import Image,ImageDraw
import imageio_ffmpeg
D=Path('video_production/real_action_audit');D.mkdir(exist_ok=True,parents=True)
names=['Konečně štika.webm','Hezky do vaničky.webm','Start závodu.webm','Ta je malá.webm','Brodění v rybníce.webm']
FF=imageio_ffmpeg.get_ffmpeg_exe()
s=requests.Session();s.headers.update({'User-Agent':'FishingVideoResearch/1.2 (github.com/ff3f1/crystal-games)','Accept':'*/*'})
for name in names:
 encoded=urllib.parse.quote(name.replace(' ','_'),safe='')
 hash=hashlib.md5(name.replace(' ','_').encode('utf8')).hexdigest()
 paths=[
 'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encoded,
 'https://upload.wikimedia.org/wikipedia/commons/'+hash[0]+'/'+hash[:2]+'/'+encoded,
 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=File%3A'+encoded,
 'https://upload.wikimedia.org/wikipedia/commons/transcoded/'+hash[0]+'/'+hash[:2]+'/'+encoded+'/'+encoded+'.480p.vp9.webm'
 ]
 outfile=D/(name.replace(' ','_'))
 for k,url in enumerate(paths):
  try:
   r=s.get(url,timeout=(8,25),stream=True)
   print('TRY',name,k,r.status_code,r.url[:180],r.headers.get('content-type'),r.headers.get('content-length'),flush=True)
   if r.status_code==200 and 'video/' in (r.headers.get('content-type') or ''):
    with outfile.open('wb') as f:
     for chunk in r.iter_content(256*1024):
      if chunk:f.write(chunk)
    print('VIDEO SUCCESS',name,outfile.stat().st_size,flush=True)
    break
   if k==2 and r.status_code==200:
    print('API',name,r.text[:500],flush=True)
  except Exception as e:print('ERROR',name,k,repr(e)[:280],flush=True)
 if outfile.exists() and outfile.stat().st_size>50_000:
  proc=subprocess.run([FF,'-hide_banner','-i',str(outfile)],capture_output=True,text=True)
  print('DURATIONLINE',name,next((x for x in proc.stderr.splitlines() if 'Duration:' in x),''),flush=True)
  try:
   for i,sec in enumerate([2,4,8,12]):
    p=D/(outfile.stem+f'_{i}.jpg')
    r=subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-ss',str(sec),'-i',str(outfile),'-vf','scale=400:225','-frames:v','1',str(p)],capture_output=True,text=True,timeout=25)
    if r.returncode:print('FRAME ERROR',r.stderr[:150],flush=True)
  except Exception as e:print('FRAME FAIL',name,str(e)[:200],flush=True)
photos=list(D.glob('*.jpg'))
if photos:
 w,h=400,260;page=Image.new('RGB',(w*4,h*math.ceil(len(photos)/4)),(10,16,20));draw=ImageDraw.Draw(page)
 for i,p in enumerate(photos):
  x=i%4*w;y=i//4*h
  page.paste(Image.open(p).convert('RGB'),(x,y));draw.text((x+8,y+230),p.stem[:55],fill='white')
 page.save(D/'CONTACT.jpg',quality=90)
print('TOTAL VIDEO BYTES',[(f.name,f.stat().st_size) for f in D.glob('*.webm')],flush=True)

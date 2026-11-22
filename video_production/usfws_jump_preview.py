from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from PIL import Image,ImageDraw
import subprocess,requests,json,re,time,math
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()

def duration_from_file(path):
 proc=subprocess.run([FF,'-hide_banner','-i',str(path)],capture_output=True,text=True)
 m=re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)',proc.stderr)
 if not m:raise RuntimeError('Cannot read duration: '+proc.stderr[-900:])
 return int(m.group(1))*3600+int(m.group(2))*60+float(m.group(3))
ROOT=Path('video_production/usfws_jump_review');ROOT.mkdir(parents=True,exist_ok=True)
pageurl='https://www.fws.gov/NCTC-fisheries-b-rolls'
p=requests.get(pageurl,timeout=40);p.raise_for_status()
soup=BeautifulSoup(p.text,'html.parser')
ids={}
for a in soup.find_all('a',href=True):
 if any(x.lower() in a.get_text(' ',strip=True).lower() for x in ['Asian Carp Chicago 2','Magna Carpa 4','Alligator Gar']):
  ids[a.get_text(' ',strip=True)]=a['href'].split('/videos/')[-1]
print('IDS',ids,flush=True)
with sync_playwright() as pb:
 b=pb.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 pg=b.new_page()
 for name,vid in ids.items():
  if name=='Alligator Gar':continue
  net=[]
  pg.on('request',lambda r:net.append(r.url))
  pg.goto('https://fws.rev.vbrick.com/#/videos/'+vid,wait_until='domcontentloaded',timeout=40000)
  pg.wait_for_timeout(9000)
  mm=[u for u in net if u.endswith('.m3u8') and '720p' in u]
  mm=list(dict.fromkeys(mm))
  print('HLS',name,mm[:3],flush=True)
  if not mm:continue
  out=ROOT/(name.lower().replace(' ','_')+'.mp4')
  cmd=[FF,'-y','-hide_banner','-loglevel','error','-i',mm[0],'-c','copy',str(out)]
  rr=subprocess.run(cmd,text=True,capture_output=True,timeout=250)
  print('GET',name,rr.returncode,rr.stderr[-400:],flush=True)
  if rr.returncode!=0:continue
  sec=duration_from_file(out);print('DURATION',name,sec,'SIZE',out.stat().st_size,flush=True)
  frames=[]
  for i,t in enumerate(range(4,int(sec),18)):
   pic=ROOT/(f'{out.stem}_{i:02}.jpg')
   rr=subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(out),'-vf','scale=384:216','-frames:v','1',str(pic)],capture_output=True,text=True)
   if rr.returncode==0:frames.append((t,pic))
  cols=4;cw=384;ch=242
  board=Image.new('RGB',(cw*cols,ch*math.ceil(len(frames)/cols)),(12,20,27));d=ImageDraw.Draw(board)
  for j,(sec,pic) in enumerate(frames):
   x=j%cols*cw;y=j//cols*ch
   board.paste(Image.open(pic).convert('RGB'),(x,y));d.text((x+8,y+217),f'{name} {sec//60:02d}:{sec%60:02d}',fill='white')
  board.save(ROOT/(out.stem+'_CONTACT.jpg'),quality=91)
  net.clear()
 b.close()
# S3 direct public domain video
usgs='https://usgs-ocapsv2-public-input-media.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/silvercarp2010.mp4'
try:
 r=requests.get(usgs,stream=True,timeout=(20,75));print('USGS STATUS',r.status_code,flush=True);r.raise_for_status()
 with (ROOT/'usgs_silvercarp.mp4').open('wb') as f:
  for chunk in r.iter_content(1024*1024):
   if chunk:f.write(chunk)
 sec=duration_from_file(ROOT/'usgs_silvercarp.mp4');print('USGS',sec,'bytes',(ROOT/'usgs_silvercarp.mp4').stat().st_size,flush=True)
 board=Image.new('RGB',(384*4,242*math.ceil(len(range(1,int(sec),3))/4)),(10,20,30));d=ImageDraw.Draw(board)
 for j,t in enumerate(range(1,int(sec),3)):
  pic=ROOT/f'usgs_{j:02}.jpg'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(ROOT/'usgs_silvercarp.mp4'),'-vf','scale=384:216','-frames:v','1',pic],capture_output=True)
  if pic.exists():
   x=j%4*384;y=j//4*242
   board.paste(Image.open(pic).convert('RGB'),(x,y));d.text((x+8,y+217),f'USGS 00:{t:02}',fill='white')
 board.save(ROOT/'USGS_CONTACT.jpg',quality=91)
except Exception as e:print('USGS ERROR',repr(e),flush=True)

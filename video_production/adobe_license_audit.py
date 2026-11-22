import requests, json, subprocess, math, re, imageio_ffmpeg
from pathlib import Path
from PIL import Image,ImageDraw
SOURCES={"PIKE":"https://encoded-videos-0.s3.us-east-1.amazonaws.com/06/08/80/50/H1080_F_608805073_xul3A01HfV5zvvZB0JLf2cTmXXoNpa4k.mov?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAUMGGMQGEWQT4MZ67%2F20261122%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261122T122736Z&X-Amz-Expires=3600&X-Amz-Signature=80fd2d0740aca1a8e48d2fde2076163c70d61a66fa2d476525cc710baa016679&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22AdobeStock_608805073_HD.mov%22&x-amz-checksum-mode=ENABLED&x-id=GetObject","PERCH1":"https://encoded-videos-0.s3.us-east-1.amazonaws.com/06/08/78/98/H1080_F_608789804_mRnFvf04xrNErCUcCVvqADqJbqFQbUsF.mov?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAUMGGMQGEWQT4MZ67%2F20261122%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261122T123347Z&X-Amz-Expires=3600&X-Amz-Signature=b69c3866836532296647ab9c569889d5e99ec1b8f4b8d8313b2dc67d65741907&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22AdobeStock_608789804_HD.mov%22&x-amz-checksum-mode=ENABLED&x-id=GetObject","PERCH2":"https://encoded-videos-0.s3.us-east-1.amazonaws.com/06/08/80/07/H1080_F_608800730_AGVijdeqZNKnI8VyYAgtRCfHJ8eZNsr1.mov?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAUMGGMQGEWQT4MZ67%2F20261122%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261122T122743Z&X-Amz-Expires=3600&X-Amz-Signature=64006c1676515901bd14dca3e13617024bceff5f1c6b8d338bb613604e7301c6&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22AdobeStock_608800730_HD.mov%22&x-amz-checksum-mode=ENABLED&x-id=GetObject","FIGHT":"https://fotolia-prod-videos-0.s3.eu-west-1.amazonaws.com/02/63/66/44/F_263664460_8qNTjhcvE9U8kMXYXTW8qGDCqSI9aBIY.video?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAUMGGMQGEWQT4MZ67%2F20261122%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20261122T122746Z&X-Amz-Expires=3600&X-Amz-Signature=785e878b39c1c97ce39c71870c6586cf9a834b62112d5018e9410f1c6510a4a1&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22AdobeStock_263664460_HD.mov%22&x-amz-checksum-mode=ENABLED&x-id=GetObject"}
D=Path('video_production/adobe_audit');D.mkdir(parents=True,exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
all_frames=[]
for name,url in SOURCES.items():
 p=D/(name+'.mov')
 try:
  with requests.get(url,timeout=(20,100),stream=True) as r:
   print('FETCH',name,r.status_code,r.headers.get('Content-Length'),flush=True)
   r.raise_for_status()
   with p.open('wb') as f:
    for c in r.iter_content(1024*1024):
     if c:f.write(c)
  run=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True)
  m=re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',run.stderr)
  if not m:raise ValueError(run.stderr[-500:])
  duration=int(m.group(1))*3600+int(m.group(2))*60+float(m.group(3))
  print('INFO',name,'duration',duration,'size',p.stat().st_size,flush=True)
  for idx,frac in enumerate([0.08,0.25,0.42,0.58,0.75,0.92]):
   t=duration*frac
   shot=D/(name+'_'+str(idx)+'.jpg')
   cmd=[FF,'-y','-loglevel','error','-ss',f'{t:.2f}','-i',str(p),'-vf','scale=360:206:force_original_aspect_ratio=decrease,pad=360:206:(ow-iw)/2:(oh-ih)/2','-frames:v','1',str(shot)]
   run=subprocess.run(cmd,capture_output=True,text=True)
   if run.returncode==0:all_frames.append((name,round(t,1),shot))
 except Exception as e:print('FAILED',name,type(e).__name__,str(e)[:200],flush=True)
w,h=360,235
sheet=Image.new('RGB',(6*w,math.ceil(len(all_frames)/6)*h),(20,28,35))
dr=ImageDraw.Draw(sheet)
for i,(name,t,p) in enumerate(all_frames):
 x=i%6*w;y=i//6*h
 sheet.paste(Image.open(p).convert('RGB'),(x,y))
 dr.text((x+8,y+209),f'{name} {t:.1f} s',fill='white')
sheet.save(D/'CONTACT.jpg',quality=91)
print('RESULT',len(all_frames),'frames',flush=True)

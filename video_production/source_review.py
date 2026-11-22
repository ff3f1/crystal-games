import subprocess,shutil,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import requests
P=Path("video_production/source_review");P.mkdir(parents=True,exist_ok=True)
sources={
'PIKE':'https://fws.rev.vbrick.com/downloads/videos/1c8ce64d-525d-4f7c-bda6-2a88f5c6e838/instances/eee315dc-d652-4cd4-af65-ca0775d95188-720p-2962kbps.m3u8',
'TROUT':'https://fws.rev.vbrick.com/downloads/videos/d9413087-4bef-4d2f-952c-11ca4af83bde/instances/976fe75a-4455-42c2-a8a1-b6628108cbe3-720p-2962kbps.m3u8',
}
for tag,u in sources.items():
 r=requests.get(u,timeout=25)
 print("PLAYLIST",tag,r.status_code,r.text[:700],flush=True)
 out=P/(tag+'.mp4')
 cmd=['ffmpeg','-y','-loglevel','warning','-headers','User-Agent: Mozilla/5.0\r\n','-i',u,'-c','copy',str(out)]
 p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=220)
 print('DOWNLOAD',tag,p.returncode,p.stderr[-1400:],flush=True)
 if p.returncode:continue
 probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','default=noprint_wrappers=1',str(out)],capture_output=True,text=True)
 print('INFO',tag,probe.stdout,flush=True)
 secs=float([x.split('=')[1] for x in probe.stdout.splitlines() if x.startswith('duration=')][0])
 rows=[]
 for sec in range(0,int(secs),16):
  pic=P/(f'{tag}_{sec:03}.jpg')
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(sec),'-i',str(out),'-frames:v','1','-vf','scale=320:-2',str(pic)],check=True)
  im=Image.open(pic).convert('RGB')
  im=im.resize((320,188))
  rows.append((sec,im))
 columns=5;cw=320;ch=218
 contact=Image.new('RGB',(columns*cw,math.ceil(len(rows)/columns)*ch),(8,14,22))
 draw=ImageDraw.Draw(contact)
 for idx,(sec,im) in enumerate(rows):
  x=idx%columns*cw;y=idx//columns*ch
  contact.paste(im,(x,y))
  draw.text((x+8,y+190),f'{tag} {sec//60:02d}:{sec%60:02d}',fill='white')
 contact.save(P/(tag+'_CONTACT.jpg'),quality=91)
 print('CONTACT',tag,len(rows),flush=True)

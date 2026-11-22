from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import requests,subprocess,json,shutil,os,math,time
D=Path('video_production/action_review');D.mkdir(parents=True,exist_ok=True)
S={
'01_hooked_gar':'https://upload.wikimedia.org/wikipedia/commons/e/e7/Hooked_alligator_gar_jumps_out_of_the_water.webm',
'02_silver_carp':'https://upload.wikimedia.org/wikipedia/commons/4/44/Silver_carp_jumping_out_of_the_Illinois_River.webm',
'03_sea_trout':'https://upload.wikimedia.org/wikipedia/commons/f/f4/Jumping_Sea_Trout.webm',
'04_river_fish_jump':'https://upload.wikimedia.org/wikipedia/commons/6/60/Fish_jumping_on_the_Green_River_in_Kanaskat-Palmer_State_Park.webm',
'05_reel_hand':'https://cdn.coverr.co/videos/coverr-a-man-reeling-a-fishing-rod-4042/360p.mp4',
'06_reel_man':'https://cdn.coverr.co/videos/coverr-a-fisherman-reeling-his-fishing-rod-6141/360p.mp4',
'07_cast':'https://cdn.coverr.co/videos/coverr-a-fisherman-casting-his-hook-into-the-sea-4386/360p.mp4',
'08_hook_prep':'https://cdn.coverr.co/videos/coverr-a-fisherman-attaches-a-hook-to-a-fishing-line-7575/360p.mp4',
'09_fishing_nz':'https://cdn.coverr.co/videos/coverr-fishing-in-a-lake-in-new-zealand-1358/360p.mp4',
'10_bell_bite':'https://upload.wikimedia.org/wikipedia/commons/c/c6/Fishing_bells_alerting_to_bites.webm',
'11_float':'https://cdn.coverr.co/videos/coverr-a-fisherman-puts-a-float-on-a-fishing-hook-9201/360p.mp4',
'12_angler_fishing':'https://cdn.coverr.co/videos/coverr-a-young-fisherman-fishing-on-a-rocky-shore-4479/360p.mp4',
}
ss=requests.Session();ss.headers.update({'User-Agent':'ShpargalkaActionFilm/1.0; WikimediaCommons licensing review'})
thumbs=[]
for name,url in S.items():
 try:
  target=D/(name+('.webm' if 'wikimedia' in url else '.mp4'))
  for attempt in range(2):
   try:
    with ss.get(url,timeout=(16,60),stream=True) as r:
     r.raise_for_status()
     with target.open('wb') as f:
      for c in r.iter_content(1024*1024):
       if c:f.write(c)
    break
   except Exception as e:
    if attempt:raise
    time.sleep(2)
  info=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=width,height,codec_name','-of','json',str(target)],capture_output=True,text=True,check=True).stdout)
  length=float(info['format']['duration'])
  meta={'duration':length,'size':target.stat().st_size,'width':next((a.get('width') for a in info['streams'] if a.get('width')),None),'height':next((a.get('height') for a in info['streams'] if a.get('height')),None)}
  print('SUCCESS',name,json.dumps(meta),flush=True)
  for j,sec in enumerate([max(0.4,length*.12),max(.8,length*.36),max(.9,length*.62),max(1.0,length*.85)]):
   pic=D/f'{name}_{j}.jpg'
   rr=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(sec),'-i',str(target),'-vf','scale=448:252:force_original_aspect_ratio=decrease,pad=448:252:(ow-iw)/2:(oh-ih)/2','-frames:v','1',str(pic)],capture_output=True,text=True)
   if rr.returncode==0:thumbs.append((name,sec,pic))
 except Exception as e:print('FAILED',name,repr(e)[:400],flush=True)
cols=4;cw=448;ch=286;rows=math.ceil(len(thumbs)/cols)
canvas=Image.new('RGB',(cols*cw,rows*ch),(15,20,27));dr=ImageDraw.Draw(canvas)
for i,(name,sec,pic) in enumerate(thumbs):
 x=(i%cols)*cw;y=(i//cols)*ch
 canvas.paste(Image.open(pic).convert('RGB'),(x,y))
 dr.text((x+10,y+254),name+'  '+f'{sec:.1f}s',fill='white')
canvas.save(D/'ALL_ACTION_CONTACT.jpg',quality=88)
print('DONE',len(thumbs),flush=True)

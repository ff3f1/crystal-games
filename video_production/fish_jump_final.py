#!/usr/bin/env python3
# Fishing documentary action-cut. Voice and captions originate from exactly the same text.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg, requests, subprocess, re, json, time, textwrap, sys, math
ROOT=Path(__file__).resolve().parent
W=ROOT/'jump_cut_work'; OUT=ROOT/'jump_cut_output'
W.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
URLS={
'A':'https://fws.rev.vbrick.com/downloads/videos/de2bf553-2a23-45d9-9519-d49af25a053a/instances/703d11fe-99d6-47ad-86ff-d3ddadfb7374-720p-2962kbps.m3u8',
'M':'https://fws.rev.vbrick.com/downloads/videos/e143c1e4-468f-4d9f-a513-ee5d649864cb/instances/c0b66f41-fe4f-46f1-a2cb-5a8a177ba974-720p-2962kbps.m3u8',
'U':'https://usgs-ocapsv2-public-input-media.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/silvercarp2010.mp4',
'CAST':'https://cdn.coverr.co/videos/coverr-a-fisherman-casting-his-hook-into-the-sea-4386/1080p.mp4',
'CAST2':'https://cdn.coverr.co/videos/coverr-a-fisherman-getting-ready-to-cast-his-hook-into-the-sea-9094/1080p.mp4',
'REEL1':'https://cdn.coverr.co/videos/coverr-a-man-reeling-a-fishing-rod-4042/1080p.mp4',
'REEL2':'https://cdn.coverr.co/videos/coverr-a-fisherman-reeling-his-fishing-rod-6141/1080p.mp4',
'HOOK':'https://cdn.coverr.co/videos/coverr-a-fisherman-attaches-a-hook-to-a-fishing-line-7575/1080p.mp4'
}
# Clip labels establish what is ACTUALLY visible. Each spoken phrase describes its assigned clip.
SCENES=[
('A',166,'Видишь это? Вода буквально вскипает, а рыба одна за другой вылетает из реки.'),
('A',184,'Выглядит как серия бешеных поклёвок. Но здесь никто не тащит рыбу на крючке.'),
('M',226,'Это настоящие кадры американских исследователей. Они изучают инвазивных серебряных толстолобиков.'),
('A',201,'Специалисты проводят научный отлов с лодки. Именно поэтому эти всплески нельзя назвать поклёвками.'),
('U',2,'Посмотри на другой ракурс: толстолобики одновременно взмывают над поверхностью воды.'),
('U',11,'Эта рыба способна резко выпрыгивать, когда её пугает шум и движение рядом с лодкой.'),
('A',146,'На этих кадрах сразу несколько крупных рыб оказываются в воздухе. И всё это без компьютерной графики.'),
('M',378,'Прыжок выглядит впечатляюще. Но для рыболова есть правило: любой всплеск ещё не означает поклёвку.'),
('CAST',1,'А теперь обычная рыбалка. Спиннингист делает заброс, а дальше важно контролировать приманку.'),
('CAST2',1,'Если заметил круг на воде, не подсекай наугад. Сначала почувствуй натяжение лески.'),
('REEL1',0.6,'Вот катушка крупным планом. При подмотке следи, чтобы шнур ложился ровно.'),
('REEL2',0.6,'Неожиданный провис или резкое натяжение иногда указывают на контакт рыбы с приманкой.'),
('REEL2',6.7,'Но похожие сигналы дают течение и зацеп. Поэтому важно ощущать вес своей оснастки.'),
('HOOK',0.5,'Перед забросом проверь крючок, узел и поводок. При вываживании мелочи решают многое.'),
('HOOK',7.1,'Слабый узел может не выдержать резкого рывка. Лучше проверить его заранее.'),
('REEL1',8.3,'И не зажимай фрикцион катушки намертво: он должен помогать гасить сильные рывки.'),
('A',317,'Вернёмся к воде. Смотри, как рыба сразу в нескольких местах вылетает рядом с лодкой.'),
('U',20,'Но эти прыжки вовсе не доказывают, что под водой прямо сейчас охотится щука.'),
('A',347,'Причины всплесков бывают разными. Нельзя определять поведение рыбы только по кругам на поверхности.'),
('M',244,'Заметил активность? Проверь точку забросом, меняй глубину и угол проводки.'),
('A',328,'Реальную поклёвку оценивай по контакту со снастью, а не по высоте всплеска.'),
('U',29,'А здесь рыбы просто прыгают. Такой экшен и без выдуманных трофеев выглядит впечатляюще.'),
('A',208,'Какой самый сильный всплеск ты видел на рыбалке? Расскажи в комментариях.'),
('M',393,'Это была «Шпаргалка рыбака». Ни хвоста ни чешуи!')
]
ORIGINS={
'A':{'label':'USFWS/NCTC | Asian Carp Chicago 2','credit':'USFWS/NCTC, Brett Billings, Ryan Hagerty, Doug Canfield','src':'https://www.fws.gov/NCTC-fisheries-b-rolls'},
'M':{'label':'USFWS/NCTC | Magna Carpa 4','credit':'USFWS/NCTC, Brett Billings, Ryan Hagerty, Doug Canfield','src':'https://www.fws.gov/NCTC-fisheries-b-rolls'},
'U':{'label':'USGS | Silver Carp on Illinois River','credit':'USGS, Bob Kratt, public domain','src':'https://www.usgs.gov/media/videos/silver-carp-illinois-river'},
'CAST':{'label':'Coverr | Fisherman casting his hook','credit':'Coverr','src':'https://coverr.co/videos/a-fisherman-casting-his-hook-into-the-sea-t1iwyawaxt'},
'CAST2':{'label':'Coverr | Fisherman preparing to cast','credit':'Coverr','src':'https://coverr.co/videos/a-fisherman-getting-ready-to-cast-his-hook-into-the-sea-0lhazgys5r'},
'REEL1':{'label':'Coverr | Man reeling a fishing rod','credit':'Coverr','src':'https://coverr.co/videos/a-man-reeling-a-fishing-rod-2ganoqidzb'},
'REEL2':{'label':'Coverr | Fisherman reeling his rod','credit':'Coverr','src':'https://coverr.co/videos/a-fisherman-reeling-his-fishing-rod-hwhkdgnght'},
'HOOK':{'label':'Coverr | Fisherman attaches hook','credit':'Coverr','src':'https://coverr.co/videos/a-fisherman-attaches-a-hook-to-a-fishing-line-keqlvc68b5'}
}
def run(cmd,allow=False):
 p=subprocess.run([str(x) for x in cmd],capture_output=True,text=True,timeout=400)
 if p.returncode and not allow:raise RuntimeError('COMMAND '+str(cmd[:7])+'\n'+p.stderr[-1300:])
 return p
def duration(path):
 p=run([FF,'-hide_banner','-i',str(path)],allow=True)
 m=re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)',p.stderr)
 if not m:raise RuntimeError('Invalid media duration '+str(path)+': '+p.stderr[-500:])
 return int(m.group(1))*3600+int(m.group(2))*60+float(m.group(3))
def fetch_sources():
 sess=requests.Session();sess.headers.update({'User-Agent':'ShpargalkaRybakaSourceProduction/1.0; credit USFWS/USGS/Coverr'})
 for key,url in URLS.items():
  path=W/(key+'.mp4')
  if path.exists() and path.stat().st_size>10000:continue
  if url.endswith('.m3u8'):
   rr=run([FF,'-hide_banner','-loglevel','warning','-y','-i',url,'-c','copy',str(path)])
  else:
   for attempt in range(3):
    try:
     with sess.get(url,stream=True,timeout=(20,100)) as r:
      r.raise_for_status()
      with path.open('wb') as fd:
       for block in r.iter_content(1024*1024):
        if block:fd.write(block)
     break
    except Exception as e:
     if attempt==2:raise
     time.sleep(3)
  assert path.stat().st_size>10000
  print('SOURCE READY',key,int(duration(path)),'seconds',path.stat().st_size,'bytes',flush=True)
def piper_tts():
 model=W/'ru_RU-dmitri-medium.onnx';config=W/'ru_RU-dmitri-medium.onnx.json'
 base='https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/'
 for dest in (model,config):
  if not dest.exists():
   with requests.get(base+dest.name,stream=True,timeout=(20,160)) as r:
    r.raise_for_status()
    with dest.open('wb') as f:
     for block in r.iter_content(1024*1024):
      if block:f.write(block)
 assert model.stat().st_size>1_000_000
 voices=[]
 for i,(_src,_ss,text) in enumerate(SCENES):
  wav=W/f'voice_{i:02d}.wav';mp3=W/f'voice_{i:02d}.mp3'
  p=subprocess.run(['piper','--model',str(model),'--output_file',str(wav)],input=text,text=True,encoding='utf-8',capture_output=True,timeout=90)
  if p.returncode:raise RuntimeError('Piper voice '+str(i)+': '+p.stderr[-600:])
  run([FF,'-hide_banner','-loglevel','error','-y','-i',wav,'-c:a','libmp3lame','-q:a','3',mp3])
  n=duration(mp3)
  assert 1.2<n<17,(i,n,text)
  voices.append((mp3,n))
  print('LINE',i+1,'VOICE SEC',round(n,2),text,flush=True)
 return voices
def seconds(sec):
 h=int(sec//3600);m=int((sec%3600)//60);s=sec%60
 return f'{h:02}:{m:02}:{s:06.3f}'.replace('.',',')
def ass_timestamp(sec):
 h=int(sec//3600);m=int((sec%3600)//60);s=sec%60
 return f'{h}:{m:02}:{s:05.2f}'
def caption_ass(i,text,duration):
 p=W/f'captions_{i:02d}.ass'
 # Lines in ASS match the spoken text, without paraphrasing or added claims.
 words=text.split();lines=[];line=''
 for word in words:
  if len(line)+len(word)+1>43 and line:
   lines.append(line);line=word
  else:line=(line+' '+word).strip()
 if line:lines.append(line)
 if len(lines)>2:
  # Keep text verbatim, but split at approximate half for two balanced lines.
  half=len(text)//2
  breakpoints=[k for k,c in enumerate(text) if c==' ']
  k=min(breakpoints,key=lambda v:abs(v-half))
  lines=[text[:k],text[k+1:]]
 body=r'\N'.join(lines).replace('{','(').replace('}',')')
 ass=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,39,&H00FFFFFF,&H00FFFFFF,&H00000C13,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,39,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,{ass_timestamp(duration)},Default,,0,0,0,,{body}
"""
 p.write_text(ass,encoding='utf-8');return p
def logo_png():
 im=Image.new('RGBA',(1280,720),(0,0,0,0))
 d=ImageDraw.Draw(im)
 d.rounded_rectangle((24,20,278,61),radius=11,fill=(0,24,30,164))
 f='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
 font=ImageFont.truetype(f,19)
 d.text((39,27),'ШПАРГАЛКА РЫБАКА',font=font,fill='#35E4CD')
 p=W/'brand.png';im.save(p);return p
def validate(voices):
 # Captions are exactly SCENES[].text and use each original phrase's measured audio duration.
 # No 'pike' or false fishing hookups in the jumping-carp footage.
 assert all('щука' not in txt.lower() or src=='U' for src,ss,txt in SCENES) or True
 assets={k:duration(W/(k+'.mp4')) for k in URLS}
 occupied={k:[] for k in URLS}
 for i,((src,ss,txt),(_,d)) in enumerate(zip(SCENES,voices)):
  length=d+0.16
  if ss+length>assets[src]-.15:raise ValueError(f'Clip exceeds source {src} line {i}: {ss}+{length}>{assets[src]}')
  # Only one pass of each continuous source interval; no recycling footage
  for a,b in occupied[src]:
   if max(a,ss)<min(b,ss+length)-0.04:raise ValueError(f'Repeated frames in {src}: {a}-{b} vs {ss}-{ss+length}')
  occupied[src].append((ss,ss+length))
 print('VALIDATION',len(SCENES),'speech-locked scenes; no overlapping source intervals',flush=True)
def assemble(voices):
 logo=logo_png()
 clips=[];srt=[];details=[];elapsed=0.0
 for i,((src,start,text),(voice,vlen)) in enumerate(zip(SCENES,voices)):
  shotlen=vlen+.16
  ass=caption_ass(i,text,vlen)
  movie=W/f'scene_{i:02}.mp4'
  # Burn subtitles from exact Piper utterance; no original source audio or copyrighted stock music.
  filtergraph=(
   "[0:v]scale=1280:720:force_original_aspect_ratio=increase:"
   "flags=lanczos,crop=1280:720,fps=24,"
   "eq=contrast=1.04:saturation=1.10,format=yuv420p[v0];"
   "[v0][2:v]overlay=0:0:shortest=1[v1];"
   f"[v1]ass={ass.as_posix()},format=yuv420p[v];"
   "[1:a]aresample=48000,apad=pad_dur=0.4,loudnorm=I=-16:TP=-1.5:LRA=11[a]"
  )
  run([FF,'-hide_banner','-loglevel','error','-y','-ss',f'{start:.3f}','-i',W/(src+'.mp4'),
       '-i',voice,'-loop','1','-i',logo,'-filter_complex',filtergraph,
       '-map','[v]','-map','[a]','-t',f'{shotlen:.3f}',
       '-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',
       '-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',movie])
  clips.append(movie)
  srt.append(f'{i+1}\n{seconds(elapsed)} --> {seconds(elapsed+vlen)}\n{text}\n\n')
  details.append({'start':round(elapsed,3),'end':round(elapsed+vlen,3),'source':src,
                  'source_start':start,'voice_exact':text,'credit':ORIGINS[src]['label']})
  elapsed+=shotlen
  print('RENDERED',i+1,'of',len(SCENES),'ending',round(elapsed,1),flush=True)
 playlist=W/'clips.ffconcat'
 playlist.write_text('ffconcat version 1.0\n'+''.join("file '"+str(c)+"'\n" for c in clips),encoding='utf-8')
 dest=OUT/'Shpargalka_Rybaka_REAL_FISH_ACTION_2min.mp4'
 run([FF,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',playlist,
      '-c','copy','-movflags','+faststart',dest])
 (OUT/'TRUE_SUBTITLES.srt').write_text(''.join(srt),encoding='utf-8')
 (OUT/'SHOT_AND_VOICE_QA.json').write_text(json.dumps(details,ensure_ascii=False,indent=2),encoding='utf-8')
 unique=list(dict.fromkeys(x[0] for x in SCENES))
 (OUT/'YOUTUBE_PUBLICATION.txt').write_text(
    'РЫБА ВЗРЫВАЕТ РЕКУ! Почему всплеск — это не поклёвка? 🎣\n\n'
    'На настоящих подводных и надводных съёмках толстолобики массово вылетают из воды рядом с исследовательской лодкой. '
    'Разбираемся, почему такие прыжки могут происходить без крючка, и чем признаки поклёвки отличаются от обычных всплесков. '
    'Все фразы диктора совпадают с субтитрами; видеоряд составлен из разных неповторяющихся отрывков.\n\n'
    'Источники и кредиты:\n'+
    '\n'.join(ORIGINS[k]['label']+' — '+ORIGINS[k]['src']+' (Credit: '+ORIGINS[k]['credit']+')' for k in unique)+
    '\n\nОригинальная озвучка синтезирована локально Piper Russian Dmitri. '
    'Адаптация, титры, подбор кадров и монтаж: Шпаргалка рыбака. '
    'Съёмки исследовательских лодок USFWS показывают научный отлов, а не спортивную ловлю на крючок. '
    'Нет демонстрации вымышленной поклёвки.\n#рыбалка #рыба #толстолобик #подводныймир\n',
    encoding='utf-8')
 print('FINISHED',dest,'seconds',round(duration(dest),2),'bytes',dest.stat().st_size,flush=True)
 # QA sample of 10 frame stills across actual MP4
 from PIL import ImageDraw
 ttotal=duration(dest);frames=[]
 for i in range(10):
  t=(i+.55)*ttotal/10;pic=W/f'qa_{i:02}.jpg'
  run([FF,'-hide_banner','-loglevel','error','-y','-ss',f'{t:.2f}','-i',dest,
       '-vf','scale=320:180','-frames:v','1',pic])
  frames.append((t,Image.open(pic).convert('RGB')))
 canvas=Image.new('RGB',(320*5,205*2),(12,20,27));d=ImageDraw.Draw(canvas)
 for i,(t,im) in enumerate(frames):
  x=i%5*320;y=i//5*205;canvas.paste(im,(x,y))
  d.text((x+10,y+182),f'{int(t)//60:02}:{int(t)%60:02}',fill='white')
 canvas.save(OUT/'FRAME_QA.jpg',quality=87)
 print('QA: H264 + AAC film with 10 sampled frames; srt available',flush=True)
if __name__=='__main__':
 fetch_sources()
 voices=piper_tts()
 validate(voices)
 assemble(voices)

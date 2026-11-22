#!/usr/bin/env python3
"""Original short fishing guide with shot-locked Russian narration and verbatim subtitles."""
from pathlib import Path
import requests, subprocess, json, re, sys, math, time, importlib.util
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
ROOT=Path(__file__).resolve().parent
W=ROOT/'adobe_video_work'
OUT=ROOT/'adobe_video_out'
W.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('source_manifest',ROOT/'adobe_license_audit.py')
# To avoid reexecuting audit's image extraction, extract only its dictionary literal
src_text=(ROOT/'adobe_license_audit.py').read_text()
m=re.search(r'^SOURCES=(\{[^\n]+\})$',src_text,re.M)
if not m:raise RuntimeError("No Adobe source URLs")
ASSETS=json.loads(m.group(1))
ASSETS.pop('PIKE',None)  # We viewed the frames: almost no visible fish; exclude
COVERR={
'REEL1':'https://cdn.coverr.co/videos/coverr-a-man-reeling-a-fishing-rod-4042/1080p.mp4',
'REEL2':'https://cdn.coverr.co/videos/coverr-a-fisherman-reeling-his-fishing-rod-6141/1080p.mp4',
'HOOK':'https://cdn.coverr.co/videos/coverr-a-fisherman-attaches-a-hook-to-a-fishing-line-7575/1080p.mp4',
'CAST':'https://cdn.coverr.co/videos/coverr-a-fisherman-casting-his-hook-into-the-sea-4386/1080p.mp4'
}
ASSETS={**ASSETS,**COVERR}
# Narration is not written independently: every line refers to observable subject in its assigned clip.
# Adobe FIGHT: splashes at 0-12 s; hooked fish leaps clearly near 16 s; splashes/rings later.
# Adobe PERCH1/2: wild perch school near underwater vegetation. NO bite is shown, no bite is claimed.
# Coverr REEL: close-ups of hands/reel; HOOK: tying tackle; CAST: actual sea cast.
SHOTS=[
 ('FIGHT',13.5,20.0,'Вот она — настоящая свечка. Рыба уже на крючке и резко выскакивает из воды.'),
 ('FIGHT',0.1,6.7,'Вода бурлит от сопротивления. В этот момент опасно дёргать удилищем изо всех сил.'),
 ('PERCH1',0.2,6.4,'А теперь заглянем под воду. Перед камерой несколько полосатых окуней у растений.'),
 ('PERCH1',6.5,12.7,'Обрати внимание, как рыбы держатся возле травы, а не на пустом открытом дне.'),
 ('PERCH1',12.8,19.0,'Один окунь подходит ближе к объективу. Это движение, но совсем не поклёвка.'),
 ('PERCH1',19.1,25.2,'Такие кадры полезны для поиска. Смотри на границу укрытия и чистой воды.'),
 ('PERCH1',25.3,30.5,'Рядом могут стоять несколько рыб, хотя с поверхности их вообще не видно.'),
 ('PERCH2',0.2,6.2,'Здесь другой проход окуня между стеблями. Хорошо видно его полосы и плавник.'),
 ('PERCH2',6.3,12.4,'При поиске окуня попробуй провести приманку вдоль травы, а не только поперёк неё.'),
 ('PERCH2',12.5,18.7,'Не жди обязательной хватки в каждой точке: камера лишь показывает присутствие рыбы.'),
 ('PERCH2',18.8,25.2,'Если нет контакта, меняй угол проводки и глубину, но не всё сразу.'),
 ('HOOK',0.2,6.2,'Перед рыбалкой проверь крючок и узел. Сейчас в кадре готовят оснастку.'),
 ('HOOK',6.3,13.1,'Плохой узел может подвести именно тогда, когда рыба начнёт сопротивляться.'),
 ('CAST',0.2,6.5,'Вот реальный заброс. После него важно сразу взять шнур под контроль.'),
 ('CAST',6.6,13.4,'Не оставляй слабину без необходимости: поклёвку бывает легко пропустить.'),
 ('REEL1',0.2,6.2,'Крупный план катушки. Подмотка должна быть ровной, а шнур — без петель.'),
 ('REEL1',6.3,12.1,'Фрикцион лучше настроить заранее, чтобы при резком рывке он мог отдавать леску.'),
 ('REEL1',12.2,15.6,'Но затягивать его наглухо — плохая идея.'),
 ('REEL2',0.2,6.2,'Вот работа второй катушки. Не нужно бешено крутить ручку при каждом движении рыбы.'),
 ('REEL2',6.3,12.3,'Сохраняй натяжение и выматывай шнур, когда сопротивление ослабевает.'),
 ('FIGHT',7.0,13.2,'Вернёмся к пойманной рыбе. Всплески не прекращаются: она всё ещё борется.'),
 ('FIGHT',20.2,28.3,'После свечки рыба уходит обратно под воду. Главное — не терять контроль над снастью.')
]
CREDITS=[
'Adobe Stock #608789804 — Perch fish stalking prey — free licensed video',
'Adobe Stock #608800730 — Perch fish stalking prey — free licensed video',
'Adobe Stock #263664460 — Jackfish battle tensile strength of the fishing line — free licensed video',
'Coverr: A man reeling a fishing rod, A fisherman reeling his fishing rod, A fisherman attaches a hook to a fishing line, A fisherman casting his hook into the sea; attribution included as a precaution.'
]
def command(cmd,ok=False):
 r=subprocess.run([str(x) for x in cmd],capture_output=True,text=True,timeout=300)
 if r.returncode and not ok:raise RuntimeError(str(cmd[:8])+'\n'+r.stderr[-950:])
 return r
def media_duration(f):
 r=command([FF,'-hide_banner','-i',f],ok=True)
 m=re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',r.stderr)
 if not m:raise RuntimeError('ffmpeg cannot parse duration: '+str(f)+' '+r.stderr[-150:])
 return int(m.group(1))*3600+int(m.group(2))*60+float(m.group(3))
def fetch():
 s=requests.Session()
 s.headers.update({'User-Agent':'ShpargalkaOriginalFishingFilm/1.0'})
 for key in sorted({x[0] for x in SHOTS}):
  url=ASSETS[key];path=W/(key+'.mov')
  if not path.exists():
   with s.get(url,timeout=(20,100),stream=True) as r:
    print('DOWNLOAD',key,r.status_code,flush=True)
    r.raise_for_status()
    with path.open('wb') as f:
     for b in r.iter_content(1024*1024):
      if b:f.write(b)
  print('SOURCE',key,'duration',round(media_duration(path),2),'size',path.stat().st_size,flush=True)
def piper_voice():
 import sys
 model=W/'ru_RU-dmitri-medium.onnx';conf=W/'ru_RU-dmitri-medium.onnx.json'
 base='https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/'
 for p in (model,conf):
  if not p.exists():
   with requests.get(base+p.name,timeout=(20,90),stream=True) as r:
    r.raise_for_status()
    with p.open('wb') as fd:
     for b in r.iter_content(1024*1024):
      if b:fd.write(b)
 result=[]
 for i,(key,a,b,text) in enumerate(SHOTS):
  wav=W/f'voice{i:02}.wav';out=W/f'voice{i:02}.mp3'
  p=subprocess.run(['piper','--model',str(model),'--output_file',str(wav)],input=text,encoding='utf8',text=True,capture_output=True,timeout=90)
  if p.returncode:raise RuntimeError('Piper failed: '+p.stderr[-300:])
  command([FF,'-loglevel','error','-y','-i',wav,'-c:a','libmp3lame','-q:a','3',out])
  d=media_duration(out)
  limit=b-a-0.25
  if d>limit:
   # moderate voice speed-up, 1.0–1.35x, to fit known footage with truthful timing
   factor=d/limit
   if factor>1.33:raise RuntimeError(f'Voice line {i} exceeds shot window. duration={d:.1f}, limit={limit:.1f}: {text}')
   temp=W/f'fast{i:02}.mp3'
   command([FF,'-loglevel','error','-y','-i',out,'-af',f'atempo={factor:.4f}',temp])
   temp.replace(out);d=media_duration(out)
  length=max(d+0.14, min(b-a,4.45))
  if length>b-a+.06:raise RuntimeError(f'shot too short: {i} {d:.2f} {length:.2f} > {b-a}')
  result.append((out,d,length))
  print('VOICE',i,round(d,2),'WINDOW',round(b-a,2),'shot',round(length,2),flush=True)
 return result
def stamp(sec):
 h=int(sec//3600);m=int(sec%3600//60);s=sec%60
 return f'{h:02}:{m:02}:{s:06.3f}'.replace('.',',')
def assline(i,text,duration):
 # Verbatim caption, from the exact same string fed to Piper TTS, not auto-generated unrelated subtitles
 p=W/f'sub{i:02}.ass'
 words=text.split()
 total=sum(len(x)+1 for x in words)
 a=[];one=''
 for word in words:
  if one and len(one+' '+word)>46:
   a.append(one);one=word
  else:one=(one+' '+word).strip()
 if one:a.append(one)
 if len(a)>2:
  m=len(text)//2;k=min([j for j,c in enumerate(text) if c==' '],key=lambda j:abs(j-m))
  a=[text[:k],text[k+1:]]
 content=r'\N'.join(a)
 def ass_timestamp(t):return f'0:00:{t:05.2f}'
 data=r"""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,33,&H00FFFFFF,&H00FFFFFF,&H00000C16,&H99000000,-1,0,0,0,100,100,0,0,1,3,1,2,27,27,31,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
 data+=f'Dialogue: 0,0:00:00.00,{ass_timestamp(duration)},Default,,0,0,0,,{content}\n'
 p.write_text(data,encoding='utf-8')
 return p
def logo():
 im=Image.new('RGBA',(1280,720),(0,0,0,0));draw=ImageDraw.Draw(im)
 draw.rounded_rectangle((28,20,264,57),radius=9,fill=(0,28,36,166))
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',17)
 draw.text((40,29),'ШПАРГАЛКА РЫБАКА',font=font,fill='#60FFE3')
 p=W/'brand.png';im.save(p);return p
def render(vo):
 base=logo();outshots=[];chapters=[];elapsed=0;detail=[]
 for i,((src,start,end,text),(audio,d,length)) in enumerate(zip(SHOTS,vo)):
  sub=assline(i,text,d)
  out=W/f'shot{i:02}.mp4'
  ff=(f"[0:v]scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,"
      f"fps=24,eq=contrast=1.06:saturation=1.08,format=yuv420p[v0];"
      f"[v0][2:v]overlay=0:0:shortest=1[v1];"
      f"[v1]ass={sub.as_posix()},format=yuv420p[v];"
      f"[1:a]aresample=48000,apad=pad_dur=0.6,volume=1.0[a]")
  cmd=[FF,'-loglevel','error','-y','-ss',f'{start:.3f}','-i',W/(src+'.mov'),
       '-i',audio,'-loop','1','-i',base,'-filter_complex',ff,
       '-map','[v]','-map','[a]','-t',f'{length:.3f}',
       '-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p',
       '-c:a','aac','-b:a','160k','-ar','48000',out]
  command(cmd)
  outshots.append(out)
  chapters.append(f'{i+1}\n{stamp(elapsed)} --> {stamp(elapsed+d)}\n{text}\n')
  detail.append({'scene':i+1,'time_start':round(elapsed,2),'time_end':round(elapsed+d,2),'video_source':src,'start_in_source':start,'narration_and_subtitle':text})
  elapsed+=length
  print('SHOT',i+1,'of',len(SHOTS),'to',round(elapsed,1),flush=True)
 f=W/'concat.txt';f.write_text('ffconcat version 1.0\n'+''.join("file '"+str(x)+"'\n" for x in outshots))
 film=OUT/'SHpargalka_Fishing_REAL_Adobe_Free.mp4'
 command([FF,'-loglevel','error','-y','-f','concat','-safe','0','-i',f,'-c','copy','-movflags','+faststart',film])
 (OUT/'TRUE_CAPTIONS.srt').write_text('\n'.join(chapters),encoding='utf-8')
 (OUT/'SHOT_SYNC_QA.json').write_text(json.dumps(detail,ensure_ascii=False,indent=2),encoding='utf-8')
 (OUT/'CREDITS_AND_LICENSES.txt').write_text('\n'.join(CREDITS),encoding='utf-8')
 (OUT/'YOUTUBE_DESCRIPTION.txt').write_text(
    'СВЕЧКА! Рыба уже на крючке — как не упустить её после сильного рывка?\n\n'
    'Реальные кадры прыжка пойманной рыбы, окуни у подводной травы и работа рыболовных снастей. '
    'Разбираем, где искать окуня, зачем контролировать шнур, почему нужно проверять узлы и как работает фрикцион. '
    'Кадры с рыбой под водой не показывают момент атаки — мы не выдаём их за поклёвки.\n\n'
    'Источники и лицензии:\n'+'\n'.join(CREDITS)+
    '\n\nМонтаж, объяснения и субтитры: Шпаргалка рыбака. '
    'Русская озвучка синтезирована из оригинального текста. '
    '#рыбалка #окунь #спиннинг #вываживание #поклевка\n',encoding='utf-8')
 # actual QA storyboard throughout finished movie
 samples=[]
 for i in range(12):
  t=elapsed*(i+.5)/12;pic=W/f'qa{i:02}.jpg'
  command([FF,'-loglevel','error','-y','-ss',f'{t:.2f}','-i',film,'-vf','scale=320:180','-frames:v','1',pic])
  samples.append((t,Image.open(pic).convert('RGB')))
 page=Image.new('RGB',(320*4,210*3),(10,20,29));dr=ImageDraw.Draw(page)
 for j,(t,img) in enumerate(samples):
  x=j%4*320;y=j//4*210;page.paste(img,(x,y))
  dr.text((x+8,y+184),f'{int(t//60):02d}:{int(t%60):02d}',fill='white')
 page.save(OUT/'QA_STORYBOARD.jpg',quality=90)
 print('FILM',str(film),'SECONDS',round(media_duration(film),2),'BYTES',film.stat().st_size,flush=True)
if __name__=='__main__':
 fetch();v=piper_voice();render(v)

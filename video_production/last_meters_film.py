#!/usr/bin/env python3
"""Original Russian fishing explainer built from real European CC0 tournament clips.
No watermarked previews, no stock glamour, no footage slowed down, no invented single continuous catch.
"""
from pathlib import Path
import os,re,math,time,json,subprocess,urllib.parse,asyncio,random,wave
import requests,imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont
FF=imageio_ffmpeg.get_ffmpeg_exe()
ROOT=Path(__file__).resolve().parent
W=ROOT/'last_meters_work';OUT=ROOT/'last_meters_output'
W.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
ADOBE_FIGHT_URL="https://fotolia-prod-videos-0.s3.eu-west-1.amazonaws.com/02/63/66/44/F_263664460_8qNTjhcvE9U8kMXYXTW8qGDCqSI9aBIY.video?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAUMGGMQGEWQT4MZ67%2F20261122%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20261122T130750Z&X-Amz-Expires=3600&X-Amz-Signature=1ad4124d6b80a9f3b037f6b6d08f87080a2e9fa6d5a5795bff528b96ff5ab8da&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22AdobeStock_263664460_HD.mov%22&x-amz-checksum-mode=ENABLED&x-id=GetObject"
# T## = distinct CC0 shots from a public European trout tournament, 3 Apr 2026.
# PIKE, MAT and START = CC0 shots from a Czech pike tournament, 31 Oct 2026.
VIDEO={
**{f'T{i:02}':f'Trout Area Tour 2026 ( III. závod Líheň Liběchov) video {i:02}.webm'
for i in [1,3,5,6,7,9,11,12,14,16,18,20,24,27,31,36,42,50]},
'PIKE':'Konečně štika.webm','MAT':'Hezky do vaničky.webm','START':'Start závodu.webm'
}
# Each shot is a UNIQUE non-overlapping section of an actual clip; speech must describe what is visible or a general principle.
# Source, source-start, max available clip length, exact narration.
SHOTS=[
('FIGHT',15.5,5.1,'Вот настоящая свечка: рыба уже на крючке и резко вылетает из воды.'),
('T12',20.0,6.5,'Но особенно легко потерять трофей, когда до берега остаются считанные метры.'),
('T07',1.0,8.8,'Посмотри на спиннингистов на соревнованиях. У воды каждое лишнее движение имеет значение.'),
('T12',6.0,12.0,'Первая ошибка — пытаться вытянуть рыбу силой. Не задирай удилище за спину.'),
('T20',2.0,9.0,'Удерживай натяжение лески, но оставляй фрикциону возможность стравливать её при рывке.'),
('T18',2.0,13.0,'Если рыба снова уходит в глубину, не дёргай. Дай удилищу погасить сопротивление.'),
('T24',2.0,12.0,'Не пытайся победить катушкой в одиночку. Работают и удилище, и правильно настроенный фрикцион.'),
('T06',2.0,9.0,'Вторая ошибка — вспоминать о подсаке только тогда, когда рыба уже у ног.'),
('T09',3.0,9.9,'На этих кадрах подсак у рыболова под рукой. Так и должно быть заранее.'),
('T11',3.0,11.5,'Опусти обод в воду и подводи рыбу к раскрытой сетке, головой вперёд.'),
('T50',2.0,15.0,'Не гоняйся за рыбой подсаком по поверхности. Она способна сделать ещё один резкий рывок.'),
('T27',1.0,6.0,'Лучше сохранить контакт со снастью и спокойно завести рыбу в сетку.'),
('T31',9.0,14.0,'Вот почему у самого берега важны точность и терпение, а не быстрая подмотка.'),
('T14',2.0,10.5,'Рыба делает новый круг? Ничего страшного. Не форсируй, подведи её ещё раз.'),
('T36',2.0,10.5,'И никогда не поднимай крупный улов на берег, удерживая его за одну леску.'),
('T03',1.0,8.8,'Третья ошибка начинается уже после подсака. Подготовь коврик и инструмент для крючка.'),
('PIKE',0.2,7.0,'А это отдельные кадры со щучьего турнира. Рыбу укладывают на специальный мат.'),
('PIKE',7.3,6.5,'Для отпускания улова лучше использовать мокрые руки и мягкую влажную поверхность.'),
('MAT',0.2,6.0,'Не оставляй рыбу надолго без воды. Сними крючок и сократи время на берегу.'),
('T01',1.0,7.0,'Если рыбу собираешься отпустить, по возможности держи её в воде.'),
('T42',3.0,12.5,'Запомни три вещи: держи натяжение, готовь подсак заранее и обращайся с уловом бережно.'),
('T16',3.0,11.5,'А у тебя сходила рыба у самого подсака? Напиши в комментариях. Это «Шпаргалка рыбака»!')
]
TITLE_MARKS={3:'01 / НЕ ФОРСИРУЙ',7:'02 / ПОДСАК ЗАРАНЕЕ',15:'03 / БЕРЕЖНО К РЫБЕ'}
FIGHT_CREDIT='Adobe Stock ID 263664460 — "Jackfish battle tensile strength of the fishing line", free licensed media'
EURO_CREDIT='Wikimedia Commons · Author Pohled 111 (Jiří Zelenka) · Trout Area Tour 3 April 2026 · Creative Commons CC0 1.0'
PIKE_CREDIT='Wikimedia Commons · Author Pohled 111 (Jiří Zelenka) · HEJLOV PIKE CUP 31 Oct 2026 · Creative Commons CC0 1.0'
def call(args,required=True,timeout=240):
 p=subprocess.run([str(x) for x in args],capture_output=True,text=True,timeout=timeout)
 if required and p.returncode:raise RuntimeError('FFmpeg command failed: '+str(args[:8])+'\n'+p.stderr[-1200:])
 return p
def length(path):
 p=call([FF,'-hide_banner','-i',str(path)],required=False)
 m=re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',p.stderr)
 if not m:raise RuntimeError(f'No media duration {path}: '+p.stderr[-600:])
 return int(m.group(1))*3600+int(m.group(2))*60+float(m.group(3))
def source_url(name):
 return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+urllib.parse.quote(name.replace(' ','_'),safe='')
def download():
 sess=requests.Session();sess.headers.update({'User-Agent':'FishingDocumentaryOriginal/1.0 (https://github.com/ff3f1/crystal-games)'})
 for key in sorted({s[0] for s in SHOTS}):
  path=W/(key+'.input')
  if path.exists() and path.stat().st_size>100000:continue
  url=ADOBE_FIGHT_URL if key=='FIGHT' else source_url(VIDEO[key])
  for attempt in range(5):
   try:
    with sess.get(url,timeout=(14,90),stream=True) as r:
     print('GET',key,r.status_code,flush=True)
     if r.status_code==429:
      time.sleep(2+attempt*4);continue
     r.raise_for_status()
     if key!='FIGHT' and 'video/' not in r.headers.get('content-type',''):
      raise RuntimeError('Unexpected MIME '+str(r.headers.get('content-type')))
     with path.open('wb') as f:
      for block in r.iter_content(1024*1024):
       if block:f.write(block)
    if path.stat().st_size>100000:break
   except Exception as e:
    print('RETRY',key,attempt,type(e).__name__,str(e)[:130],flush=True)
    time.sleep(1.2+attempt*2)
  if not path.exists() or path.stat().st_size<100000:raise RuntimeError('No source download: '+key)
  print('SOURCE',key,'duration',length(path),'bytes',path.stat().st_size,flush=True)
def validate():
 assert len(SHOTS)==22
 covered={}
 for key,start,maxlen,text in SHOTS:
  assert len(text)>15 and maxlen>=5
  d=length(W/(key+'.input'))
  assert start+maxlen<=d+.10,f'Incorrect time range: {key} {start}+{maxlen}>{d}'
  ranges=covered.setdefault(key,[])
  for a,b in ranges:
   assert start>=b or start+maxlen<=a,f'Overlapping/repeating source: {key}: {start}-{start+maxlen} and {a}-{b}'
  ranges.append((start,start+maxlen))
 print('VALIDATION',len(SHOTS),'scenes, no repeated source windows, no glamour Coverr footage',flush=True)
def speak():
 # Generate ALL lines with one voice. Microsoft Edge TTS may intermittently fail;
 # on a single failure discard all remote lines and use the open-source Piper model for the entire film.
 using_edge=False
 try:
  raise RuntimeError('Use one local consistent voice; avoid unreliable online API')
  import edge_tts
  async def one(txt,path):
   await edge_tts.Communicate(txt,'ru-RU-DmitryNeural',rate='+5%').save(str(path))
  for i,(_,start,maxlen,txt) in enumerate(SHOTS):
   path=W/f'edge{i:02}.mp3'
   good=False
   for attempt in range(3):
    try:
     asyncio.run(asyncio.wait_for(one(txt,path),timeout=18))
     if path.exists() and path.stat().st_size>1500:
      good=True;break
    except Exception as e:
     print('EDGE RETRY',i,attempt,type(e).__name__,str(e)[:100],flush=True)
    time.sleep(1+attempt*2)
   if not good:raise RuntimeError('Natural voice unavailable; fallback to a single Piper voice for ALL scenes')
  using_edge=True
  print('CONSISTENT VOICE: Edge Neural on all',len(SHOTS),'scenes',flush=True)
 except Exception as e:
  print('ONE CONSISTENT PIPER VOICE FALLBACK:',str(e)[:230],flush=True)
  using_edge=False
 if not using_edge:
  model=W/'ru_RU-dmitri-medium.onnx';conf=W/'ru_RU-dmitri-medium.onnx.json'
  base='https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/'
  for p in (model,conf):
   if not p.exists():
    with requests.get(base+p.name,timeout=(20,180),stream=True) as r:
     r.raise_for_status()
     with p.open('wb') as f:
      for block in r.iter_content(1024*1024):
       if block:f.write(block)
 voices=[]
 for i,(_,start,maxlen,txt) in enumerate(SHOTS):
  path=W/f'voice{i:02}.mp3'
  if using_edge:
   (W/f'edge{i:02}.mp3').replace(path)
  else:
   wav=W/f'voice{i:02}.wav'
   p=subprocess.run(['piper','--model',str(model),'--output_file',str(wav)],
                    input=txt,text=True,encoding='utf-8',capture_output=True,timeout=90)
   if p.returncode:raise RuntimeError('Piper error '+p.stderr[-500:])
   call([FF,'-loglevel','error','-y','-i',wav,'-q:a','3',path])
  d=length(path)
  allowed=maxlen-.14
  if d>allowed:
   factor=d/allowed
   if factor>1.25:
    raise RuntimeError(f'Voice too long for real-time clip {i}: {d:.1f}/{allowed:.1f}: {txt}')
   tmp=W/f'voice_fast{i:02}.mp3'
   call([FF,'-loglevel','error','-y','-i',path,'-af',f'atempo={factor:.4f}',tmp])
   tmp.replace(path);d=length(path)
  voices.append((path,d))
  print('AUDIO',i+1,'sec',round(d,2),'source',SHOTS[i][0],flush=True)
 return voices
def ass_time(t):
 h=int(t//3600);m=int((t%3600)//60);s=t%60
 return f'{h}:{m:02}:{s:05.2f}'
def srt_time(t):
 h=int(t//3600);m=int((t%3600)//60);s=t%60
 return f'{h:02}:{m:02}:{s:06.3f}'.replace('.',',')
def ass_file(i,text,dur,title=None):
 p=W/f'ass{i:02}.ass'
 words=text.split();lines=[];current=''
 for word in words:
  if len(current)+len(word)+1>47 and current:
   lines.append(current);current=word
  else:current=(' '.join((current,word))).strip()
 if current:lines.append(current)
 if len(lines)>2:
  at=min([j for j,c in enumerate(text) if c==' '],key=lambda j:abs(j-len(text)*.5))
  lines=[text[:at],text[at+1:]]
 body=r'\N'.join(lines)
 ASS="""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,DejaVu Sans,36,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,2,35,35,33,1
Style: Heading,DejaVu Sans,30,&H004DE2F0,&H004DE2F0,&H000A1620,&H90000000,-1,0,0,0,100,100,0,0,1,3,0,7,42,35,42,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
 ASS+=f'Dialogue: 0,{ass_time(0)},{ass_time(dur)},Main,,0,0,0,,{body}\n'
 if title:
  ASS+=f'Dialogue: 1,{ass_time(0)},{ass_time(min(dur,2.0))},Heading,,0,0,0,,{title}\n'
 if i==0:
  ASS+=f'Dialogue: 1,{ass_time(0)},{ass_time(2.3)},Heading,,0,0,0,,ШПАРГАЛКА РЫБАКА\n'
 p.write_text(ASS,encoding='utf-8')
 return p
def edit(voices):
 files=[];srt=[];report=[];cursor=0.
 for i,((key,start,maxlen,text),(mp3,d)) in enumerate(zip(SHOTS,voices)):
  duration=min(maxlen,d+.28)
  if duration<d:raise RuntimeError('Video shorter than voice!')
  sub=ass_file(i,text,d,TITLE_MARKS.get(i))
  shot=W/f'rendered{i:02}.mp4'
  src=W/(key+'.input')
  filtergraph=f'[0:v]scale=1280:720:force_original_aspect_ratio=increase:flags=bicubic,crop=1280:720,fps=25,eq=contrast=1.04:saturation=1.04,format=yuv420p,ass={sub.as_posix()}[v];[1:a]aresample=48000,apad=pad_dur=0.4[a]'
  call([FF,'-y','-loglevel','error','-ss',f'{start:.3f}','-i',src,
    '-i',mp3,'-filter_complex',filtergraph,
    '-map','[v]','-map','[a]','-t',f'{duration:.3f}',
    '-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',shot],timeout=180)
  files.append(shot)
  srt.append(f'{i+1}\n{srt_time(cursor)} --> {srt_time(cursor+d)}\n{text}\n\n')
  report.append({'number':i+1,'video_source':key,'start':round(cursor,2),'end':round(cursor+d,2),
    'source_from':start,'source_duration':duration,'narration_and_subtitle':text,'chapter':TITLE_MARKS.get(i)})
  cursor+=duration
  print('EDIT',i+1,'of',len(SHOTS),'timestamp',round(cursor,1),flush=True)
 playlist=W/'edit.ffconcat'
 playlist.write_text('ffconcat version 1.0\n'+''.join("file '"+str(p)+"'\n" for p in files),encoding='utf-8')
 output=OUT/'SHpargalka_Trofei_Poslednie_Metry_ACTION.mp4'
 call([FF,'-y','-loglevel','error','-f','concat','-safe','0','-i',playlist,
       '-c','copy','-movflags','+faststart',output])
 if not output.exists() or output.stat().st_size<1_000_000:raise RuntimeError('Missing encoded MP4')
 # Storyboards to check the actual final movie, not search result thumbnails.
 contact=Image.new('RGB',(4*320,6*200),(12,18,26));draw=ImageDraw.Draw(contact)
 for i in range(24):
  t=(i+.55)*cursor/24
  jpg=W/f'quality{i:02}.jpg'
  call([FF,'-y','-loglevel','error','-ss',f'{t:.2f}','-i',output,'-frames:v','1','-vf','scale=320:180',jpg])
  x=i%4*320;y=i//4*200
  contact.paste(Image.open(jpg).convert('RGB'),(x,y))
  draw.text((x+8,y+181),f'{int(t//60):02}:{int(t%60):02}',fill='white')
 contact.save(OUT/'QUALITY_STORYBOARD.jpg',quality=89)
 (OUT/'EXACT_SUBTITLES.srt').write_text(''.join(srt),encoding='utf8')
 (OUT/'SHOT_VOICE_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'SOURCES_AND_RIGHTS.txt').write_text(
 'All videos used with permission under their respective free or previously acquired licenses:\n'
 +FIGHT_CREDIT+'\n'+EURO_CREDIT+'\n'+PIKE_CREDIT+
 '\nFull sources: https://commons.wikimedia.org/wiki/Category:TROUT_AREA_TOUR_3.4.2026_Lib%C4%9Bchov_(videa)'
 '\nhttps://commons.wikimedia.org/wiki/Category:HEJLOV_PIKE_CUP_2026'
 '\nSome scenes show different real fishing outings; the film is educational and does not pretend all scenes show one catch.'
 '\nClips edited as supplied at normal speed; sources audio not reused.\n',encoding='utf8')
 (OUT/'YOUTUBE_TITLE_DESCRIPTION.txt').write_text(
 'ПОЧЕМУ РЫБА СХОДИТ У БЕРЕГА? 3 ошибки при вываживании и работе с подсаком\n\n'
 'Самые обидные сходы случаются, когда трофей уже совсем рядом. Разбираем три практических момента: '
 'не форсировать вываживание, готовить подсак заранее и бережно обращаться с рыбой после поимки. '
 'В выпуске только настоящие видеозаписи рыбалки, в том числе европейских соревнований 2026 года. '
 'Отдельные сцены иллюстрируют разные случаи; они не изображают один непрерывный вылов.\n\n'
 'Источники: \n'+FIGHT_CREDIT+'\n'+EURO_CREDIT+'\n'+PIKE_CREDIT+
 '\n\nПрактики бережного отпускания рыбы: https://www.fisheries.noaa.gov/national/resources-fishing/catch-and-release-fishing-best-practices'
 '\n#рыбалка #спиннинг #щука #подсак #вываживание\n',encoding='utf8')
 print('COMPLETE',str(output),'SECONDS',round(length(output),2),'SIZE',output.stat().st_size,flush=True)
if __name__=='__main__':
 download();validate();voice=speak();edit(voice)

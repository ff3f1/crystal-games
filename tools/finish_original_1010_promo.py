"""Edit original 1.0.10 Playwright capture into a truthful 9:16 gameplay promo."""
import json,math,os,subprocess,sys,wave,struct
from pathlib import Path
OUT=Path(os.environ.get('PROMO_OUT','promo-output'))
meta=json.loads((OUT/'timeline.json').read_text(encoding='utf8'))
marks=meta['marks']
raw=OUT/meta['footage']
if meta['baseCommit']!='b77f8443f482b4de083b4b88ada2d2f99f232bc9':
 raise RuntimeError('Not original 1.0.10 footage')
def call(*args):
 p=subprocess.run(args,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(' '.join(map(str,args))+'\n'+p.stderr[-6000:])
 return p.stdout
probe=json.loads(call('ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,codec_type,width,height','-of','json',str(raw)))
duration=float(probe['format']['duration'])
if duration<16:raise RuntimeError('Original capture too short: '+str(duration))
# Hook, genuine menu, map, lake, cast, bite, fight, earned catch, outro.
# Repeated opening fight footage is an editorial teaser, not a fabricated scene.
sections=[
 ('hook','fight','catch',1.8,'ВОТ ЭТО РЫВОК!'),
 ('menu','menu','map',2.9,'ЭТО «РЫБАЛКА: КЛЮЁТ!»'),
 ('map','map','water',3.1,'ВЫБИРАЙ СВОЙ ВОДОЁМ'),
 ('water','water','cast',3.0,'ГОТОВЬ СНАСТИ И ЖДИ'),
 ('cast','cast','bite',3.2,'ЗАБРОС... И ТИШИНА'),
 ('bite','bite','take',2.4,'ПОПЛАВОК ДРОГНУЛ!\nПОДСЕКАЙ!'),
 ('fight','fight','catch',6.1,'ДЕРЖИ НАТЯЖЕНИЕ!\nНЕ УПУСТИ РЫБУ!'),
 ('catch','catch','outro',4.3,'ЕСТЬ! ВОТ ОН — УЛОВ!'),
 ('outro','outro','end',3.8,'«РЫБАЛКА: КЛЮЁТ!»\nУЖЕ В RUSTORE')
]
def tstamp(s):
 ms=int(round(s*1000));h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);ss,ms=divmod(ms,1000)
 return '%02d:%02d:%02d,%03d'%(h,m,ss,ms)
def assstamp(s):
 cs=int(round(s*100));h,cs=divmod(cs,360000);m,cs=divmod(cs,6000);ss,cs=divmod(cs,100)
 return '%d:%02d:%02d.%02d'%(h,m,ss,cs)
segments=[];srt=[];events=[];timeline=0.
for idx,(label,st,en,want,caption) in enumerate(sections):
 start=max(.05,float(marks[st])+.15)
 end=min(duration-.05,float(marks[en])-.10)
 if end-start<.22:raise RuntimeError('Insufficient real frames for '+label+': '+str((start,end,marks)))
 segments.append((start,end-start,want,label))
 srt.append(str(idx+1)+'\n'+tstamp(timeline)+' --> '+tstamp(timeline+want-.03)+'\n'+caption+'\n')
 events.append('Dialogue: 0,'+assstamp(timeline)+','+assstamp(timeline+want-.03)+',VO,,0,0,0,,'+caption.replace('\n',r'\N'))
 timeline+=want
(OUT/'subtitles.srt').write_text('\n'.join(srt),encoding='utf8')
(OUT/'subtitles.ass').write_text(
 """[Script Info]
Title: Fishing 1.0.10 | real gameplay, original subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: VO,DejaVu Sans,59,&H00FFFFFF,&H00000000,&H80000000,&HAA051B25,-1,0,0,0,100,100,0,0,3,2,1,2,80,80,305,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""+'\n'.join(events)+'\n',encoding='utf8')
speech="""Вот это рывок! Кажется, на крючке что-то серьёзное.
Это «Рыбалка: Клюёт!»
Выбирай свой водоём, готовь снасти и отправляйся на берег.
Заброс — и тишина.
Поплавок дрогнул! Самое время подсечь.
А теперь держи натяжение: рыба просто так не сдастся.
Есть! Улов твой.
Сможешь поймать лучше? «Рыбалка: Клюёт!» — уже в RuStore."""
(OUT/'tekst-dlya-ozvuchki.txt').write_text(speech+'\n',encoding='utf8')
# Gentle original, clean synthetic soundtrack. No hiss, no copyrighted melody.
sr=24000;n=int((timeline+.5)*sr)
chords=[[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66],[164.81,220,261.63]]
music=OUT/'original-music.wav'
with wave.open(str(music),'wb') as wav:
 wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(sr)
 chunk=bytearray()
 for i in range(n):
  t=i/sr;ch=chords[int(t/2.22)%len(chords)];beat=(t%(.555));sec=(t%2.22)
  # Pad / low bass / muted pluck; smooth envelopes to avoid hard clicks.
  pad=sum(math.sin(2*math.pi*f*t) for f in ch)/3
  bass=math.sin(2*math.pi*(ch[0]/2)*t)
  pluck=(math.exp(-beat*9)*math.sin(2*math.pi*ch[1]*t)+.45*math.exp(-beat*13)*math.sin(2*math.pi*ch[2]*t))
  kick=math.exp(-sec*16)*math.sin(2*math.pi*(56+50*math.exp(-sec*22))*sec)
  fade=min(1,t/1.4,max(0,(timeline+.5-t)/1.4))
  value=.14*(.24*pad+.18*bass+.26*pluck+.21*kick)*fade
  chunk.extend(struct.pack('<h',int(max(-1,min(1,value))*32767)))
  if len(chunk)>131072:wav.writeframesraw(chunk);chunk.clear()
 if chunk:wav.writeframesraw(chunk)
cmd=['ffmpeg','-hide_banner','-loglevel','error','-y']
filters=[]
for i,(start,srcdur,outdur,label) in enumerate(segments):
 cmd+=['-ss','%.3f'%start,'-t','%.3f'%srcdur,'-i',str(raw)]
 scale=outdur/srcdur
 filters.append('[%d:v]setpts=%.7f*(PTS-STARTPTS),fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v%d]'%(i,scale,i))
cmd+=['-i',str(music)]
concat=''.join('[v%d]'%i for i in range(len(segments)))+'concat=n=%d:v=1:a=0[base]'%len(segments)
filters.append(concat)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
filters.append("[base]ass="+str(OUT/'subtitles.ass')+",drawtext=fontfile="+font+":text='ГЕЙМПЛЕЙ 1.0.10':fontsize=31:fontcolor=white@0.88:x=62:y=84:box=1:boxcolor=black@0.34:boxborderw=17[v]")
cmd+=['-filter_complex',';'.join(filters),'-map','[v]','-map','%d:a'%len(segments),'-t','%.3f'%timeline,
 '-c:v','libx264','-crf','22','-preset','veryfast','-pix_fmt','yuv420p','-r','30',
 '-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart',str(OUT/'Rybalka_Klyuet_1.0.10_Shorts_9x16.mp4')]
call(*cmd)
vpath=OUT/'Rybalka_Klyuet_1.0.10_Shorts_9x16.mp4'
result=json.loads(call('ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height','-of','json',str(vpath)))
v=next(x for x in result['streams'] if x['codec_type']=='video')
a=next(x for x in result['streams'] if x['codec_type']=='audio')
if (v['codec_name'],v['width'],v['height'],a['codec_name'])!=('h264',1080,1920,'aac'):
 raise RuntimeError('Unexpected output codecs or size: '+str(result))
if abs(float(result['format']['duration'])-timeline)>1.3:raise RuntimeError('Wrong duration '+str(result))
call('ffmpeg','-hide_banner','-loglevel','error','-y','-ss','%.1f'%(timeline*.77),'-i',str(vpath),'-frames:v','1',str(OUT/'preview.png'))
report={'game':'1.0.10 original (not 1.5/2.1)','source_sha':meta['baseCommit'],
'duration_seconds':round(timeline,2),'output_bytes':vpath.stat().st_size,'resolution':'1080x1920',
'captured_gameplay':list(marks),'editing':'real Chrome capture, cuts and tempo adjustments; no simulated catch images',
'audio':'original low-volume instrumental bed, no narration','subtitles':'burned into MP4; also SRT'}
(OUT/'video-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('PROMO DONE '+json.dumps(report,ensure_ascii=False),flush=True)

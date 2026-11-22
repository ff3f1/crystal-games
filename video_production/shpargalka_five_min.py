#!/usr/bin/env python3
"""Five-minute fishing field guide. Public-domain USFWS moving footage only."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,sys,math,random,requests,json,shutil
ROOT=Path(__file__).resolve().parent; WORK=ROOT/'five_min_work'; OUT=ROOT/'five_min_output'
for x in [WORK,OUT]:x.mkdir(exist_ok=True)
HLS={
 'PIKE':'https://fws.rev.vbrick.com/downloads/videos/1c8ce64d-525d-4f7c-bda6-2a88f5c6e838/instances/eee315dc-d652-4cd4-af65-ca0775d95188-720p-2962kbps.m3u8',
 'TROUT':'https://fws.rev.vbrick.com/downloads/videos/d9413087-4bef-4d2f-952c-11ca4af83bde/instances/976fe75a-4455-42c2-a8a1-b6628108cbe3-720p-2962kbps.m3u8'
}
CHAPTERS=[
 ('Видишь рыбу?',
  "Посмотри внимательно. Вот прямо под корягой стоит рыба. С поверхности реки этого почти не заметить. А теперь посмотри на щуку среди подводной травы. Её окраска практически сливается с фоном. Мы часто говорим: на водоёме сегодня пусто. Но иногда рыба есть, просто наша приманка проходит совсем не там. Сегодня покажу настоящие подводные кадры — без нарисованных атак и постановочных трофеев. И разберу пять ориентиров, которые стоит проверить на следующей рыбалке. В конце соберём всё в короткий план поиска.",
  [('TROUT',421,434),('PIKE',319,330),('TROUT',16,36)]),
 ('5. Кромка травы',
  "Первое место — граница травы и чистой воды. Это не всегда эффектный пейзаж. Иногда просто несколько стеблей на небольшом перепаде глубины. На этих архивных кадрах с Аляски щука отлично видна на фоне растительности — когда знаешь, куда смотреть. А если она чуть уходит в сторону, силуэт почти исчезает. Для хищника укрытие может быть удобной точкой ожидания добычи. Но делать вывод, что в каждой траве обязательно живёт щука, нельзя. Сначала проверь, есть ли рядом кормовая рыба, подходящая глубина, чистые окна и свободное место для проводки. На практике начни с заброса вдоль кромки, а не строго поперёк неё. Так приманка дольше идёт по перспективной линии. Измени направление, скорость, попробуй паузу. И только потом переходи к соседнему окну.",
  [('PIKE',288,319),('PIKE',330,361)]),
 ('4. Тень и тихая вода',
  "Второй ориентир — тень от растений, корней и других укрытий. Обрати внимание: на кадрах щука то становится заметной, то снова теряется среди стеблей. Рыба может сохранять положение почти без заметных движений. Это не значит, что она гарантированно пассивна или готовится атаковать. Камера показывает положение рыбы, а не её мысли. Для рыболова вывод практический: перспективную точку полезно облавливать под разными углами. Один заброс может быстро пересечь укрытие, а следующий пройти вдоль него. В холодной воде иногда помогает более спокойная подача, однако универсальной паузы на пять секунд нет. Ветер, течение, глубина и тип приманки меняют всё. На мелководье действуй осторожно. Грохот по лодке, шум на берегу и тяжёлые ненужные забросы могут испортить шанс.",
  [('PIKE',361,414),('PIKE',414,434)]),
 ('3. Камни и граница течения',
  "Третий ориентир — камни и перемены течения. Теперь на кадрах ручьевая форель из Западной Вирджинии. Это другой вид рыбы, и переносить её поведение на щуку буквально было бы ошибкой. Но подводная съёмка хорошо показывает сам принцип: рыба может держаться рядом с камнями и неровностями дна. Там меняется движение воды, появляется укрытие, а корм проходит по соседним струям. На реке особенно интересно обследовать границу быстрого потока и более тихой воды. Проверяй обратки, небольшие ступеньки и места за крупными камнями, только не забывай про безопасный подход к воде. Если ловишь на джиг, контролируй момент касания дна и время падения груза. Если используешь вращающуюся блесну, следи, чтобы её игра не сбивалась из-за слишком сильного течения. Главное — понимать, в каком горизонте проходит приманка.",
  [('TROUT',96,215),('TROUT',215,228)]),
 ('2. Под корягой',
  "Четвёртое место — пространство под затопленной веткой, корягой или подмытым берегом. Посмотри, сколько рыбы бывает под одним укрытием на этих кадрах. Здесь важно само устройство места: есть крыша над головой, тень, камни, а рядом открытая вода. Разные виды могут пользоваться такими участками по разным причинам. Не нужно бросать крючок прямо в самый густой завал и оставлять там дорогую приманку. Проще и безопаснее сначала проверить края: провести приманку вдоль коряги, зайти с другой стороны, подобрать такую глубину, чтобы не цеплять дерево. Если поклёвки нет, не спеши менять цвет. Возможно, рыба стоит чуть ниже или выше той линии, по которой ты ведёшь. Подводные кадры помогают увидеть, насколько узким бывает рабочий участок.",
  [('TROUT',410,421),('TROUT',434,509),('TROUT',509,548)]),
 ('1. План первых забросов',
  "Пятый и, пожалуй, главный ориентир — переход от случайных забросов к понятному поиску. Приехал на незнакомую речку? Первые минуты просто посмотри по сторонам. Где меняется глубина, где стоит трава, куда уходит течение, есть ли движение малька? Затем выбери две или три точки. Сделай несколько забросов веером и сравни, где приманка касается дна быстрее, а где медленнее. После этого попробуй разные углы и скорости проводки. Не меняй одновременно всё подряд: если сменить место, вес, цвет и тип приманки, не поймёшь, что помогло. И не засиживайся бесконечно на пустой точке, если ты уже проверил её разными способами. Съёмки сделаны в разные годы и сезоны; они не обещают ноябрьский улов именно в твоём водоёме. Но они учат важному: смотреть на воду не как на ровное поле, а как на систему укрытий и маршрутов рыбы. Напиши в комментариях, где чаще ловишь — на реке или озере. Это Шпаргалка рыбака. Ни хвоста ни чешуи!",
  [('TROUT',228,355),('TROUT',36,78)])
]
LOGO="ШПАРГАЛКА РЫБАКА"
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def run(cmd):
 p=subprocess.run([str(x) for x in cmd],capture_output=True,text=True)
 if p.returncode!=0:raise RuntimeError("COMMAND FAILED: "+' '.join(map(str,cmd[:9]))+"\n"+p.stderr[-1300:])
 return p.stdout
def dur(f):
 x=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(f)]))
 return float(x['format']['duration'])
def sources():
 for tag,url in HLS.items():
  f=WORK/(tag+'.mp4')
  if not f.exists():
   run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',url,'-c','copy',str(f)])
  print('SOURCE',tag,round(dur(f),2),f.stat().st_size,flush=True)
def voice():
 import sys
 try:import piper
 except ImportError:
  subprocess.run([sys.executable,'-m','pip','install','-q','piper-tts'],check=True)
 modeldir=WORK/'voice';modeldir.mkdir(exist_ok=True)
 base='https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/'
 for name in ['ru_RU-dmitri-medium.onnx','ru_RU-dmitri-medium.onnx.json']:
  p=modeldir/name
  if not p.exists():
   with requests.get(base+name,timeout=(20,150),stream=True) as r:
    r.raise_for_status()
    with p.open('wb') as f:
     for c in r.iter_content(1024*1024):
      if c:f.write(c)
 ds=[]
 for i,(_title,text,_parts) in enumerate(CHAPTERS):
  wav=WORK/f'voice{i:02d}.wav'
  mp3=WORK/f'voice{i:02d}.mp3'
  p=subprocess.run(['piper','--model',str(modeldir/'ru_RU-dmitri-medium.onnx'),'--output_file',str(wav)],input=text,text=True,capture_output=True)
  if p.returncode:raise RuntimeError(p.stderr[-900:])
  run(['ffmpeg','-y','-loglevel','error','-i',wav,'-c:a','libmp3lame','-q:a','3',mp3])
  ds.append(dur(mp3));print('VOICE',i,round(ds[-1],2),flush=True)
 return ds
def overlay_for(title,index):
 im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im)
 d.rounded_rectangle((34,31,295,75),radius=10,fill=(0,20,30,197))
 d.text((50,39),LOGO,font=ImageFont.truetype(BOLD,17),fill='#2bdfc6')
 d.rounded_rectangle((35,564,1080,641),radius=13,fill=(0,16,25,198))
 d.rectangle((35,564,42,641),fill='#2bdfc6')
 d.text((60,582),title.upper(),font=ImageFont.truetype(BOLD,32),fill='#FFFFFF')
 p=WORK/f'overlay{index:02d}.png';im.save(p);return p
def build(ds):
 chapters=[];clock=0.0;chapter_lines=[];sources_list=[]
 for idx,(title,words,windows) in enumerate(CHAPTERS):
  target=ds[idx]+.45
  shots=[];remaining=target; win=0;offset=0.0
  overlay=overlay_for(title,idx)
  while remaining>.07:
   if win>=len(windows):raise RuntimeError(f'Not enough diverse footage for {title}: remaining {remaining:.2f}s')
   tag,start,end=windows[win];available=end-start-offset
   if available<.15:win+=1;offset=0;continue
   # 5-8 seconds between cuts; use only footage not previously used in any chapter
   shotlen=min(remaining,available,random.Random(idx*1000+len(shots)).choice([5.3,6.2,6.8,7.4,7.9]))
   shotstart=start+offset
   part=WORK/f'clip{idx:02d}-{len(shots):02d}.mp4'
   if len(shots)==0:
    flt="[0:v]scale=1280:720:flags=lanczos,fps=24,eq=contrast=1.05:saturation=1.08,format=yuv420p[a];[a][1:v]overlay=0:0:enable='between(t,0,3.5)'[v]"
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{shotstart:.3f}','-i',WORK/(tag+'.mp4'),'-loop','1','-i',overlay,'-filter_complex',flt,'-map','[v]','-t',f'{shotlen:.3f}','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',part])
   else:
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{shotstart:.3f}','-i',WORK/(tag+'.mp4'),'-vf','scale=1280:720:flags=lanczos,fps=24,eq=contrast=1.05:saturation=1.08,format=yuv420p','-t',f'{shotlen:.3f}','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',part])
   sources_list.append((idx,title,tag,round(shotstart,2),round(shotlen,2)))
   shots.append(part);remaining-=shotlen;offset+=shotlen
  plist=WORK/f'list{idx:02d}.txt'
  plist.write_text('ffconcat version 1.0\n'+''.join("file '"+str(x)+"'\n" for x in shots))
  video=WORK/f'chapter{idx:02d}.mp4'
  run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',plist,'-c','copy',video])
  final=WORK/f'chapter_final{idx:02d}.mp4'
  run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',video,'-i',WORK/f'voice{idx:02d}.mp3','-filter_complex','[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0,afade=t=in:st=0:d=0.16[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','160k','-t',f'{target:.3f}','-movflags','+faststart',final])
  chapters.append(final)
  chapter_lines.append((clock,title))
  clock+=target
  print('CHAPTER',idx+1,round(clock,1),len(shots),'shots',flush=True)
 f=WORK/'film_concat.txt';f.write_text('ffconcat version 1.0\n'+''.join("file '"+str(c)+"'\n" for c in chapters))
 dest=OUT/'Shpargalka_Rybaka_5min_Underwater.mp4'
 run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',f,'-c','copy','-movflags','+faststart',dest])
 info=run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height','-of','json',dest])
 (OUT/'MEDIA_INFO.json').write_text(info,encoding='utf-8')
 (OUT/'YOUTUBE_DESCRIPTION.txt').write_text(
 "РЫБА ПРЯЧЕТСЯ ПРЯМО ПОД НОГАМИ! 5 мест, которые стоит проверить | Подводные кадры\n\n"
 "Где стоит щука среди водорослей? Почему рыбы держатся возле камней, коряг и тихих участков течения? "
 "Разбираем реальные архивные подводные съёмки: щука из Аляски и ручьевая форель из Западной Вирджинии. "
 "Это наблюдения, а не гарантированный способ поймать рыбу.\n\n"+
 "\n".join(f'{int(t)//60:02d}:{int(t)%60:02d} {title}' for t,title in chapter_lines)+
 "\n\nВидеоархив: U.S. Fish & Wildlife Service / National Conservation Training Center (USFWS/NCTC). "
 "Операторы: Brett Billings, Ryan Hagerty, Doug Canfield. Оригиналы:\n"
 "https://fws.rev.vbrick.com/#/videos/1c8ce64d-525d-4f7c-bda6-2a88f5c6e838\n"
 "https://fws.rev.vbrick.com/#/videos/d9413087-4bef-4d2f-952c-11ca4af83bde\n"
 "Использованы отрывки без оригинальных звуковых дорожек. Видеоряд переработан: отобраны фрагменты, добавлены новая русская озвучка, монтаж, цветокоррекция и титры.\n"
 "Озвучка: Piper TTS ru_RU-dmitri-medium, модель rhasspy/piper-voices.\n"
 "#рыбалка #щука #рыбалкавноябре #подводныесъемки #спиннинг\n",encoding='utf-8')
 (OUT/'EDIT_DECISIONS.txt').write_text(
 "Видеоряд не содержит кадров автора Joachim T. и водяного знака jt. "
 "Из каждого источника использованы непересекающиеся интервалы: точные интервалы ниже.\n"+
 "\n".join(repr(x) for x in sources_list),encoding='utf-8')
 print('FINISHED',dest,round(dur(dest),2),dest.stat().st_size,flush=True)
if __name__=='__main__':
 sources();ds=voice();build(ds)

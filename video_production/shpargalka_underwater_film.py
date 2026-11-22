#!/usr/bin/env python3
"""Autonomous mini-documentary assembler. Genuine Wikimedia Commons video only."""
import asyncio, html, json, os, random, re, shutil, subprocess, time
from pathlib import Path
from urllib.parse import quote, urlparse
import requests, edge_tts
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent
D=ROOT/'rendered'; S=ROOT/'sources'; T=ROOT/'temp'
for p in (D,S,T):p.mkdir(parents=True,exist_ok=True)
FF=shutil.which('ffmpeg') or 'ffmpeg'
FP=shutil.which('ffprobe') or 'ffprobe'
OUT=D/'SHpargalka_Rybaka_Pod_Vodoy.mp4'
FILES={
'pike':'Northern pike (Esox lucius) in Austria.webm',
'spawn':'Spawning female northern pike (35295481814).webm',
'young':'Northern pike fingerlings (36002077271).webm',
'trout':'Adult Lake Trout (15540496917).webm',
'char':'Char at the Russian River Ferry (31666975855).webm',
'river':'Crooked River (36648924083).webm',
'river2':'McKenzie River (23254730946).webm',
'angler':'Fly-fishing on the Owyhee River in eastern Oregon (22037025559).webm',
'angler2':'Fly-fish casting on the Crooked River (28374634089).webm',
'river3':'Crooked River (37062421530).webm',
}
CHAPTERS=[
('Что скрыто под водой?', ['pike','river2','char'],
'Посмотри на эту щуку. Здесь нет компьютерной графики. Это реальная подводная съёмка в австрийском озере Вайсензее. И самая интересная деталь в том, как спокойно ведёт себя хищник. С берега мы можем решить, что вода совершенно пустая. Но под поверхностью существует целый мир, где рыбы движутся, замирают, прячутся среди растений и реагируют на малейшие изменения вокруг. Сегодня покажу настоящие видеокадры пресноводной рыбы. Мы разберём, что они действительно доказывают, какие ошибки допускают рыболовы и как использовать наблюдения на осенней рыбалке. Без чудо-приманок и выдуманных поклёвок.'),
('Почему щука прячется в траве', ['pike','spawn','pike'],
'Вытянутое тело, широкая пасть и мощный хвост делают щуку отличным охотником из засады. Обрати внимание на её окраску. На фоне травы силуэт почти растворяется. Поэтому граница растительности, окна среди кувшинок, затопленные ветки и стенка камыша нередко заслуживают особого внимания. Правда, это не значит, что щука обязательно находится у каждой травинки. Большую роль играют температура, глубина, наличие кормовой рыбы и время года. На видео можно увидеть, как рыба перемещается в своём укрытии. А вот утверждать, что она сейчас готовится атаковать определённую приманку, мы не имеем права: камера такого не показывает.'),
('Где искать хищника осенью', ['river2','angler','pike','river3'],
'Осенью водоём меняется. Растительность постепенно отмирает, на реках меняется освещение, а кормовая рыба может перемещаться между мелководьем и глубиной. Здесь важно не заучить один секретный метр, а научиться обследовать водоём. Начни с границы травы и чистой воды. Затем проверь свал в глубину, вход или выход из ямы, участок за корягой. На реке ищи границы быстрого и спокойного течения. Если можешь, оцени глубину по времени падения груза и сравни несколько забросов. Рыба бывает активной далеко не везде. Один хороший ориентир лучше двадцати случайных забросов.'),
('Что может рассказать малёк', ['young','char','pike'],
'Теперь посмотри на молодь рыбы. Маленькая рыба — важная часть жизни водоёма и возможная добыча для крупных хищников. Но осторожнее с выводами. Молодь щуки на этих архивных кадрах вовсе не доказывает, что рядом всегда стоит взрослая щука. На настоящем водоёме следи за движением небольших стай, за резкими выходами малька к поверхности, за птицами и всплесками. Один всплеск ничего не гарантирует. А вот когда сразу несколько признаков складываются в одну картину, точку имеет смысл проверить. Важно смотреть не только на поверхность воды, но и на глубину под ней.'),
('Рыба умеет экономить силы', ['char','trout','pike'],
'Здесь мы видим другую рыбу: гольца и озёрную форель. Это не щука и не судак, поэтому нельзя просто перенести их поведение на нашего хищника. Но есть важная общая деталь: рыбы умеют удерживаться в определённом положении, экономить движения и выбирать участок, в котором им удобно. Не всякая рыба круглые сутки носится за добычей. На холодной воде темп движения и время кормления могут изменяться. Поэтому медленная проводка и пауза иногда оказываются полезнее бесконечных резких рывков. Но универсальной длительности паузы не существует: она зависит от снасти, течения и активности конкретной рыбы.'),
('Три ошибки с приманкой', ['angler','river','angler2','pike'],
'Представь знакомую ситуацию. Забросил десять раз, рыба не берёт. Первое желание — заменить цвет силикона. Но перед этим проверь три вещи. Первая: попадает ли приманка туда, где предположительно стоит рыба? Вторая: контролируешь ли ты глубину? На джиге нужно понимать, когда груз касается дна и как долго падает. Третья: менял ли ты скорость и угол проводки? Иногда достаточно провести приманку немного иначе. Цвет может иметь значение, но гораздо труднее поймать рыбу, если приманка проходит далеко от неё. И не существует запаха, который гарантирует поклёвку на каждом забросе.'),
('Как проверять перспективное место', ['river3','river2','angler','pike'],
'Давай представим короткую рыбалку с берега. Первые забросы выполняем веером, чтобы понять рельеф и течение. Потом пробуем ближе к границе глубины и растительности. Меняем угол заброса, чтобы приманка шла вдоль перспективного участка, а не пересекала его за секунду. Если используем джиг, контролируем падение и подбираем вес так, чтобы чувствовать дно. Две-три осмысленные проводки с разной скоростью дадут больше информации, чем хаотичная смена блёсен. Если явных признаков рыбы нет и место обследовано, лучше проверить соседнюю точку. Это не гарантия улова, а понятный способ принимать решения.'),
('Что доказывает камера, а что нет', ['pike','trout','char','river'],
'Последний момент особенно важен. Эти съёмки сделаны в разных регионах, в разные годы и разные сезоны. Нельзя назвать их доказательством того, что ноябрьская щука завтра поведёт себя точно так же. Подводная камера позволяет наблюдать реальную рыбу, её положение, движения и окружение. А советы для рыбалки рождаются тогда, когда мы соединяем эти наблюдения с опытом, глубиной, температурой и условиями места. Итак, перед следующим забросом спроси себя: где может быть рыба, на какой глубине проходит приманка и что изменится, если я поменяю проводку? Именно с этих вопросов начинается осмысленная рыбалка. Если хочешь ещё разбор настоящих подводных кадров, напиши, кого смотреть следующим: щуку, окуня или судака. Это была Шпаргалка рыбака. Ни хвоста ни чешуи!'),
]
HEADERS={'pike':'ЩУКА · АВСТРИЯ','spawn':'ЩУКА · АРХИВ','young':'МОЛОДЬ ЩУКИ · США','trout':'ФОРЕЛЬ · США','char':'ГОЛЕЦ · АЛЯСКА','river':'РЕКА · ОРЕГОН','river2':'РЕКА · ОРЕГОН','river3':'РЕКА · ОРЕГОН','angler':'РЫБОЛОВ · ОРЕГОН','angler2':'РЫБОЛОВ · ОРЕГОН'}
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def run(a):
 p=subprocess.run(a,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 if p.returncode:raise RuntimeError(' '.join(map(str,a[:9]))+'\n'+p.stderr[-1700:])
 return p.stdout
def length(p):
 x=json.loads(run([FP,'-v','error','-show_entries','format=duration','-of','json',str(p)]))
 return float(x['format']['duration'])
def clean(x):
 return html.unescape(re.sub('<[^>]+>','',x))
def getvideo():
 session=requests.Session()
 session.headers.update({'User-Agent':'ShpargalkaRybakaDocFilm/1.0 (educational CC attribution, info: https://github.com/ff3f1/crystal-games)'})
 available={}; licenses=[]
 for key,name in FILES.items():
  try:
   print('FETCH',name,flush=True)
   q=session.get('https://commons.wikimedia.org/w/api.php',params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|size|extmetadata','titles':'File:'+name},timeout=45)
   q.raise_for_status()
   info=next(iter(q.json()['query']['pages'].values()))['imageinfo'][0]
   meta=info.get('extmetadata',{})
   lic=clean(meta.get('LicenseShortName',{}).get('value',''))
   allowed=('CC BY ' in lic and 'SA' not in lic and 'NC' not in lic and 'ND' not in lic) or ('CC0' in lic) or ('Public domain' in lic) or ('PD ' in lic) or ('PD-' in lic)
   if not allowed:print('LICENSE SKIP',name,lic,flush=True);continue
   url=info['url']
   u=urlparse(url)
   tc=url.replace('/commons/','/commons/transcoded/',1)+'/'+url.rsplit('/',1)[-1]+'.720p.vp9.webm'
   dest=S/(key+'.webm')
   ok=False
   for candidate in [tc,url]:
    try:
     with session.get(candidate,stream=True,timeout=(20,120)) as res:
      res.raise_for_status()
      with dest.open('wb') as out:
       for chunk in res.iter_content(1024*1024):
        if chunk:out.write(chunk)
     if dest.stat().st_size>10000 and length(dest)>=6:
      ok=True;break
    except Exception as exc:print('TRY FAILED',key,str(exc)[:140],flush=True)
    dest.unlink(missing_ok=True)
   if ok:
    available[key]=(dest,length(dest))
    author=clean(meta.get('Artist',{}).get('value',''))[:240]
    licenses.append(f'{name}\nАвтор: {author}\nЛицензия: {lic}\nhttps://commons.wikimedia.org/wiki/File:{quote(name.replace(" ","_"))}\nИзменения: монтаж, обрезка, звуковое оформление, титры.\n')
    print('READY',key,dest.stat().st_size,flush=True)
  except Exception as exc:print('FAILED',key,str(exc)[:220],flush=True)
 if len(available)<5:raise RuntimeError('Недостаточно реального видео: '+str(list(available)))
 (D/'CREDITS_AND_LICENSES.txt').write_text('\n'.join(licenses),encoding='utf8')
 return available
def voices():
 # Completely local TTS on the GitHub runner: no Edge or external API needed.
 import sys
 subprocess.run([sys.executable,'-m','pip','install','-q','piper-tts'],check=True)
 modeldir=T/'voice_model';modeldir.mkdir(exist_ok=True)
 model=modeldir/'ru_RU-dmitri-medium.onnx'
 config=modeldir/'ru_RU-dmitri-medium.onnx.json'
 base='https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/'
 for path in (model,config):
  if not path.exists() or path.stat().st_size<1000:
   print('Downloading offline Russian voice model',path.name,flush=True)
   with requests.get(base+path.name,stream=True,timeout=(25,180)) as res:
    res.raise_for_status()
    with path.open('wb') as fd:
     for part in res.iter_content(1024*1024):
      if part: fd.write(part)
 if model.stat().st_size<1000000:raise RuntimeError('Voice model download incomplete')
 durations=[]
 for i,(title,_,script) in enumerate(CHAPTERS):
  wav=T/f'voice_{i:02d}.wav'
  mp3=T/f'voice_{i:02d}.mp3'
  p=subprocess.run(['piper','--model',str(model),'--output_file',str(wav)],input=script,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  if p.returncode: raise RuntimeError('Piper failed: '+p.stderr[-1800:])
  run([FF,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-q:a','3',str(mp3)])
  durations.append(length(mp3))
  print('OFFLINE VOICE',i+1,round(durations[-1],1),flush=True)
 (D/'VOICE_ATTRIBUTION.txt').write_text('Piper Russian voice: ru_RU-dmitri-medium (rhasspy/piper-voices). Based on OHF-Voice datasets; if using in a monetized release, credit model authors and Hi-Fi TTS (CC BY 4.0 base).\nhttps://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU/dmitri/medium\n',encoding='utf8')
 return durations
def textoverlay(title,idx,local_name):
 im=Image.new('RGBA',(1280,720),(0,0,0,0)); d=ImageDraw.Draw(im)
 d.rounded_rectangle((35,26,330,79),radius=12,fill=(0,16,24,198))
 d.text((54,38),'ШПАРГАЛКА РЫБАКА',font=ImageFont.truetype(BOLD,22),fill='#40dfd0')
 d.rounded_rectangle((35,551,1010,669),radius=17,fill=(0,16,24,198))
 d.rectangle((35,551,42,669),fill='#37dbba')
 d.text((65,565),f'{idx+1:02d}  {title.upper()}',font=ImageFont.truetype(BOLD,34),fill='white')
 d.text((67,623),('РЕАЛЬНЫЕ АРХИВНЫЕ СЪЁМКИ · '+local_name)[:90],font=ImageFont.truetype(FONT,19),fill='#bad4d4')
 path=T/f'overlay_{idx:02d}_{re.sub("[^a-z]","",local_name.lower())[:10]}.png'
 im.save(path);return path
def render(available,ds):
 finals=[]; timestamps=[];timeline=0.0
 for idx,(title,sourcekeys,script) in enumerate(CHAPTERS):
  remaining=ds[idx]+.5
  keys=[k for k in sourcekeys if k in available]
  if not keys:keys=list(available)[:2]
  shots=[];j=0
  while remaining>0.08:
   k=keys[j%len(keys)];path,srcdur=available[k]
   shotdur=min(15.0,remaining)
   # use different stretches of longer videos as chapter unfolds
   start=max(0,min((idx*13+j*17) % max(srcdur-2,1),srcdur-shotdur-0.15))
   ov=textoverlay(title,idx,HEADERS.get(k,k))
   part=T/f'shot_{idx:02d}_{j:02d}.mp4'
   run([FF,'-hide_banner','-loglevel','error','-y','-ss',str(start),'-stream_loop','-1','-i',str(path),'-loop','1','-i',str(ov),
   '-filter_complex','[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24,format=yuv420p[bg];[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[out]',
   '-map','[out]','-t',str(shotdur),'-c:v','libx264','-preset','veryfast','-crf','26','-pix_fmt','yuv420p','-an',str(part)])
   shots.append(part);remaining-=shotdur;j+=1
  cat=T/f'clips_{idx:02d}.txt'
  cat.write_text('ffconcat version 1.0\n'+''.join("file '"+str(s)+"'\n" for s in shots))
  raw=T/f'raw_{idx:02d}.mp4'
  run([FF,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(cat),'-c','copy',str(raw)])
  fin=T/f'part_{idx:02d}.mp4'
  run([FF,'-hide_banner','-loglevel','error','-y','-i',str(raw),'-i',str(T/f'voice_{idx:02d}.mp3'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','160k','-af','afade=t=in:st=0:d=0.25','-t',str(ds[idx]+.5),'-movflags','+faststart',str(fin)])
  finals.append(fin);timestamps.append((timeline,title));timeline+=ds[idx]+.5
  print('CHAPTER',idx+1,round(timeline),flush=True)
 concat=T/'chapters.txt'
 concat.write_text('ffconcat version 1.0\n'+''.join("file '"+str(x)+"'\n" for x in finals))
 run([FF,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(OUT)])
 (D/'CHAPTERS.txt').write_text('\n'.join(f'{int(sec)//60:02d}:{int(sec)%60:02d} {title}' for sec,title in timestamps),encoding='utf8')
 print('FINISHED',OUT,'DURATION',length(OUT),'SIZE',OUT.stat().st_size,flush=True)
if __name__=='__main__':
 sources=getvideo()
 ds=voices()
 render(sources,ds)

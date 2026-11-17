/* Рыбалка: Клюёт! 2.0 — standalone mobile 2D game, no legacy progress touched. */
(function(){
'use strict';
const $=id=>document.getElementById(id),cv=$('game'),g=cv.getContext('2d',{alpha:false});
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
const MAPS={
 pond_summer:{name:'Деревенский пруд',season:'Лето',habitat:'Тихая вода • кувшинки',type:'pond',ice:false,sea:false,water:.39,current:0,spots:[['Камыши',.22,.55,'crucian,roach,tench,rudd'],['Кувшинки',.76,.61,'crucian,rudd,perch,carp'],['Омут',.48,.77,'carp,perch,pike']]},
 pond_winter:{name:'Деревенский пруд',season:'Зима',habitat:'Подлёдная ловля • лунки',type:'pond',ice:true,sea:false,water:.39,current:0,spots:[['Тростник',.25,.55,'perch,roach,ruffe'],['Бровка',.72,.62,'bream,perch,roach'],['Глубина',.49,.77,'bream,perch,ruffe']]},
 river_summer:{name:'Лесная река',season:'Лето',habitat:'Течение • укрытия • хищник',type:'river',ice:false,sea:false,water:.4,current:.28,spots:[['Коряжник',.75,.54,'pike,perch,chub'],['Перекат',.34,.65,'chub,ide,zander'],['Русловая яма',.49,.79,'bream,catfish,zander']]},
 river_winter:{name:'Лесная река',season:'Зима',habitat:'Ледяной берег • зимовальная яма',type:'river',ice:true,sea:false,water:.42,current:.05,spots:[['Кромка',.22,.55,'perch,roach'],['Тиховодье',.74,.65,'perch,bream,zander'],['Глубокая яма',.5,.78,'bream,burbot,zander']]},
 sea_summer:{name:'Морская бухта',season:'Лето',habitat:'Морские камни • песчаное дно',type:'sea',ice:false,sea:true,water:.41,current:.16,spots:[['Прибрежные скалы',.19,.56,'blackseagoby,redmullet,terpug'],['Песчаная отмель',.55,.74,'flounder,redmullet,blackseagoby'],['Дальний свал',.82,.57,'cod,terpug,flounder']]},
 sea_winter:{name:'Северная бухта',season:'Зима',habitat:'Холодный прибой • море не замёрзло',type:'sea',ice:false,sea:true,water:.41,current:.2,spots:[['Каменные глыбы',.2,.57,'navaga,smelt'],['Песчаное дно',.56,.76,'flounder,halibut,navaga'],['Глубокая вода',.84,.6,'cod,halibut,smelt']]}
};
const F={
 crucian:['Карась',.3,.68,'worm,corn'],roach:['Плотва',.18,.45,'worm,corn'],tench:['Линь',.55,.83,'worm'],rudd:['Краснопёрка',.2,.55,'worm,corn'],
 perch:['Окунь',.48,.82,'worm,jig'],carp:['Карп',2.3,1.2,'corn,worm'],pike:['Щука',1.9,1.3,'jig'],
 ruffe:['Ёрш',.11,.47,'worm,jig'],bream:['Лещ',1.1,1.05,'worm,corn'],
 chub:['Голавль',.7,1.0,'worm,jig'],ide:['Язь',.8,.98,'worm,corn'],zander:['Судак',1.5,1.18,'jig'],
 catfish:['Сом',3.9,1.55,'worm,jig'],burbot:['Налим',1.3,1.1,'worm,jig'],
 blackseagoby:['Бычок',.22,.55,'worm,shrimp'],redmullet:['Барабулька',.29,.68,'shrimp,worm'],terpug:['Терпуг',.9,.98,'jig,shrimp'],
 flounder:['Камбала',.85,.92,'shrimp,worm'],cod:['Треска',2.0,1.18,'shrimp,jig'],navaga:['Навага',.6,.82,'shrimp,jig'],smelt:['Корюшка',.2,.57,'shrimp,worm'],halibut:['Палтус',4.2,1.48,'jig,shrimp']
};
const B={worm:['Червь','Клюёт большинство мирных рыб'],corn:['Кукуруза','Насадка для крупной рыбы'],jig:['Блесна','Для охоты на хищника'],shrimp:['Креветка','Морская насадка']};
const KEY='fishing2.progress.v1';
function getSave(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.version===1)return x}catch(e){}return {version:1,coins:180,level:1,xp:0,catches:0,records:{},last:'pond_summer',sound:true}}
const save=getSave();
// Save schema remains version 1: existing 2.0 installations keep their records.
if(!save.gear)save.gear={rod:0,line:0};
if(!Number.isFinite(save.streak))save.streak=0;
if(!Number.isFinite(save.totalWeight))save.totalWeight=0;
if(!Number.isFinite(save.bestStreak))save.bestStreak=0;

function persist(){try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}}
let W=390,H=844,DPR=1,now=0,last=performance.now(),timer=null,audio=null,bus=null,press=false,touchStart=0,touchX=0,surfaceTouch=false,ambient=null,ambientGain=null;
const imgs={};
function img(path){if(!imgs[path]){const image=new Image();image.src=path;imgs[path]=image}return imgs[path]}
function cover(image){if(!image||!image.complete||!image.naturalWidth)return false;const scale=Math.max(W/image.width,H/image.height);g.drawImage(image,(W-image.width*scale)*.5,(H-image.height*scale)*.5,image.width*scale,image.height*scale);return true}
const G={map:MAPS[save.last]?save.last:'pond_summer',mode:'ready',spot:null,position:null,bait:'worm',flight:0,wait:0,biteAt:4,bite:null,nibble:0,take:0,tension:.42,stress:0,slack:0,stamina:1,distance:13,fishPhase:0,runTime:2,run:0,rodAngle:0,rodSpeed:0,rodTarget:0,shake:0,jig:0,foam:[],drops:[],startClock:0,aim:null,castQuality:0,active:0,spotIdx:1,fishVisualX:0,fishVisualY:0,castCount:0,lastReel:0,fishFlip:1,landProgress:0,escapeWarnings:0};
function M(){return MAPS[G.map]}
function size(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);g.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener('resize',size,{passive:true});size();
function soundContext(){
 if(!save.sound)return null;
 try{
  if(!audio){
   const A=window.AudioContext||window.webkitAudioContext;audio=new A();bus=audio.createGain();bus.gain.value=.14;bus.connect(audio.destination);
   // Gentle, non-looping-noise-free ambience: a long, filtered noise bed at
   // very low volume. Separate from bites; never loud crackles or shrill music.
   const n=Math.ceil(audio.sampleRate*3.1),buffer=audio.createBuffer(1,n,audio.sampleRate),data=buffer.getChannelData(0);
   let smooth=0;for(let i=0;i<n;i++){smooth=smooth*.985+(Math.random()*2-1)*.015;data[i]=smooth*.8;}
   ambient=audio.createBufferSource();ambient.buffer=buffer;ambient.loop=true;
   const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;
   ambientGain=audio.createGain();ambientGain.gain.value=.16;
   ambient.connect(filter);filter.connect(ambientGain);ambientGain.connect(bus);ambient.start();
  }
  if(audio.state==='suspended')audio.resume();return audio;
 }catch(e){return null}
}
function beep(freq,duration,volume,end){const a=soundContext();if(!a)return;const t=a.currentTime,o=a.createOscillator(),v=a.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(end||freq,25),t+duration);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(volume||.2,t+.017);v.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(v);v.connect(bus);o.start(t);o.stop(t+duration+.01)}
function hiss(duration,power){const a=soundContext();if(!a)return;const count=Math.ceil(duration*a.sampleRate),buf=a.createBuffer(1,count,a.sampleRate),v=buf.getChannelData(0);for(let i=0;i<count;i++)v[i]=(Math.random()*2-1)*Math.exp(-i/count*3);const s=a.createBufferSource(),f=a.createBiquadFilter(),gain=a.createGain();s.buffer=buf;f.type='lowpass';f.frequency.value=1100;gain.gain.value=power;s.connect(f);f.connect(gain);gain.connect(bus);s.start()}
function audioCue(which){if(which==='cast'){hiss(.24,.28);beep(310,.12,.16,115)}if(which==='splash'){hiss(.34,.33);beep(150,.16,.15,72)}if(which==='nibble')beep(490,.07,.1,430);if(which==='take'){beep(700,.11,.17,940);setTimeout(()=>beep(920,.1,.13,1140),120)}if(which==='strike')beep(320,.2,.23,115);if(which==='lose')beep(300,.39,.16,100);if(which==='catch'){beep(515,.15,.21,750);setTimeout(()=>beep(790,.19,.18,1140),140)}}
function vibrate(t){try{if(navigator.vibrate)navigator.vibrate(t)}catch(e){}}
function label(id,text){if($(id).textContent!==text)$(id).textContent=text}
function toast(text){const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,2200)}
function activity(i) {
 // A place's readable surface signs correspond to its actual bite rate.
 // Each location has its own activity phase; this is not decorative noise.
 const offset=Object.keys(MAPS).indexOf(G.map)*1.51;
 return clamp(.36+.40*(.5+.5*Math.sin(now*.23+i*2.28+offset))+.20*(.5+.5*Math.sin(now*.064+i*1.21+offset)),.30,1);
}
function siteQuality(p,site){
 const c=coords(site),r=Math.hypot((p.x-c.x)/(W*.22),(p.y-c.y)/(H*.13));
 return clamp(1.08-r*.48,.24,1.08);
}
function catchForecast(site){
 const compatible=site[3].split(',').filter(id=>F[id]&&F[id][3].split(',').includes(G.bait));
 if(!compatible.length)return 'Эта наживка здесь не подходит';
 const idx=M().spots.indexOf(site),strength=activity(idx);
 return strength>.70?'Клёв активный':strength>.49?'Рыба кормится':'Сейчас затишье';
}
function aimAt(x,y){
 const m=M();if(G.mode!=='ready')return;
 G.aim={x:clamp(x,W*.10,W*.90),y:clamp(y,H*(m.water+.07),H*.84)};
 const site=nearest(G.aim.x,G.aim.y),qual=siteQuality(G.aim,site);
 G.spot=site;
 const near=qual>.70?'Точный заброс':qual>.49?'Рядом с точкой':'Далеко от рыбной точки';
 label('targetInfo',site[0]+' · '+near+' · '+catchForecast(site));
 $('targetInfo').hidden=false;
 label('phase','Точка выбрана: '+site[0]);
 label('tip','Нажми «ЗАБРОСИТЬ», чтобы попасть сюда. Или коснись другой точки.');
}
function chooseCastTime(){
 const m=M(),idx=m.spots.indexOf(G.spot),act=activity(Math.max(0,idx));
 G.active=act;G.castQuality=G.aim?siteQuality(G.aim,G.spot):.95;
 const skill=clamp(G.castQuality*(.67+act*.76),.26,1.36);
 const compatible=G.spot[3].split(',').filter(id=>F[id]&&F[id][3].split(',').includes(G.bait));
 // Strong spots reduce time-to-bite but never invent an incompatible fish.
 return compatible.length?rand(3.4,6.8)/skill:rand(2.2,3.6);
}

function refresh(){const map=M(),mode=G.mode;
 label('location',map.name+'  /  '+map.season);label('coins','✦ '+save.coins);label('baitTitle',B[G.bait][0]);
 const title={ready:map.ice?'Выбери место для лунки':'Найди перспективное место',fly:'Заброс…',drill:'Бурим лунку…',wait:map.ice?'Играй мормышкой':'Смотри на поплавок',nibble:'Осторожно, рыба пробует…',take:'ПОКЛЁВКА!',fight:'РЫБА НА КРЮЧКЕ!',caught:'Отличный улов!'}[mode];
 const explain={ready:'Рябь, камни и глубина подсказывают, куда бросать.',fly:'Снасть летит в выбранную точку.',drill:'Зимняя рыба живёт на разных глубинах.',wait:(G.spot?G.spot[0]+' · ':'')+(map.ice?'Коротко нажимай кнопку «Играть»':'Не торопись: сначала рыба осторожно трогает приманку.'),nibble:'Не подсекай на первом движении. Дождись настоящей потяжки.',take:'Время подсечь! Нажми кнопку или смахни вверх.',fight:'Удерживай подмотку. При рывке отпускай, чтобы не оборвать леску.',caught:'Новая добыча и награда за терпение.'}[mode];
 label('phase',title);label('tip',explain);
 const action=$('action');label('action',{ready:map.ice?'БУРИТЬ':'ЗАБРОСИТЬ',fly:'ЛЕТИТ…',drill:'БУРЕНИЕ…',wait:map.ice?'ИГРАТЬ':'ПЕРЕЗАБРОС',nibble:'ЖДАТЬ…',take:'ПОДСЕЧЬ!',fight:'ПОДМОТКА',caught:'ЕЩЁ РАЗ'}[mode]);action.disabled=mode==='fly'||mode==='drill'||mode==='nibble'||mode==='caught';action.classList.toggle('strike',mode==='take');action.classList.toggle('reel',mode==='fight');if(mode!=='fight')action.classList.remove('warning');$('fightInfo').hidden=mode!=='fight';
 label('instruction',mode==='fight'?'Следи за натяжением и направляй удилище.':mode==='ready'?'Коснись места на воде → забрось кнопкой':mode==='wait'?'Места с активной рябью сокращают ожидание':'Следи за рыбой, а не за таймером');
 label('warning',mode==='take'?'● ПОДСЕЧЬ СЕЙЧАС!':'');
 $('comboBox').hidden=save.streak<2||mode==='caught';
 if(save.streak>=2)label('comboBox','✦ Серия: '+save.streak+' улова');
 if(mode!=='ready')$('targetInfo').hidden=true;
 }
function coords(site){return {x:site[1]*W,y:site[2]*H}}
function nearest(x,y){let best=M().spots[0],d=Infinity;for(const s of M().spots){const p=coords(s),dd=Math.hypot(x-p.x,y-p.y);if(dd<d){d=dd;best=s}}return best}
function point(){return G.position||coords(M().spots[1])}
function drawRing(x,y,p){G.foam.push({x,y,p:p||.55,t:0,ttl:rand(.65,1.25)});if(G.foam.length>60)G.foam.shift()}
function splash(x,y){drawRing(x,y,.75);for(let i=0;i<15;i++)G.drops.push({x,y,vx:rand(-56,56),vy:rand(-130,-55),t:0,ttl:rand(.35,.75)});audioCue('splash')}
function changeMap(key){if(!MAPS[key])return;G.map=key;save.last=key;persist();G.spot=null;G.position=null;G.aim=null;G.wait=0;G.bite=null;G.rodAngle=0;G.mode='ready';$('targetInfo').hidden=true;G.bait=M().sea?'shrimp':'worm';G.foam=[];G.drops=[];press=false;$('mapScreen').hidden=true;$('catchScreen').hidden=true;drawCards();refresh();toast(M().name+' · '+M().season)}
function drawCards(){const box=$('mapList');box.innerHTML='';for(const key of Object.keys(MAPS)){const map=MAPS[key],b=document.createElement('button');b.className='map-card'+(key===G.map?' selected':'');b.type='button';const pic=document.createElement('img');pic.src='assets/scenes/'+key+'.webp';pic.alt='';b.appendChild(pic);const shade=document.createElement('span');shade.className='shade';b.appendChild(shade);const season=document.createElement('span');season.className='card-season';season.textContent=map.season==='Зима'?'❄ ЗИМА':'☀ ЛЕТО';b.appendChild(season);const inside=document.createElement('span');inside.className='card-inner';inside.innerHTML='<strong>'+map.name+'</strong><small>'+map.habitat+'</small>';b.appendChild(inside);b.onclick=()=>changeMap(key);box.appendChild(b)}}
function mapsOpen(){press=false;$('gearScreen').hidden=true;$('mapScreen').hidden=false;drawCards()}
function pickBait(){const options=M().sea?['shrimp','jig','worm']:['worm','corn','jig'],at=options.indexOf(G.bait);G.bait=options[(at+1)%options.length];toast(B[G.bait][0]+': '+B[G.bait][1]);refresh()}
function startCast(x,y){
 if(G.mode!=='ready')return;const m=M();
 G.aim={x:clamp(x,W*.1,W*.9),y:clamp(y,H*(m.water+.07),H*.84)};
 G.spot=nearest(G.aim.x,G.aim.y);
 G.position=m.ice?coords(G.spot):{x:G.aim.x,y:G.aim.y};
 G.biteAt=chooseCastTime();G.castCount++;G.flight=0;
 G.mode=m.ice?'drill':'fly';G.wait=0;
 audioCue('cast');refresh();
}
function land(){G.mode='wait';G.wait=0;if(G.spot&&M().ice)G.biteAt*=.80;if(M().ice){drawRing(point().x,point().y,.55)}else splash(point().x,point().y);refresh()}
function chooseFish(){
 // Fish table is local to the selected habitat, bait, and species. Large fish
 // appear less frequently but remain possible; no universal random fish.
 const pool=(G.spot||M().spots[1])[3].split(',').filter(id=>F[id]&&F[id][3].split(',').includes(G.bait));
 if(!pool.length)return null;
 const weights=pool.map(id=>1/Math.sqrt(.20+F[id][1]));
 let k=rand(0,weights.reduce((a,b)=>a+b,0));
 for(let i=0;i<pool.length;i++){k-=weights[i];if(k<=0)return pool[i]}
 return pool[pool.length-1];
}
function startNibble(){const id=chooseFish();if(!id){G.wait=0;G.biteAt=rand(2.4,4);toast('Здесь эта насадка не работает. Попробуй другую.');return}G.bite={id:id,name:F[id][0],kg:Math.max(.07,F[id][1]*rand(.55,1.55)),power:F[id][2]};G.mode='nibble';G.nibble=0;audioCue('nibble');refresh()}
function startTake(){G.mode='take';G.take=0;drawRing(point().x,point().y,.45);audioCue('take');vibrate(25);refresh()}
function strike(){if(G.mode==='nibble'){toast('Рано! Рыба только пробует наживку.');G.nibble=Math.max(0,G.nibble-.32);audioCue('strike');return}if(G.mode!=='take')return;G.mode='fight';G.stamina=1;G.tension=.39;G.distance=10+G.bite.kg*3;G.stress=0;G.slack=0;G.runTime=rand(1.3,2.7);G.run=0;G.runWarning=.65;G.fishVisualX=0;G.fishVisualY=0;G.fishFlip=1;G.landProgress=0;G.shake=5;press=false;audioCue('strike');vibrate([35,20,25]);refresh()}
function retry(){G.mode='ready';G.bite=null;G.spot=null;G.position=null;G.aim=null;press=false;$('catchScreen').hidden=true;refresh()}
function lost(message){save.streak=0;persist();G.mode='ready';G.bite=null;G.spot=null;G.position=null;G.aim=null;press=false;G.shake=4;audioCue('lose');toast(message);refresh()}
function caught(){G.mode='caught';press=false;const b=G.bite,m=M(),weight=+b.kg.toFixed(2),reward=Math.floor(15+weight*17+(m.sea?12:0));const record=weight>(save.records[b.id]||0);if(record)save.records[b.id]=weight;save.streak++;save.bestStreak=Math.max(save.bestStreak,save.streak);save.totalWeight+=weight;const combo=Math.min(save.streak,5)*4;save.coins+=reward+combo;save.catches++;save.xp+=Math.round(weight*12+6);save.level=1+Math.floor(save.xp/120);persist();label('catchSpecies',b.name);label('catchWeight',weight.toFixed(2).replace('.',',')+' кг');label('catchReward','+'+(reward+combo)+' ✦  ·  Серия x'+save.streak+'  ·  '+m.name);label('catchRecord',record?'★ НОВЫЙ ЛИЧНЫЙ РЕКОРД':'Улов № '+save.catches);$('catchFish').src='assets/fish/'+b.id+'.webp';$('catchScreen').hidden=false;audioCue('catch');vibrate([45,20,40]);refresh()}
function tab(name){
 const gear=name==='gear',collection=name==='collection',help=name==='help';
 $('gearGrid').hidden=!gear;$('collection').hidden=!collection;$('caughtStats').hidden=!collection;$('helpBlock').hidden=!help;
 $('tabGear').classList.toggle('active',gear);
 $('tabCollection').classList.toggle('active',collection);
 $('tabHelp').classList.toggle('active',help);
 if(gear)drawGear();if(collection)drawCollection();if(help)drawHelp();
}
function openGear(){press=false;$('gearScreen').hidden=false;tab('gear')}
function closeGear(){$('gearScreen').hidden=true;refresh()}
function drawGear(){
 const box=$('gearGrid');box.innerHTML='';
 const list=[{id:'rod',title:'Удобная катушка',icon:'◉',desc:'Быстрее подмотка и уверенное вываживание.'},{id:'line',title:'Крепкая леска',icon:'〰',desc:'Больше запас прочности во время рывков.'}];
 for(const item of list){const lvl=save.gear[item.id]||0,cost=item.id==='rod'?110+lvl*120:140+lvl*125;
  const el=document.createElement('div');el.className='gear-item';
  const icon=document.createElement('div');icon.className='gear-art';icon.textContent=item.icon;
  const content=document.createElement('div');content.className='gear-desc';
  const name=document.createElement('strong');name.textContent=item.title;
  const desc=document.createElement('p');desc.textContent=item.desc;
  const lv=document.createElement('div');lv.className='gear-lvl';lv.textContent='Уровень '+lvl+' / 3';
  content.append(name,desc,lv);el.append(icon,content);
  const b=document.createElement('button');b.className='gear-buy';b.textContent=lvl>=3?'МАКС':cost+' ✦';
  b.disabled=lvl>=3||save.coins<cost;
  b.onclick=()=>{if(save.gear[item.id]>=3||save.coins<cost)return;
   save.coins-=cost;save.gear[item.id]=lvl+1;persist();refresh();drawGear();audioCue('catch');toast(item.title+': уровень '+(lvl+1));};
  el.append(b);box.append(el);
 }
}
function drawCollection(){
 const box=$('collection');box.innerHTML='';
 for(const id of Object.keys(F)){
  const known=save.records[id]>0,el=document.createElement('div');el.className='fish-tile'+(known?'':' locked');
  const pic=document.createElement('img');pic.src='assets/fish/'+id+'.webp';pic.alt='';
  const name=document.createElement('span');name.textContent=known?F[id][0]:'???';
  const weight=document.createElement('small');weight.textContent=known?save.records[id].toFixed(2)+' кг':'Не поймана';
  el.append(pic,name,weight);box.append(el);
 }
 label('caughtStats','Поймано: '+save.catches+' · Рекордов: '+Object.keys(save.records).length+' / '+Object.keys(F).length+' · Лучшая серия: '+save.bestStreak);
}
function drawHelp(){
 $('helpBlock').innerHTML='<h3>Как действительно поймать рыбу</h3>'+
  '<p>1. Найди активную рябь или перспективное место. Коснись воды, появится прицел — тогда нажми «Забросить».</p>'+
  '<p>2. Подбери наживку под местную рыбу. Рядом с прицелом показана активность и совместимость.</p>'+
  '<p>3. Первые движения поплавка — проба наживки. Подсекай только на большой потяжке, когда подсказка сменится.</p>'+
  '<p>4. Держи подмотку во время спокойной борьбы. Перед рывком отпусти, иначе оборвёшь леску. На льду сначала бурится лунка.</p>'+
  '<p>5. Трофеи дают монеты. Улучши катушку и леску, чтобы удерживать сильную рыбу и собрать коллекцию.</p>';
}

function actionDown(){soundContext();const m=M();if(G.mode==='ready'){const p=G.aim||coords(M().spots[1]);startCast(p.x,p.y)}
 else if(G.mode==='wait'){if(m.ice){G.jig=1;G.wait+=.3;drawRing(point().x,point().y,.1);beep(230,.1,.1,300)}else retry()}
 else if(G.mode==='take'||G.mode==='nibble')strike();
 else if(G.mode==='fight'){press=true;$('action').classList.add('held')}
 else if(G.mode==='caught')retry()}
function actionUp(){press=false;$('action').classList.remove('held')}
$('action').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{$('action').setPointerCapture(e.pointerId)}catch(_){ }actionDown()});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$('action').addEventListener(ev,actionUp));
$('bait').onclick=pickBait;$('mapsTop').onclick=mapsOpen;$('mapsBottom').onclick=mapsOpen;$('closeMaps').onclick=()=>$('mapScreen').hidden=true;
$('again').onclick=retry;$('changeMap').onclick=()=>{retry();mapsOpen()};
$('sound').onclick=()=>{save.sound=!save.sound;persist();if(bus)bus.gain.setTargetAtTime(save.sound?.14:0,audio.currentTime,.045);label('sound',save.sound?'♫':'×');toast(save.sound?'Звук включён':'Звук выключен')};label('sound',save.sound?'♫':'×');
$('coins').onclick=openGear;
$('closeGear').onclick=closeGear;
$('tabGear').onclick=()=>tab('gear');
$('tabCollection').onclick=()=>tab('collection');
$('tabHelp').onclick=()=>tab('help');

cv.addEventListener('pointerdown',e=>{if(!$('mapScreen').hidden||!$('catchScreen').hidden||!$('gearScreen').hidden)return;e.preventDefault();soundContext();touchStart=e.clientY;touchX=e.clientX;surfaceTouch=true;if(G.mode==='ready')aimAt(e.clientX,e.clientY)});
cv.addEventListener('pointermove',e=>{if(!surfaceTouch)return;if(G.mode==='fight')G.rodTarget=clamp((e.clientX-touchX)/(W*.32),-1,1);else if(G.mode==='ready')aimAt(e.clientX,e.clientY)});
cv.addEventListener('pointerup',e=>{if(!surfaceTouch)return;surfaceTouch=false;if((G.mode==='take'||G.mode==='nibble')&&touchStart-e.clientY>25)strike();G.rodTarget=0});
cv.addEventListener('pointercancel',()=>{surfaceTouch=false;G.rodTarget=0});
document.addEventListener('visibilitychange',()=>{if(document.hidden){press=false;last=performance.now()}});
// Disable Android WebView selection handles, contextual menus and draggable
// text/images in gameplay; actual accessibility button names remain intact.
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('selectstart',e=>e.preventDefault());
for(const button of document.querySelectorAll('button'))button.setAttribute('draggable','false');

function physics(dt){now+=dt;G.shake=Math.max(0,G.shake-dt*26);G.jig=Math.max(0,G.jig-dt*1.7);
 G.rodSpeed+=(G.rodTarget-G.rodAngle)*dt*35;G.rodSpeed*=Math.exp(-dt*10);G.rodAngle+=G.rodSpeed*dt;
 for(const p of G.foam)p.t+=dt;G.foam=G.foam.filter(p=>p.t<p.ttl);
 for(const p of G.drops){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt}G.drops=G.drops.filter(p=>p.t<p.ttl);
 if(G.mode==='fly'||G.mode==='drill'){G.flight+=dt/(G.mode==='drill'?1.1:.7);if(G.flight>=1)land()}
 else if(G.mode==='wait'){
  // In winter a little jig action helps, but no frantic tapping is required.
  G.wait+=dt*(M().ice?(.92+G.jig*.34):1);
  if(G.wait>G.biteAt)startNibble();
 }
 else if(G.mode==='nibble'){G.nibble+=dt;if(G.nibble>1.1+G.bite.power*.35)startTake()}
 else if(G.mode==='take'){G.take+=dt;if(G.take>1.55)lost('Рыба ушла. В следующий раз подсекай на уверенной потяжке.')}
 else if(G.mode==='fight'){
  G.runTime-=dt;
  // A visible telegraph makes runs learnable, not a random punishment.
  if(G.runTime<.62&&G.runTime>0)G.runWarning=G.runTime;
  if(G.runTime<=0){G.run=rand(.66,1.05);G.runTime=rand(2.5,4.0);G.runWarning=0;vibrate(40);drawRing(point().x,point().y,.85)}
  const running=G.run>.08;G.run=Math.max(0,G.run-dt);
  const steer=clamp(Math.abs(G.rodTarget),0,1);
  const lineUpgrade=save.gear.line||0;
  const pull=.10+G.bite.power*.13+(running?.33*G.bite.power:0);
  // Line upgrades give headroom; steering the rod counters a hard side run.
  const control=running?steer*.065:0;
  const target=clamp((press?.36:0)+pull-control-lineUpgrade*.022,press?.12:.06,1.17);
  G.tension=lerp(G.tension,target,clamp(dt*(running?3.3:2),0,1));
  if(press&&!running&&G.tension<.88){G.stamina=Math.max(0,G.stamina-dt*(.16+.17/Math.sqrt(Math.max(.2,G.bite.kg))));G.distance=Math.max(0,G.distance-dt*(2.8+.9/G.bite.power+save.gear.rod*.3))}
  else if(running){G.distance+=dt*G.bite.power*.5;G.shake=1.3}
  if(G.tension>.91+lineUpgrade*.013)G.stress+=dt;else G.stress=Math.max(0,G.stress-dt*2.3);
  if(G.tension<.14)G.slack+=dt;else G.slack=Math.max(0,G.slack-dt*2);
  $('tensionNeedle').style.left=(clamp(G.tension,0,1)*100)+'%';$('stamina').style.width=((1-G.stamina)*100)+'%';label('distance',Math.ceil(G.distance)+' м');
  if(G.stress>.78+lineUpgrade*.12)lost('Обрыв! При мощном рывке отпускай подмотку.');
  else if(G.slack>1.3)lost('Сход! Леска слишком долго провисала.');
  else if(G.distance<1.5&&G.stamina<.18)caught();
  if(G.mode==='fight'){
    $('action').classList.toggle('warning',running||G.runTime<.62);
    label('warning',running?'⚠ РЫВОК — ОТПУСТИ КНОПКУ!':G.runTime<.62?'⚠ РЫБА ГОТОВИТСЯ К РЫВКУ':'');
    if(running){label('phase','МОЩНЫЙ РЫВОК!');label('tip','Отпусти подмотку и направь удочку в сторону.')}
    else if(press){label('phase','ПОДТЯГИВАЕМ РЫБУ');label('tip',G.runTime<.62?'Рыба готовится к рывку! Отпусти кнопку заранее.':'Отпускай, если натяжение дойдёт до красной зоны.')}
    else{label('phase','РЫБА УСПОКОИЛАСЬ');label('tip','Подматывай, пока она не набрала силы для нового рывка.')}}
 }}
function background(){const map=M(),picture=img('assets/scenes/'+G.map+'.webp');if(!cover(picture)){const gradient=g.createLinearGradient(0,0,0,H);gradient.addColorStop(0,map.season==='Зима'?'#8499a7':'#77b9cf');gradient.addColorStop(.4,'#427783');gradient.addColorStop(1,'#0c3445');g.fillStyle=gradient;g.fillRect(0,0,W,H)}
 const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(5,15,27,.27)');shade.addColorStop(.23,'rgba(0,0,0,0)');shade.addColorStop(.69,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(2,13,22,.22)');g.fillStyle=shade;g.fillRect(0,0,W,H);
 if(!map.ice){g.save();g.beginPath();g.rect(0,H*map.water,W,H*(1-map.water));g.clip();
 for(let i=0;i<44;i++){const k=(i+.5)/44,y=H*(map.water+.03+k*(.94-map.water));const speed=8+26*k+map.current*20;const x=((Math.sin(i*11.8)*300+now*speed)%(W+140)+W+140)%(W+140)-70;const length=(11+56*k)*(.7+.3*Math.cos(i*4.9));g.globalAlpha=.05+k*.09;g.strokeStyle=i%3?'#e4f7ed':'#183b45';g.lineWidth=.6+k;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+length*.53,y+Math.sin(now*3+i)*1.3,x+length,y);g.stroke()}g.restore()}}
function drawSites(){
 const m=M();if(G.mode==='fight'||G.mode==='caught')return;
 for(let i=0;i<m.spots.length;i++){
  const site=m.spots[i],p=coords(site),a=activity(i),t=now+i*1.4,k=(t%3.2)/3.2;
  g.save();const size=10+(a*.5+k)*27;
  g.globalAlpha=(1-k)*(.11+a*.48);
  g.strokeStyle=m.ice?'#d8f0fe':'#e2fae9';g.lineWidth=.75+a*.8;
  g.beginPath();g.ellipse(p.x,p.y,size,size*.32,0,0,TAU);g.stroke();
  // Surface movement only occurs at active habitat nodes.
  if(a>.67){g.globalAlpha=(a-.5)*.52;g.fillStyle=m.ice?'#e2f3fb':'#ecf5e9';
   for(let j=0;j<5;j++){const x=p.x+Math.sin(t*2.9+j*2.4)*11,y=p.y+Math.cos(t*2.1+j)*3;
    g.beginPath();g.arc(x,y,1+Math.sin(j+t)*.4,0,TAU);g.fill()}}
  if(G.mode==='ready'){
   const chosen=G.spot===site;
   if(chosen){g.globalAlpha=.76;g.strokeStyle='#ffe4a8';g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y,33,11,0,0,TAU);g.stroke()}
   g.globalAlpha=.85;g.textAlign='center';g.font='800 11px system-ui';g.strokeStyle='#062834';g.lineWidth=3;
   g.strokeText(site[0],p.x,p.y-20);g.fillStyle=chosen?'#ffdb99':'#e8fff1';g.fillText(site[0],p.x,p.y-20)
  }
  g.restore();
 }
 if(G.mode==='ready'&&G.aim){
  const p=G.aim,t=now,r=12+Math.sin(t*3)*1.6;
  g.save();g.lineWidth=2;g.strokeStyle='#f7d795';g.globalAlpha=.94;
  g.beginPath();g.arc(p.x,p.y,r,0,TAU);g.stroke();
  g.beginPath();g.moveTo(p.x-r-8,p.y);g.lineTo(p.x-r+1,p.y);
  g.moveTo(p.x+r-1,p.y);g.lineTo(p.x+r+8,p.y);
  g.moveTo(p.x,p.y-r-8);g.lineTo(p.x,p.y-r+1);
  g.moveTo(p.x,p.y+r-1);g.lineTo(p.x,p.y+r+8);g.stroke();g.restore();
 }
}
function drawEffects(){g.save();for(const r of G.foam){const k=r.t/r.ttl,sz=4+k*(30+r.p*24);g.strokeStyle='#e2f6f2';g.globalAlpha=(1-k)*.54;g.lineWidth=1.1;g.beginPath();g.ellipse(r.x,r.y,sz,sz*.32,0,0,TAU);g.stroke()}for(const d of G.drops){g.fillStyle='#e9f8ef';g.globalAlpha=1-d.t/d.ttl;g.beginPath();g.arc(d.x,d.y,1.6,0,TAU);g.fill()}g.restore()}
function iceHole(p){g.save();g.fillStyle='rgba(227,242,250,.95)';g.beginPath();g.ellipse(p.x,p.y,25,12,0,0,TAU);g.fill();g.fillStyle='#12354a';g.beginPath();g.ellipse(p.x,p.y,19,7,0,0,TAU);g.fill();g.strokeStyle='#a8d4df';g.lineWidth=1.5;g.stroke();g.restore()}
function fishAt(x,y,opacity,size,rot){
 if(!G.bite||!F[G.bite.id])return;
 const sprite=img('assets/fish/'+G.bite.id+'.webp');
 if(!sprite.complete||!sprite.naturalWidth)return;
 const aspect=sprite.naturalHeight/sprite.naturalWidth;
 g.save();g.globalAlpha=opacity;g.translate(x,y);g.rotate(rot||0);g.scale(G.fishFlip,1);
 g.drawImage(sprite,-size/2,-size*aspect/2,size,size*aspect);g.restore();
}
function tackle(){
 const map=M(),phase=G.mode,active=phase!=='ready'&&phase!=='caught';
 const p=point();let target={x:p.x,y:p.y};
 if(phase==='fly'){
  const k=clamp(G.flight,0,1);
  target={x:lerp(W*.83,p.x,k),y:lerp(H*.84,p.y,k)-Math.sin(k*Math.PI)*H*.23};
 }
 if(active&&map.ice)iceHole(p);
 if(active&&!map.ice){
  // The ONE actual float, clipped by the waterline as it sinks.
  if(phase==='nibble'||phase==='wait'||phase==='take'){
   const h=44,w=12,wiggle=phase==='nibble'?Math.sin(G.nibble*14)*3:Math.sin(now*1.9)*1.2;
   const sink=phase==='take'?G.take*32:0;
   const bob=img('assets/equipment/float_round.png');
   g.save();g.beginPath();g.rect(target.x-25,target.y-h-3,50,h+4);g.clip();
   g.translate(target.x,target.y+wiggle+sink);g.rotate(phase==='nibble'?Math.sin(G.nibble*9)*.095:0);
   if(bob.complete&&bob.naturalWidth)g.drawImage(bob,-w/2,-h*.78,w,h);
   else{g.fillStyle='#fff9dc';g.fillRect(-3,-20,6,18);g.fillStyle='#ed512e';g.fillRect(-3,-34,6,14)}
   g.restore();
   g.globalAlpha=.25;g.strokeStyle='#e7fcf3';g.lineWidth=.8;
   g.beginPath();g.ellipse(target.x,target.y,10+Math.sin(now*1.9)*2,3,0,0,TAU);g.stroke();g.globalAlpha=1;
  }
  if(phase==='fly'){
   g.fillStyle='#fff0c7';g.beginPath();g.arc(target.x,target.y,3,0,TAU);g.fill();
  }
 }
 if(phase==='nibble'||phase==='take'){
  const k=phase==='take'?1:clamp(G.nibble/1.45,0,1);
  const x=p.x+(1-k)*44,y=p.y+14+Math.sin(now*3)*2;
  // The fish is just below the surface, lightly obscured by water.
  fishAt(x,y,(.12+k*.18),Math.min(45,24+G.bite.kg*4),Math.sin(now*2)*.06);
 }
 if(phase==='fight'){
  const k=clamp(1-G.distance/20,0,1),p=point();
  const swim=Math.sin(now*(G.run>0?7.4:4.2));
  const x=p.x+Math.sin(now*1.85)*Math.min(50,15+G.distance*2)+G.rodAngle*20;
  const y=p.y+22+Math.cos(now*2.1)*3-k*11;
  G.fishVisualX=x;G.fishVisualY=y;
  if(G.distance<10||G.run>.25){
   const size=clamp(35+G.bite.kg*10+(1-G.stamina)*11,45,150);
   const visible=G.distance<4?.8:.34;
   fishAt(x,y,visible,size,swim*.14);
   if(G.distance<5&&Math.sin(now*8)> .98&&Math.random()<.18){drawRing(x,y,.62);G.shake=Math.max(G.shake,.6)}
  }
 }
 // Authentic continuous rod sprite from the original art library, scaled as
 // one unit. No segmented rods, hanging cylinder, or disconnected reel.
 const base={x:W*.92,y:H*1.045};
 const tip=map.ice?{x:W*(.60+G.rodAngle*.09),y:H*.60-G.jig*14}:{x:W*(.31+G.rodAngle*.14),y:H*.315+(phase==='fight'?G.tension*H*.06:0)-(phase==='fly'?Math.sin(G.flight*Math.PI)*H*.082:0)};
 const rodName=map.ice?'ice':G.bait==='jig'?'spin':'float';
 const specs={float:{tipX:59,baseX:1108,axisY:112,reelX:818,reelY:206},spin:{tipX:57,baseX:836,axisY:132,reelX:567,reelY:208},ice:{tipX:920,baseX:1390,axisY:53,reelX:1202,reelY:145}};
 const rod=img('assets/rods/'+rodName+'.webp'),a=specs[rodName],dx=base.x-tip.x,dy=base.y-tip.y,
 length=Math.hypot(dx,dy),factor=length/(a.baseX-a.tipX),angle=Math.atan2(dy,dx);
 g.save();g.translate(base.x,base.y);g.rotate(angle);
 if(rod.complete&&rod.naturalWidth){g.scale(factor,factor);g.drawImage(rod,-a.baseX,-a.axisY,1440,300)}
 else{g.strokeStyle='#d6cfb5';g.lineWidth=5;g.beginPath();g.moveTo(0,0);g.lineTo(-length,0);g.stroke()}
 g.restore();
 if(active&&phase!=='drill'){
  const toward=phase==='fight'?{x:G.fishVisualX||target.x,y:G.fishVisualY||target.y}:target;
  const slack=phase==='fight'?(1-G.tension)*12:13;
  g.save();g.lineWidth=1.6;g.strokeStyle='rgba(12,36,41,.55)';g.beginPath();g.moveTo(tip.x,tip.y);
  g.quadraticCurveTo(lerp(tip.x,toward.x,.6),lerp(tip.y,toward.y,.54)+slack,toward.x,toward.y);g.stroke();
  g.strokeStyle='rgba(238,251,240,.8)';g.lineWidth=.68;g.stroke();g.restore();
 }
}
function render(){g.save();if(G.shake>0)g.translate(rand(-G.shake,G.shake),rand(-G.shake,G.shake));background();drawSites();drawEffects();tackle();g.restore()}
function loop(ms){const dt=clamp((ms-last)/1000,0,.06);last=ms;if($('mapScreen').hidden&&$('catchScreen').hidden&&$('gearScreen').hidden)physics(dt);else now+=Math.min(dt,.015);render();requestAnimationFrame(loop)}
window.Fishing2={maps:MAPS,fish:F,game:G,save,changeMap,startCast,strike,caught,lost,physics,nearest,retry,activity,aimAt,chooseFish,chooseCastTime,tab};
Object.keys(MAPS).forEach(k=>img('assets/scenes/'+k+'.webp'));img('assets/equipment/float_round.png');['float','ice','spin'].forEach(mode=>img('assets/rods/'+mode+'.webp'));
changeMap(G.map);$('mapScreen').hidden=false;drawCards();requestAnimationFrame(loop);
})();
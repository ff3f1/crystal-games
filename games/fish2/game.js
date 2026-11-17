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
function persist(){try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}}
let W=390,H=844,DPR=1,now=0,last=performance.now(),timer=null,audio=null,bus=null,press=false,touchStart=0,touchX=0,surfaceTouch=false;
const imgs={};
function img(path){if(!imgs[path]){const image=new Image();image.src=path;imgs[path]=image}return imgs[path]}
function cover(image){if(!image||!image.complete||!image.naturalWidth)return false;const scale=Math.max(W/image.width,H/image.height);g.drawImage(image,(W-image.width*scale)*.5,(H-image.height*scale)*.5,image.width*scale,image.height*scale);return true}
const G={map:MAPS[save.last]?save.last:'pond_summer',mode:'ready',spot:null,position:null,bait:'worm',flight:0,wait:0,biteAt:4,bite:null,nibble:0,take:0,tension:.42,stress:0,slack:0,stamina:1,distance:13,fishPhase:0,runTime:2,run:0,rodAngle:0,rodSpeed:0,rodTarget:0,shake:0,jig:0,foam:[],drops:[],startClock:0};
function M(){return MAPS[G.map]}
function size(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);g.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener('resize',size,{passive:true});size();
function soundContext(){if(!save.sound)return null;try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;audio=new A();bus=audio.createGain();bus.gain.value=.14;bus.connect(audio.destination)}if(audio.state==='suspended')audio.resume();return audio}catch(e){return null}}
function beep(freq,duration,volume,end){const a=soundContext();if(!a)return;const t=a.currentTime,o=a.createOscillator(),v=a.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(end||freq,25),t+duration);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(volume||.2,t+.017);v.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(v);v.connect(bus);o.start(t);o.stop(t+duration+.01)}
function hiss(duration,power){const a=soundContext();if(!a)return;const count=Math.ceil(duration*a.sampleRate),buf=a.createBuffer(1,count,a.sampleRate),v=buf.getChannelData(0);for(let i=0;i<count;i++)v[i]=(Math.random()*2-1)*Math.exp(-i/count*3);const s=a.createBufferSource(),f=a.createBiquadFilter(),gain=a.createGain();s.buffer=buf;f.type='lowpass';f.frequency.value=1100;gain.gain.value=power;s.connect(f);f.connect(gain);gain.connect(bus);s.start()}
function audioCue(which){if(which==='cast'){hiss(.24,.28);beep(310,.12,.16,115)}if(which==='splash'){hiss(.34,.33);beep(150,.16,.15,72)}if(which==='nibble')beep(490,.07,.1,430);if(which==='take'){beep(700,.11,.17,940);setTimeout(()=>beep(920,.1,.13,1140),120)}if(which==='strike')beep(320,.2,.23,115);if(which==='lose')beep(300,.39,.16,100);if(which==='catch'){beep(515,.15,.21,750);setTimeout(()=>beep(790,.19,.18,1140),140)}}
function vibrate(t){try{if(navigator.vibrate)navigator.vibrate(t)}catch(e){}}
function label(id,text){if($(id).textContent!==text)$(id).textContent=text}
function toast(text){const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,2200)}
function refresh(){const map=M(),mode=G.mode;
 label('location',map.name+'  /  '+map.season);label('coins','✦ '+save.coins);label('baitTitle',B[G.bait][0]);
 const title={ready:map.ice?'Выбери место для лунки':'Найди перспективное место',fly:'Заброс…',drill:'Бурим лунку…',wait:map.ice?'Играй мормышкой':'Смотри на поплавок',nibble:'Осторожно, рыба пробует…',take:'ПОКЛЁВКА!',fight:'РЫБА НА КРЮЧКЕ!',caught:'Отличный улов!'}[mode];
 const explain={ready:'Рябь, камни и глубина подсказывают, куда бросать.',fly:'Снасть летит в выбранную точку.',drill:'Зимняя рыба живёт на разных глубинах.',wait:(G.spot?G.spot[0]+' · ':'')+(map.ice?'Коротко нажимай кнопку «Играть»':'Не торопись: сначала рыба осторожно трогает приманку.'),nibble:'Не подсекай на первом движении. Дождись настоящей потяжки.',take:'Время подсечь! Нажми кнопку или смахни вверх.',fight:'Удерживай подмотку. При рывке отпускай, чтобы не оборвать леску.',caught:'Новая добыча и награда за терпение.'}[mode];
 label('phase',title);label('tip',explain);
 const action=$('action');label('action',{ready:map.ice?'БУРИТЬ':'ЗАБРОСИТЬ',fly:'ЛЕТИТ…',drill:'БУРЕНИЕ…',wait:map.ice?'ИГРАТЬ':'ПЕРЕЗАБРОС',nibble:'ЖДАТЬ…',take:'ПОДСЕЧЬ!',fight:'ПОДМОТКА',caught:'ЕЩЁ РАЗ'}[mode]);action.disabled=mode==='fly'||mode==='drill'||mode==='nibble'||mode==='caught';action.classList.toggle('strike',mode==='take');action.classList.toggle('reel',mode==='fight');$('fightInfo').hidden=mode!=='fight';
 label('instruction',mode==='fight'?'Зелёная зона — подматывай. Красная — отпускай.':mode==='ready'?'Коснись воды или нажми кнопку':'Одна сцена — один поплавок. Никакого второго зума.');label('warning',mode==='take'?'● ПОДСЕЧЬ СЕЙЧАС!':'');}
function coords(site){return {x:site[1]*W,y:site[2]*H}}
function nearest(x,y){let best=M().spots[0],d=Infinity;for(const s of M().spots){const p=coords(s),dd=Math.hypot(x-p.x,y-p.y);if(dd<d){d=dd;best=s}}return best}
function point(){return G.position||coords(M().spots[1])}
function drawRing(x,y,p){G.foam.push({x,y,p:p||.55,t:0,ttl:rand(.65,1.25)});if(G.foam.length>60)G.foam.shift()}
function splash(x,y){drawRing(x,y,.75);for(let i=0;i<15;i++)G.drops.push({x,y,vx:rand(-56,56),vy:rand(-130,-55),t:0,ttl:rand(.35,.75)});audioCue('splash')}
function changeMap(key){if(!MAPS[key])return;G.map=key;save.last=key;persist();G.spot=null;G.position=null;G.wait=0;G.bite=null;G.rodAngle=0;G.mode='ready';G.bait=M().sea?'shrimp':'worm';G.foam=[];G.drops=[];press=false;$('mapScreen').hidden=true;$('catchScreen').hidden=true;drawCards();refresh();toast(M().name+' · '+M().season)}
function drawCards(){const box=$('mapList');box.innerHTML='';for(const key of Object.keys(MAPS)){const map=MAPS[key],b=document.createElement('button');b.className='map-card'+(key===G.map?' selected':'');b.type='button';const pic=document.createElement('img');pic.src='assets/scenes/'+key+'.webp';pic.alt='';b.appendChild(pic);const shade=document.createElement('span');shade.className='shade';b.appendChild(shade);const season=document.createElement('span');season.className='card-season';season.textContent=map.season==='Зима'?'❄ ЗИМА':'☀ ЛЕТО';b.appendChild(season);const inside=document.createElement('span');inside.className='card-inner';inside.innerHTML='<strong>'+map.name+'</strong><small>'+map.habitat+'</small>';b.appendChild(inside);b.onclick=()=>changeMap(key);box.appendChild(b)}}
function mapsOpen(){press=false;$('mapScreen').hidden=false;drawCards()}
function pickBait(){const options=M().sea?['shrimp','jig','worm']:['worm','corn','jig'],at=options.indexOf(G.bait);G.bait=options[(at+1)%options.length];toast(B[G.bait][0]+': '+B[G.bait][1]);refresh()}
function startCast(x,y){if(G.mode!=='ready')return;const m=M();G.spot=nearest(x,y);G.position=m.ice?coords(G.spot):{x:clamp(x,W*.1,W*.9),y:clamp(y,H*(m.water+.07),H*.83)};G.flight=0;G.mode=m.ice?'drill':'fly';G.wait=0;audioCue('cast');refresh();}
function land(){G.mode='wait';G.wait=0;G.biteAt=rand(2.6,5.8);if(G.spot&&M().ice)G.biteAt*=.85;if(M().ice){drawRing(point().x,point().y,.55)}else splash(point().x,point().y);refresh()}
function chooseFish(){let pool=(G.spot||M().spots[1])[3].split(',').filter(id=>F[id]&&F[id][3].split(',').includes(G.bait));if(!pool.length)return null;return pool[Math.floor(rand(0,pool.length))]}
function startNibble(){const id=chooseFish();if(!id){G.wait=0;G.biteAt=rand(2.4,4);toast('Здесь эта насадка не работает. Попробуй другую.');return}G.bite={id:id,name:F[id][0],kg:Math.max(.07,F[id][1]*rand(.55,1.55)),power:F[id][2]};G.mode='nibble';G.nibble=0;audioCue('nibble');refresh()}
function startTake(){G.mode='take';G.take=0;drawRing(point().x,point().y,.45);audioCue('take');vibrate(25);refresh()}
function strike(){if(G.mode==='nibble'){toast('Рано! Рыба только пробует наживку.');G.nibble=Math.max(0,G.nibble-.32);audioCue('strike');return}if(G.mode!=='take')return;G.mode='fight';G.stamina=1;G.tension=.39;G.distance=10+G.bite.kg*3;G.stress=0;G.slack=0;G.runTime=rand(1.3,2.7);G.run=0;G.shake=5;press=false;audioCue('strike');vibrate([35,20,25]);refresh()}
function retry(){G.mode='ready';G.bite=null;G.spot=null;G.position=null;press=false;$('catchScreen').hidden=true;refresh()}
function lost(message){G.mode='ready';G.bite=null;G.spot=null;G.position=null;press=false;G.shake=4;audioCue('lose');toast(message);refresh()}
function caught(){G.mode='caught';press=false;const b=G.bite,m=M(),weight=+b.kg.toFixed(2),reward=Math.floor(15+weight*17+(m.sea?12:0));const record=weight>(save.records[b.id]||0);if(record)save.records[b.id]=weight;save.coins+=reward;save.catches++;save.xp+=Math.round(weight*12+6);persist();label('catchSpecies',b.name);label('catchWeight',weight.toFixed(2).replace('.',',')+' кг');label('catchReward','+'+reward+' ✦  ·  '+m.name+'  ·  '+m.season);label('catchRecord',record?'★ НОВЫЙ ЛИЧНЫЙ РЕКОРД':'Улов № '+save.catches);$('catchFish').src='assets/fish/'+b.id+'.webp';$('catchScreen').hidden=false;audioCue('catch');vibrate([45,20,40]);refresh()}
function actionDown(){soundContext();const m=M();if(G.mode==='ready'){const p=point();startCast(p.x,p.y)}
 else if(G.mode==='wait'){if(m.ice){G.jig=1;G.wait+=.3;drawRing(point().x,point().y,.1);beep(230,.1,.1,300)}else retry()}
 else if(G.mode==='take'||G.mode==='nibble')strike();
 else if(G.mode==='fight'){press=true;$('action').classList.add('held')}
 else if(G.mode==='caught')retry()}
function actionUp(){press=false;$('action').classList.remove('held')}
$('action').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{$('action').setPointerCapture(e.pointerId)}catch(_){ }actionDown()});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$('action').addEventListener(ev,actionUp));
$('bait').onclick=pickBait;$('mapsTop').onclick=mapsOpen;$('mapsBottom').onclick=mapsOpen;$('closeMaps').onclick=()=>$('mapScreen').hidden=true;
$('again').onclick=retry;$('changeMap').onclick=()=>{retry();mapsOpen()};
$('sound').onclick=()=>{save.sound=!save.sound;persist();label('sound',save.sound?'♫':'×');toast(save.sound?'Звук включён':'Звук выключен')};label('sound',save.sound?'♫':'×');
cv.addEventListener('pointerdown',e=>{if(!$('mapScreen').hidden||!$('catchScreen').hidden)return;e.preventDefault();soundContext();touchStart=e.clientY;touchX=e.clientX;surfaceTouch=true;if(G.mode==='ready')startCast(e.clientX,e.clientY)});
cv.addEventListener('pointermove',e=>{if(surfaceTouch&&G.mode==='fight')G.rodTarget=clamp((e.clientX-touchX)/(W*.32),-1,1)});
cv.addEventListener('pointerup',e=>{if(!surfaceTouch)return;surfaceTouch=false;if((G.mode==='take'||G.mode==='nibble')&&touchStart-e.clientY>25)strike();G.rodTarget=0});
cv.addEventListener('pointercancel',()=>{surfaceTouch=false;G.rodTarget=0});
document.addEventListener('visibilitychange',()=>{if(document.hidden){press=false;last=performance.now()}});
function physics(dt){now+=dt;G.shake=Math.max(0,G.shake-dt*26);G.jig=Math.max(0,G.jig-dt*1.7);
 G.rodSpeed+=(G.rodTarget-G.rodAngle)*dt*35;G.rodSpeed*=Math.exp(-dt*10);G.rodAngle+=G.rodSpeed*dt;
 for(const p of G.foam)p.t+=dt;G.foam=G.foam.filter(p=>p.t<p.ttl);
 for(const p of G.drops){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt}G.drops=G.drops.filter(p=>p.t<p.ttl);
 if(G.mode==='fly'||G.mode==='drill'){G.flight+=dt/(G.mode==='drill'?1.1:.7);if(G.flight>=1)land()}
 else if(G.mode==='wait'){G.wait+=dt*(1+G.jig*.24);if(G.wait>G.biteAt)startNibble()}
 else if(G.mode==='nibble'){G.nibble+=dt;if(G.nibble>1.1+G.bite.power*.35)startTake()}
 else if(G.mode==='take'){G.take+=dt;if(G.take>1.55)lost('Рыба ушла. В следующий раз подсекай на уверенной потяжке.')}
 else if(G.mode==='fight'){
  G.runTime-=dt;if(G.runTime<=0){G.run=rand(.7,1.18);G.runTime=rand(2.3,4);vibrate(40);drawRing(point().x,point().y,.85)}
  const running=G.run>.08;G.run=Math.max(0,G.run-dt);
  const pull=.12+G.bite.power*.14+(running?.52*G.bite.power:0);
  const target=clamp((press?.30:0)+pull,press?.12:.06,1.17);
  G.tension=lerp(G.tension,target,clamp(dt*(running?3.3:2),0,1));
  if(press&&!running&&G.tension<.86){G.stamina=Math.max(0,G.stamina-dt*(.11+.10/Math.sqrt(Math.max(.2,G.bite.kg))));G.distance=Math.max(0,G.distance-dt*(1.75+.8/G.bite.power))}
  else if(running){G.distance+=dt*G.bite.power*.5;G.shake=1.3}
  if(G.tension>.92)G.stress+=dt;else G.stress=Math.max(0,G.stress-dt*2);
  if(G.tension<.14)G.slack+=dt;else G.slack=Math.max(0,G.slack-dt*2);
  $('tensionNeedle').style.left=(clamp(G.tension,0,1)*100)+'%';$('stamina').style.width=((1-G.stamina)*100)+'%';label('distance',Math.ceil(G.distance)+' м');
  if(G.stress>.78)lost('Обрыв! При мощном рывке отпускай подмотку.');
  else if(G.slack>1.3)lost('Сход! Леска слишком долго провисала.');
  else if(G.distance<1.5&&G.stamina<.18)caught();
  if(G.mode==='fight'){
    if(running){label('phase','МОЩНЫЙ РЫВОК!');label('tip','Отпусти подмотку. Рыбе нужно дать стянуть немного лески.')}
    else if(press){label('phase','ПОДТЯГИВАЕМ РЫБУ');label('tip','Отпускай, если натяжение дойдёт до красной зоны.')}
    else{label('phase','РЫБА УСПОКОИЛАСЬ');label('tip','Подматывай, пока она не набрала силы для нового рывка.')}}
 }}
function background(){const map=M(),picture=img('assets/scenes/'+G.map+'.webp');if(!cover(picture)){const gradient=g.createLinearGradient(0,0,0,H);gradient.addColorStop(0,map.season==='Зима'?'#8499a7':'#77b9cf');gradient.addColorStop(.4,'#427783');gradient.addColorStop(1,'#0c3445');g.fillStyle=gradient;g.fillRect(0,0,W,H)}
 const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(5,15,27,.27)');shade.addColorStop(.23,'rgba(0,0,0,0)');shade.addColorStop(.69,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(2,13,22,.22)');g.fillStyle=shade;g.fillRect(0,0,W,H);
 if(!map.ice){g.save();g.beginPath();g.rect(0,H*map.water,W,H*(1-map.water));g.clip();
 for(let i=0;i<44;i++){const k=(i+.5)/44,y=H*(map.water+.03+k*(.94-map.water));const speed=8+26*k+map.current*20;const x=((Math.sin(i*11.8)*300+now*speed)%(W+140)+W+140)%(W+140)-70;const length=(11+56*k)*(.7+.3*Math.cos(i*4.9));g.globalAlpha=.05+k*.09;g.strokeStyle=i%3?'#e4f7ed':'#183b45';g.lineWidth=.6+k;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+length*.53,y+Math.sin(now*3+i)*1.3,x+length,y);g.stroke()}g.restore()}}
function drawSites(){const m=M();if(G.mode==='fight'||G.mode==='caught')return;for(let i=0;i<m.spots.length;i++){const s=m.spots[i],p=coords(s),t=now+i*1.29,k=(t%3.3)/3.3,r=11+k*29;g.save();g.globalAlpha=(1-k)*.45;g.strokeStyle=m.ice?'#d7edf9':'#e2f9ea';g.lineWidth=1.35;g.beginPath();g.ellipse(p.x,p.y,r,r*.34,0,0,TAU);g.stroke();
 g.globalAlpha=(.12+.3*Math.pow(Math.max(0,Math.sin(t*3.3)),4));g.fillStyle=m.ice?'#edf7f9':'#f3f8e9';for(let j=0;j<3;j++){g.beginPath();g.arc(p.x+Math.cos(j*3+t)*6,p.y+Math.sin(j*4+t)*2,1.4,0,TAU);g.fill()}
 if(G.mode==='ready'){g.globalAlpha=.95;g.textAlign='center';g.font='800 11px system-ui';g.strokeStyle='#092a37';g.lineWidth=3;g.strokeText(s[0],p.x,p.y-18);g.fillStyle='#f8fbf5';g.fillText(s[0],p.x,p.y-18)}g.restore()}}
function drawEffects(){g.save();for(const r of G.foam){const k=r.t/r.ttl,sz=4+k*(30+r.p*24);g.strokeStyle='#e2f6f2';g.globalAlpha=(1-k)*.54;g.lineWidth=1.1;g.beginPath();g.ellipse(r.x,r.y,sz,sz*.32,0,0,TAU);g.stroke()}for(const d of G.drops){g.fillStyle='#e9f8ef';g.globalAlpha=1-d.t/d.ttl;g.beginPath();g.arc(d.x,d.y,1.6,0,TAU);g.fill()}g.restore()}
function iceHole(p){g.save();g.fillStyle='rgba(227,242,250,.95)';g.beginPath();g.ellipse(p.x,p.y,25,12,0,0,TAU);g.fill();g.fillStyle='#12354a';g.beginPath();g.ellipse(p.x,p.y,19,7,0,0,TAU);g.fill();g.strokeStyle='#a8d4df';g.lineWidth=1.5;g.stroke();g.restore()}
function tackle(){const map=M(),phase=G.mode,active=phase!=='ready'&&phase!=='caught';let p=point(),target={x:p.x,y:p.y};if(phase==='fly'){const k=clamp(G.flight,0,1);target={x:lerp(W*.85,p.x,k),y:lerp(H*.75,p.y,k)-Math.sin(k*Math.PI)*H*.20}}
 if(active&&map.ice)iceHole(p);
 if(active&&!map.ice){if(phase==='nibble'||phase==='wait'||phase==='take'){const h=37,w=10,wiggle=phase==='nibble'?Math.sin(G.nibble*15)*3:Math.sin(now*2)*.9,sink=phase==='take'?G.take*28:0;const bob=img('assets/equipment/float_round.png');g.save();g.beginPath();g.rect(target.x-25,target.y-h-3,50,h+4);g.clip();g.translate(target.x,target.y+wiggle+sink);g.rotate(phase==='nibble'?Math.sin(G.nibble*8)*.07:0);if(bob.complete&&bob.naturalWidth)g.drawImage(bob,-w/2,-h*.83,w,h);else{g.fillStyle='#fff9dd';g.fillRect(-3,-21,6,18);g.fillStyle='#ee512a';g.fillRect(-3,-32,6,11)}g.restore()}
 if(phase==='fly'){g.fillStyle='#fff4cf';g.beginPath();g.arc(target.x,target.y,3.1,0,TAU);g.fill()}}
 const base={x:W*.94,y:H*1.06},tip=map.ice?{x:W*(.58+G.rodAngle*.12),y:H*.59-G.jig*12}:{x:W*(.35+G.rodAngle*.16),y:H*.34+(phase==='fight'?G.tension*H*.045:0)-(phase==='fly'?Math.sin(G.flight*Math.PI)*H*.08:0)};
 const bend=phase==='fight'?G.tension*32:phase==='take'?10:0,cx=lerp(base.x,tip.x,.48)+bend*.5,cy=lerp(base.y,tip.y,.48)+bend;
 g.save();g.lineCap='round';g.strokeStyle='#17262b';g.lineWidth=14;g.beginPath();g.moveTo(base.x,base.y);g.lineTo(lerp(base.x,tip.x,.25),lerp(base.y,tip.y,.25));g.stroke();
 const grad=g.createLinearGradient(base.x,base.y,tip.x,tip.y);grad.addColorStop(0,'#273938');grad.addColorStop(.35,'#9f9e90');grad.addColorStop(.66,'#263f43');grad.addColorStop(1,'#d2dcd2');g.strokeStyle=grad;g.lineWidth=map.ice?4:6;g.beginPath();g.moveTo(base.x,base.y);g.quadraticCurveTo(cx,cy,tip.x,tip.y);g.stroke();
 g.strokeStyle='#e0dfd5';g.lineWidth=.8;g.beginPath();g.moveTo(base.x,base.y);g.quadraticCurveTo(cx-2,cy-2,tip.x,tip.y);g.stroke();
 if(!map.ice){const rx=lerp(base.x,tip.x,.21),ry=lerp(base.y,tip.y,.21);g.fillStyle='#14313a';g.strokeStyle='#bfc6b7';g.lineWidth=2;g.beginPath();g.ellipse(rx,ry,15,11,.6,0,TAU);g.fill();g.stroke();g.save();g.translate(rx,ry);g.rotate(press?now*10:now*.07);g.strokeStyle='#e2cfa3';g.lineWidth=2.2;for(let i=0;i<4;i++){const a=i*Math.PI/2;g.beginPath();g.moveTo(Math.cos(a)*3,Math.sin(a)*3);g.lineTo(Math.cos(a)*9,Math.sin(a)*9);g.stroke()}g.restore()}
 if(active&&phase!=='drill'){g.strokeStyle='rgba(17,41,44,.74)';g.lineWidth=1.7;g.beginPath();g.moveTo(tip.x,tip.y);g.quadraticCurveTo(lerp(tip.x,target.x,.54),lerp(tip.y,target.y,.56)+(phase==='fight'?3:12),target.x,target.y);g.stroke();g.strokeStyle='rgba(236,252,237,.7)';g.lineWidth=.6;g.stroke()}g.restore();
 if(phase==='nibble'||phase==='take'){const k=phase==='take'?1:clamp(G.nibble/1.4,0,1);g.fillStyle='rgba(7,29,37,'+(.13+k*.21)+')';g.beginPath();g.ellipse(p.x+(1-k)*40,p.y+14,14+G.bite.kg*1.4,6,0,0,TAU);g.fill()}
 if(phase==='fight'&&Math.sin(now*14)>.95)drawRing(p.x+rand(-20,20),p.y,.3);
}
function render(){g.save();if(G.shake>0)g.translate(rand(-G.shake,G.shake),rand(-G.shake,G.shake));background();drawSites();drawEffects();tackle();g.restore()}
function loop(ms){const dt=clamp((ms-last)/1000,0,.06);last=ms;if($('mapScreen').hidden&&$('catchScreen').hidden)physics(dt);else now+=Math.min(dt,.015);render();requestAnimationFrame(loop)}
window.Fishing2={maps:MAPS,fish:F,game:G,save,changeMap,startCast,strike,caught,lost,physics,nearest,retry};
Object.keys(MAPS).forEach(k=>img('assets/scenes/'+k+'.webp'));img('assets/equipment/float_round.png');
changeMap(G.map);$('mapScreen').hidden=false;drawCards();requestAnimationFrame(loop);
})();
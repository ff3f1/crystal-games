/* New interface, expedition goals and catch diary over the original game engine. */
(function(FZ){
 'use strict';
 const G=FZ.Game,UI=FZ.UI,U=FZ.U,$=U.$,ic=UI.ic;
 const baseSheet=UI.sheet;let imageObserver=null;
 UI.sheet=function(html,onClose){
  if(imageObserver)imageObserver.disconnect();
  const sh=baseSheet(html,()=>{if(imageObserver)imageObserver.disconnect();if(onClose)onClose()});
  const lazy=[...sh.querySelectorAll('img[data-src]')];
  if(window.IntersectionObserver){
   imageObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.src=e.target.dataset.src;imageObserver.unobserve(e.target)}},{root:sh.querySelector('.scroll')||null,rootMargin:'120px'});
   lazy.forEach(im=>imageObserver.observe(im));
  }else lazy.forEach(im=>im.src=im.dataset.src);
  return sh;
 };
 const photo=(id,season)=>FZ.Cinematic.urlFor(id,season||'summer');
 const speciesImage=s=>'assets/fish-hd/'+s.id+'.webp';
 const closeBack=()=>{if(UI.menuOpen)UI.showMenu()};
 UI.showMenu=function(){
  FZ.Input&&FZ.Input.actionUp();const st=G.state(),s=G.sess(),ov=$('ovMenu');
  if(s.duel){UI.pauseDuel();return}
  const best=FZ.Duel.best(FZ.Duel.today());
  const duelLabel=best?'Твой рекорд · '+best.score.toLocaleString('ru-RU'):'Испытание дня';
  const tiles=[['mMap','map','Водоёмы'],['mShop','bag','Снасти'],['mAtlas','fish','Атлас рыб'],['mJourney','cup','Экспедиции'],['mJournal','book','Дневник'],['mQuests','list','Задания'],['mTour','star','Турнир дня'],['mForecast','wave','Гид по клёву'],['mSet','gear','Настройки']];
  const rewardReady=FZ.LOCATIONS.some(l=>{const q=FZ.Expeditions.challenge(l.id);return (st.journey.maps[l.id]||0)>=3&&!st.journey.claimed.includes(l.id)||q&&!q.claimed&&q.got===q.need});
  ov.style.backgroundImage='linear-gradient(180deg,#0b283b81,transparent 34%,#0d313767 52%,#102d35f7 88%),url("'+photo(s.loc.id,s.season)+'")';
  ov.innerHTML='<div class="lodge"><div class="lodge-title"><small>РЫБАЛКА</small><h1>Клюёт<span>!</span></h1></div><div class="lodge-bottom"><div class="lodge-profile"><span class="rank">'+st.lvl+'</span><div><b>'+FZ.titleOf(st.lvl)+'</b><small>'+st.stats.total+' уловов · '+Object.keys(st.caught).length+'/62 вида</small></div><strong>'+U.money(st.money)+'</strong></div><button class="go" id="mGo">'+(G.rig().state==='idle'||G.rig().state==='nohole'?'На рыбалку':'Продолжить рыбалку')+ic('play')+'<small>'+s.loc.n+' · '+FZ.SEASONS[s.season]+'</small></button><button class="duel-entry" id="mDuel">'+ic('cup')+'<span><b>Три заброса</b><small>'+duelLabel+'</small></span><i>›</i></button><div class="lodge-grid">'+tiles.map(t=>'<button class="tile" id="'+t[0]+'">'+(t[0]==='mJourney'&&rewardReady?'<i class="reward-dot" aria-label="Есть награда"></i>':'')+ic(t[1])+'<span>'+t[2]+'</span></button>').join('')+'</div><div class="lodge-footer"><button id="mHelp">Как играть</button></div></div></div>';
  ov.classList.add('on');$('hud').classList.add('hide');UI.menuOpen=true;
  UI.closeMenu=()=>{ov.classList.remove('on');$('hud').classList.remove('hide');UI.menuOpen=false};
  $('mGo').onclick=()=>{FZ.Sound.unlock();FZ.Sound.click();UI.closeMenu();UI.ambience()};
  const handlers={mDuel:UI.showDuel,mMap:UI.showMap,mShop:UI.showShop,mAtlas:UI.showAtlas,mJourney:UI.showJourney,mJournal:UI.showJournal,mQuests:UI.showQuests,mTour:UI.showTour,mForecast:UI.showGuide,mSet:UI.showSettings,mHelp:UI.showHelp};
  for(const id of Object.keys(handlers))$(id).onclick=()=>{FZ.Sound.unlock();FZ.Sound.click();handlers[id]()};
 };
 UI.showMap=function(seasonTab){
  let season=seasonTab||G.season(),filter='all';
  function draw(){
   const st=G.state(),list=FZ.LOCATIONS.filter(l=>filter==='all'||(filter==='sea'?l.openWinter:filter==='river'?!l.openWinter&&l.current>.3:!l.openWinter&&l.current<=.3)).slice().sort((a,b)=>a.lvl-b.lvl);
   const sh=UI.sheet('<div class="eyebrow">ОТ ПРУДА ДО ТИХОГО ОКЕАНА</div><h2>Выбери свой берег</h2><div class="sub">20 водоёмов, четыре сезона и разные характеры рыбы</div><div class="seg map-seasons">'+FZ.SEASON_ORDER.map(k=>'<button data-season="'+k+'" class="'+(season===k?'on':'')+'">'+FZ.SEASONS[k]+'</button>').join('')+'</div><div class="biomes">'+[['all','Все'],['river','Реки'],['lake','Озёра'],['sea','Море']].map(x=>'<button data-biome="'+x[0]+'" class="'+(filter===x[0]?'on':'')+'">'+x[1]+'</button>').join('')+'</div><div class="scroll map-grid">'+list.map(l=>{const locked=st.lvl<l.lvl;return '<button class="destination '+(locked?'locked':'')+'" data-travel="'+l.id+'" '+(locked?'disabled':'')+'><img loading="lazy" data-src="'+photo(l.id,season)+'" alt=""><div class="destination-shade"></div><small class="destination-level">'+(locked?ic('lock')+' УРОВЕНЬ '+l.lvl:Object.keys(l.fish).length+' ВИДОВ')+'</small><div class="destination-info"><b>'+l.n+'</b><span>'+l.reg+'</span><small>'+(season==='winter'?(l.openWinter?'Открытая вода':'Подлёдная ловля'):(l.openWinter?'Морская ловля':l.current>.3?'Течение · речная ловля':'Тихая вода · береговая ловля'))+(l.fee?' · '+l.fee+' ₽':'')+'</small></div></button>'}).join('')+'</div>',closeBack);
   sh.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>{season=b.dataset.season;draw()});sh.querySelectorAll('[data-biome]').forEach(b=>b.onclick=()=>{filter=b.dataset.biome;draw()});sh.querySelectorAll('[data-travel]').forEach(b=>b.onclick=()=>UI.travel(b.dataset.travel,season));
  }draw();
 };
 const travel=UI.travel;let travelling=false;
 UI.travel=async function(id,season){if(travelling)return;if(['fight','landing','result'].includes(G.rig().state)){UI.toast('Сначала закончи вываживание','bad');return}const loc=FZ.LOC[id];if(!loc)return;if(G.state().lvl<loc.lvl){UI.toast('Откроется с уровня '+loc.lvl);return}travelling=true;try{await travel(id,season)}finally{travelling=false}};
 UI.showAtlas=function() {
  const st=G.state();
  const filters=[['all','Все'],['unknown','Не пойманы'],['known','Пойманы']];
  const sh=UI.sheet('<h2>Атлас рыб</h2><div class="sub">'+Object.keys(st.caught).length+' из 62 видов. Коснись рыбы, чтобы узнать, где её искать.</div><div class="seg atlas-filters">'+filters.map(([id,name])=>'<button data-atlas="'+id+'" class="'+(id==='all'?'on':'')+'">'+name+'</button>').join('')+'</div><div class="scroll"><div class="agrid">'+FZ.SPECIES.map(s=>{
   const caught=!!st.caught[s.id],record=st.records[s.id];
   return '<button class="acard '+(caught?'known':'unknown')+'" data-sp="'+s.id+'"><img loading="lazy" data-src="'+speciesImage(s)+'" alt=""><div class="n">'+s.n+'</div><div class="c">'+(record?U.kg(record.w):caught?'Поймана':'Не поймана')+'</div></button>';
  }).join('')+'</div><p class="empty-state hide" id="atlasEmpty">В этой категории пока нет рыб</p></div>',closeBack);
  const cards=[...sh.querySelectorAll('[data-sp]')],tabs=[...sh.querySelectorAll('[data-atlas]')];
  for(const card of cards)card.onclick=()=>UI.showSpecies(card.dataset.sp);
  for(const tab of tabs)tab.onclick=()=>{
   const filter=tab.dataset.atlas;
   for(const t of tabs)t.classList.toggle('on',t===tab);
   for(const card of cards)card.classList.toggle('hide',filter!=='all'&&!card.classList.contains(filter));
   sh.querySelector('#atlasEmpty').classList.toggle('hide',cards.some(card=>!card.classList.contains('hide')));
   sh.querySelector('.scroll').scrollTop=0;
  };
 };
 UI.showSpecies=function(id){
  const s=FZ.SP[id],st=G.state(),rec=st.records[id],where=FZ.whereLives(id).map(k=>FZ.LOC[k].n),times=Object.keys(s.time).sort((a,b)=>s.time[b]-s.time[a]);
  UI.sheet('<div class="eyebrow">'+(st.caught[id]?'В ТВОЕЙ КОЛЛЕКЦИИ':'ЦЕЛЬ ДЛЯ БУДУЩЕГО УЛОВА')+'</div><div class="species-detail"><img src="'+speciesImage(s)+'" alt="'+s.n+'"><h2>'+s.n+'</h2><small>'+s.lat+'</small><p>'+s.desc+'</p><div class="facts"><span>Где искать</span><b>'+where.join(', ')+'</b><span>Наживки</span><b>'+FZ.bestBaits(s).join(', ')+'</b><span>Время</span><b>'+FZ.TIMES[times[0]]+'</b><span>Трофейный вес</span><b>от '+U.kg(s.trophy)+'</b>'+(rec?'<span>Личный рекорд</span><b>'+U.kg(rec.w)+' · '+(st.caught[id]||1)+' уловов</b>':'')+(s.release?'<span>Правило</span><b>Только отпускать</b>':'')+'</div><button class="btn brass" id="atlasBack">Вернуться в атлас</button></div>');$('atlasBack').onclick=UI.showAtlas;
 };
 UI.showSettings=function(){
  const st=G.state(),S=st.settings,v=S.volumes;
  const slider=(k,n)=>'<label class="volume-control">'+n+'<output id="'+k+'Value">'+Math.round(v[k]*100)+'%</output><input type="range" id="'+k+'Volume" data-volume="'+k+'" min="0" max="100" value="'+Math.round(v[k]*100)+'"></label>';
  const sh=UI.sheet('<div class="eyebrow">НАСТРОЙ СВОЮ РЫБАЛКУ</div><h2>Настройки</h2><div class="scroll">'+slider('music','Музыка')+slider('effects','Эффекты')+slider('nature','Дальние птицы')+'<div class="opt"><span>Вибрация</span><button class="sw '+(S.vibro?'on':'')+'" id="vibroToggle" aria-label="Вибрация"></button></div><h3>Качество изображения</h3><div class="seg">'+[['auto','Авто'],['hi','Чётко'],['mid','Средне'],['lo','Плавно']].map(x=>'<button data-quality="'+x[0]+'" class="'+(S.quality===x[0]?'on':'')+'">'+x[1]+'</button>').join('')+'</div><p class="quiet-note">Настрой звук и качество изображения под себя — выбранные параметры сохраняются.</p><button id="renewalHelp" class="btn ghost">'+ic('book')+' Как играть</button><button id="renewalRate" class="btn ghost">'+ic('star')+' Оценить в RuStore</button><div class="version-note">Рыбалка: Клюёт! 2.0.1<br>'+st.stats.total+' уловов · '+st.stats.kg.toFixed(1)+' кг · '+st.stats.released+' отпущено</div></div>',closeBack);
  sh.querySelectorAll('[data-volume]').forEach(el=>el.oninput=()=>{const k=el.dataset.volume;v[k]=Number(el.value)/100;$(k+'Value').value=el.value+'%';S.sound=true;S.music=v.music>0;FZ.Sound.setOn(true);FZ.Sound.setMusic(S.music);FZ.Sound.setVolumes(v);FZ.Sound.unlock();G.save(true)});
  $('vibroToggle').onclick=()=>{S.vibro=!S.vibro;$('vibroToggle').classList.toggle('on',S.vibro);G.save(true)};
  sh.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>{S.quality=b.dataset.quality;if(S.quality==='auto')S.autoQ='hi';FZ.applyQuality();G.save(true);UI.showSettings()});$('renewalHelp').onclick=UI.showHelp;$('renewalRate').onclick=FZ.Platform.rate;
 };
 UI.showJournal=function(){
  const st=G.state();UI.sheet('<div class="eyebrow">СОХРАНЁННЫЕ ИСТОРИИ</div><h2>Дневник рыбака</h2><div class="sub">'+st.stats.total+' уловов · '+st.stats.kg.toFixed(1)+' кг · '+st.stats.trophies+' трофеев</div><div class="scroll">'+(st.journal.length?st.journal.map(e=>'<div class="journal-entry"><img loading="lazy" data-src="'+speciesImage(FZ.SP[e.sid])+'" alt=""><div><b>'+FZ.SP[e.sid].n+'</b><small>'+FZ.LOC[e.loc].n+' · '+FZ.METHODS[e.mode].n+'</small><span>'+U.kg(e.w)+' · '+(e.kept?'Забрана':'Отпущена')+(e.trophy?' · Трофей':'')+'</span></div></div>').join(''):'<div class="empty-state">'+ic('book')+'<h3>Здесь будут твои уловы</h3><p>После обновления каждая поимка сохраняется в дневник. Старые рекорды уже на месте в атласе.</p></div>')+'</div>',closeBack);
 };
 G.claimJourney=function(id){const st=G.state(),l=FZ.LOC[id];if(!l||(st.journey.maps[id]||0)<3||st.journey.claimed.includes(id))return 0;const reward=300+l.lvl*120;st.journey.claimed.push(id);st.money+=reward;G.addXP(80+l.lvl*25);G.save(true);return reward};
 // Each shore has a second, optional objective that asks for a different choice.
 // The three-catch reward from 1.5 is unchanged, including existing progress.
 const challenges={
  pond:{type:'release',need:1},oka:{type:'species',id:'chub'},platnik:{type:'weight',need:1},
  volga:{type:'species',id:'bream'},ladoga:{type:'variety',need:3},akhtuba:{type:'species',id:'wildcarp'},
  baikal:{type:'species',id:'omul'},taiga:{type:'species',id:'grayling'},northstream:{type:'species',id:'dace'},
  mountainlake:{type:'variety',need:3},don:{type:'species',id:'chekhon'},polar:{type:'species',id:'whitefish'},
  kamchatka:{type:'method',id:'spin'},seliger:{type:'release',need:2},onega:{type:'variety',need:3},
  katun:{type:'species',id:'grayling'},kola:{type:'species',id:'vendace'},amur:{type:'species',id:'carp'},
  blacksea:{type:'species',id:'blackseagoby'},barents:{type:'species',id:'cod'}
 };
 function challenge(id){
  const q=challenges[id],l=FZ.LOC[id],st=G.state();if(!q||!l)return null;
  const b=st.journey.bonus[id]||{species:{},methods:{},released:0,largest:0};let got=0,label='';
  if(q.type==='species'){label='Поймай: '+FZ.SP[q.id].n;got=b.species[q.id]||0}
  else if(q.type==='release'){label=q.need===1?'Отпусти рыбу':'Отпусти двух рыб';got=b.released}
  else if(q.type==='variety'){label='Поймай разные виды';got=Object.keys(b.species).length}
  else if(q.type==='weight'){label='Поймай рыбу от '+U.kg(q.need);got=b.largest>=q.need?1:0}
  else if(q.type==='method'){label='Поймай на спиннинг';got=b.methods[q.id]||0}
  const need=q.type==='release'||q.type==='variety'?q.need:1;
  return {label,got:Math.min(got,need),need,reward:180+l.lvl*80,claimed:st.journey.bonusClaimed.includes(id)};
 }
 G.claimChallenge=function(id){const q=challenge(id);if(!q||q.claimed||q.got<q.need)return 0;const st=G.state();st.journey.bonusClaimed.push(id);st.money+=q.reward;G.addXP(35+FZ.LOC[id].lvl*12);G.save(true);return q.reward};
 FZ.Expeditions={challenge};
 UI.showJourney=function(){
  const st=G.state();const sh=UI.sheet('<div class="eyebrow">20 БЕРЕГОВ · 20 ИСТОРИЙ</div><h2>Экспедиции</h2><div class="sub">На каждом водоёме тебя ждут два задания. Выполняй их в своём темпе и забирай награды.</div><div class="scroll">'+FZ.LOCATIONS.slice().sort((a,b)=>a.lvl-b.lvl).map(l=>{const count=Math.min(3,st.journey.maps[l.id]||0),done=st.journey.claimed.includes(l.id),locked=st.lvl<l.lvl,q=challenge(l.id);return '<div class="expedition '+(done&&q.claimed?'done':'')+'"><img loading="lazy" data-src="'+photo(l.id,'summer')+'" alt=""><div><small>'+(locked?'С УРОВНЯ '+l.lvl:done&&q.claimed?'БЕРЕГ ОСВОЕН':'ЭКСПЕДИЦИЯ')+'</small><h3>'+l.n+'</h3><p>Поймай 3 рыбы · '+count+' / 3<br><span class="expedition-reward">'+(done?'Награда получена':(300+l.lvl*120)+' ₽ + опыт')+'</span></p><div class="expedition-progress"><i style="width:'+count/3*100+'%"></i></div>'+(count===3&&!done?'<button class="btn brass small" data-claim-journey="'+l.id+'">Забрать награду</button>':'')+'<div class="shore-challenge"><b>'+q.label+'</b><span>'+(q.claimed?'Выполнено':q.got+' / '+q.need+' · '+q.reward+' ₽ + опыт')+'</span>'+(q.got===q.need&&!q.claimed?'<button class="btn brass small" data-claim-challenge="'+l.id+'">Забрать награду</button>':'')+'</div></div></div>'}).join('')+'</div>',closeBack);
  sh.querySelectorAll('[data-claim-journey]').forEach(b=>b.onclick=()=>{const n=G.claimJourney(b.dataset.claimJourney);if(n){FZ.Sound.coin();UI.toast('Экспедиция завершена: +'+n+' ₽');UI.showJourney()}});
  sh.querySelectorAll('[data-claim-challenge]').forEach(b=>b.onclick=()=>{const n=G.claimChallenge(b.dataset.claimChallenge);if(n){FZ.Sound.coin();UI.toast('Задание берега выполнено: +'+n+' ₽');UI.showJourney()}});
 };
 UI.showGuide=function(){
  const se=G.sess(),rig=G.rig(),gear=G.gear(se.mode),point=rig.state==='idle'&&rig.aimSelected?se.lastAim:null;
  const rows=G.biteTable(point).slice().sort((a,b)=>b[1]-a[1]).slice(0,7);
  UI.sheet('<div class="eyebrow">ЧТО КЛЮЁТ НА ТВОЮ СНАСТЬ</div><h2>Гид по клёву</h2><div class="sub">'+se.loc.n+' · '+FZ.SEASONS[se.season]+' · '+FZ.TIMES[se.period]+'</div><div class="scroll"><p class="guide-tip">'+FZ.World.tip(se.wx)+'<br><br>Сейчас: '+FZ.METHODS[se.mode].n+' · '+(gear.bait?gear.bait.n:'без наживки')+(point?' · выбранная точка':'')+'.</p>'+(rows.length?rows.map(([f])=>'<div class="guide-fish"><img loading="lazy" data-src="'+speciesImage(f)+'" alt=""><div><b>'+f.n+'</b><small>Подходит также: '+FZ.bestBaits(f).join(', ')+'</small><span>'+Object.keys(f.methods).filter(k=>f.methods[k]>=.8&&(se.ice?k==='ice':k!=='ice')).map(k=>FZ.METHODS[k].n).join(' · ')+'</span></div></div>').join(''):'<div class="empty-state"><h3>Сейчас поклёвки маловероятны</h3><p>Смени наживку, глубину или снасть и загляни в гид снова.</p></div>')+'<p class="quiet-note">Точка у травы привлекает прибрежную рыбу. Дальний заброс помогает искать донные виды. Прикормка усиливает клёв мирной рыбы рядом с точкой.</p></div>');
 };
 UI.showHelp=function(){UI.sheet('<div class="eyebrow">ОТ ПЕРВОГО ЗАБРОСА ДО ТРОФЕЯ</div><h2>Как играть</h2><div class="scroll help-steps">'+[
 ['Выбери место','Проведи пальцем по воде и отпусти для заброса. Коротким касанием можно выбрать точку заранее и нажать «Заброс».'],
 ['Подбери наживку','Кнопка наживки показывает запас. В атласе и гиде указаны подходящие насадки. Поплавок, фидер, спиннинг и зимняя снасть привлекают разные виды.'],
 ['Дождись потяжки','Первые движения — рыба только пробует. Подсекай кнопкой или свайпом вверх после сигнала «Подсечь!».'],
 ['Управляй вываживанием','Держи кнопку подмотки в спокойные моменты. Перед рывком появится предупреждение: отпусти кнопку. Фрикцион ограничивает нагрузку, но слабая леска не удержит любую рыбу.'],
 ['Помогай удилищем','Веди палец по воде или сдвинь его вбок при подмотке. Если рыба рванула вправо, отведи удочку влево.'],
 ['Реши судьбу улова','Забирай рыбу за монеты или отпускай ради опыта. У охраняемых видов доступно только отпускание. Улучшай снасти и открывай новые водоёмы.'],
 ['Лови зимой и в море','На льду сначала пробури лунку, выбери глубину и короткими нажатиями играй мормышкой. На зимнем морском берегу вода остаётся открытой.']
 ].map((a,i)=>'<div class="help-step"><b>'+String(i+1).padStart(2,'0')+'</b><div><h3>'+a[0]+'</h3><p>'+a[1]+'</p></div></div>').join('')+'</div>')};
 // Keep the short renewal instructions in idle/casting states, but the
 // canonical UI's safety-aware fight coach must own all live fish fights.
 // Otherwise this legacy replacement hides dive/cover/drag warnings.
 const coachedFightHint=UI.hint;
 UI.hint=function(s,r,st,t){
  if(r.state==='fight'&&r.fish)return coachedFightHint(s,r,st,t);
  let html='';
  if(s.duel&&r.state==='idle')html='Целься в золотой круг';
  else if(r.state==='idle')html=G.canFish()!==true?G.canFish():r.aimSelected?'Точка выбрана · нажми «Заброс»':'Проведи по воде и отпусти';
  else if(r.state==='nohole')html='Пробури лунку';
  else if(r.state==='bite'){
   const bite=r.bite;
   if(bite.phase==='take')html=s.duel?'Лови момент!':'Подсекай!';
   else if(bite.t>=bite.approach)html='Пробует наживку…';
  }else if(r.state==='fight'){
   const f=r.fish,velocity=f.warning?f.runDirection:f.phase==='run'?(f.runSpeed||f.vx):f.vx;
   const dir=!s.ice&&Math.abs(velocity)>.15?(velocity>0?'вправо':'влево'):'';
   if(f.jump)html='Рыба в воздухе · отпусти подмотку';
   else if(f.strained||f.tension>.88)html=r.reeling?'Леска натянута · отпусти кнопку':'Дай рыбе леску';
   else if(f.warning)html='Рывок '+dir+'<small>Приготовься отпустить подмотку</small>';
   else if(s.duel&&f.snagT>.4)html=f.X>0?'У травы · веди влево':'У травы · веди вправо';
   else if(f.slackT>.5)html='Подмотай слабину';
   else if(f.against)html='Удочка гасит рывок';
   else if(f.phase==='run')html=dir?'Рывок '+dir+'!<small>Веди удочку '+(dir==='вправо'?'влево':'вправо')+'</small>':'Рывок! · отпусти подмотку';
   else if(f.S<.3)html='Рыба устала · подматывай';
   else html=r.reeling?'':'Удерживай подмотку';
  }else if(r.state==='wait'){
   if(!G.gear(s.mode).bait)html='Закончилась наживка';
   else if(r.idleT>8&&G.biteTable().length===0)html='Попробуй другую наживку';
   else html=s.mode==='spin'?'Подматывай с паузами':s.ice?'Короткими нажатиями играй мормышкой':'';
  }
  const el=$('hHint'),cls='hint'+(r.state==='bite'&&r.bite.phase==='take'?' strike':r.state==='fight'?' fighting':'')+(r.fish&&(r.fish.warning||r.fish.strained)?' warning':'');
  if(el.innerHTML!==html)el.innerHTML=html;if(el.className!==cls)el.className=cls;
 };
 const event=UI.onEvent;UI.onEvent=function(e){if(e.type==='hooked'&&G.rig().fish)FZ.Assets.fish(G.rig().fish.s.id);event(e)};
 const tools=UI.refreshTools;UI.refreshTools=function(){tools();if(!$('tRodIc'))return;const m=G.mode(),image={float:'reel',feeder:'reel',spin:'reel_spinning_blue',ice:'reel_ice'}[m];$('tRodIc').innerHTML='<img alt="" src="assets/equipment/'+image+'.png">'};
 window.__handleBack=function(){if($('ovAd').classList.contains('on')||FZ.Ads.isBusy())return true;if($('ovSheet').classList.contains('on')){UI.closeSheet();return true}if($('ovLost').classList.contains('on')){$('ovLost').classList.remove('on');G.rig().lost=null;return true}if($('ovCatch').classList.contains('on'))return true;if(!UI.menuOpen){UI.showMenu();return true}return false};
 document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('selectstart',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());
})(window.FZ);

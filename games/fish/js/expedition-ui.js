/* Field information and accessibility, with one shared HUD across all methods. */
(function(FZ){
  'use strict';
  const UI=FZ.UI,G=FZ.Game,$=id=>document.getElementById(id);
  const build=UI.buildHud,frame=UI.frame,settings=UI.showSettings,map=UI.showMap;
  let focused=false,lensCtx=null,lastStatus='',lastWeather='';
  UI.buildHud=function(){
    build();
    const info=document.createElement('div');info.className='field-weather';info.id='fieldWeather';$('hud').appendChild(info);
    const status=document.createElement('div');status.className='field-status';status.id='fieldStatus';$('hud').appendChild(status);
    const button=document.createElement('button');button.className='float-focus';button.id='bFocus';button.setAttribute('aria-label','Наблюдать за поплавком');button.innerHTML=UI.ic('fish');button.onclick=()=>{focused=!focused;button.classList.toggle('on',focused);};$('hud').appendChild(button);
    const lens=document.createElement('div');lens.className='float-lens hide';lens.id='floatLens';lens.innerHTML='<canvas width="280" height="328"></canvas><span>НАБЛЮДЕНИЕ ЗА ПОПЛАВКОМ</span>';$('hud').appendChild(lens);lensCtx=lens.querySelector('canvas').getContext('2d');
    lastStatus='';lastWeather='';
  };
  UI.frame=function(dt,t){
    frame(dt,t);const s=G.sess(),r=G.rig();if(!s||!r||!$('fieldStatus'))return;
    const f=r.fish,isFight=r.state==='fight',phase=f&&f.phase;
    const directions=f&&Math.abs(f.vx)>.35?(f.vx>0?'← Веди удилище влево':'Веди удилище вправо →'):'';
    let msg='';
    if(isFight){const cue=f.telegraph?'Готовит рывок — отпусти подмотку':f.tension>.85?'Ослабь натяжение':phase==='run'?'Отпусти подмотку на рывке':phase==='toward'?'Подматывай: рыба идёт к тебе':phase==='tired'?'Рыба устала — забирай':'Подматывай и держи леску';msg='<b>'+({run:'РЫВОК',rest:'ПАУЗА',toward:'К БЕРЕГУ',shake:'ТРЯСЁТ ГОЛОВОЙ',tired:'РЫБА УСТАЛА'}[phase]||'ВЫВАЖИВАНИЕ')+'</b>'+cue+(directions?'<br>'+directions:'');}
    else if(r.state==='wait'||r.state==='bite'){const p=s.ice&&s.hole?s.hole.depth:G.depthAt(r.X,r.Z);const gear=G.gear(s.mode);msg='<b>'+FZ.METHODS[s.mode].n.toUpperCase()+'</b>'+Number(p).toFixed(1).replace('.',',')+' м · '+(gear.bait?gear.bait.n:'Выбери приманку');}
    if(msg!==lastStatus){$('fieldStatus').innerHTML=msg;lastStatus=msg;}
    const sky={clear:'Ясно',cloudy:'Облачно',overcast:'Пасмурно',rain:'Дождь',storm:'Гроза',snow:'Снег'}[s.wx.sky]||'';
    const weather=sky+' · '+s.wx.temp+'° · ветер '+Number(s.wx.wind||0).toFixed(1).replace('.',',')+' м/с';
    if(weather!==lastWeather){$('fieldWeather').textContent=weather;lastWeather=weather;}
    const show=focused&&!s.ice&&s.mode==='float'&&(r.state==='wait'||r.state==='bite');$('floatLens').classList.toggle('hide',!show);$('bFocus').classList.toggle('hide',s.mode!=='float'||!!s.ice||isFight);
    if(show){const p=FZ.Scene.proj(r.X,r.Z),cv=$('cv'),ratio=cv.width/innerWidth;const sw=84*ratio,sh=98.4*ratio;const sx=Math.max(0,Math.min(cv.width-sw,(p.x-42)*ratio)),sy=Math.max(0,Math.min(cv.height-sh,(p.y-69)*ratio));lensCtx.drawImage(cv,sx,sy,sw,sh,0,0,280,328);}
  };
  UI.showSettings=function(){
    settings();const sh=document.querySelector('#ovSheet .sheet'),S=G.state().settings;
    for(const [id,label] of [['ambienceVolume','Природа'],['effectsVolume','Снасти и эффекты'],['musicVolume','Громкость музыки']]){
      const row=document.createElement('div');row.className='opt';const value=Math.round((S[id]==null?(id==='musicVolume'?.32:.72):S[id])*100);row.innerHTML='<label for="'+id+'">'+label+'</label><input class="mix-slider" id="'+id+'" type="range" min="0" max="100" value="'+value+'" aria-label="'+label+'">';
      row.querySelector('input').oninput=e=>{S[id]=Number(e.target.value)/100;FZ.Sound.setMix(S);G.save(true);};sh.querySelector('.scroll').prepend(row);
    }
    if(FZ.Scene.renderer==='canvas'){const n=document.createElement('div');n.className='render-notice';n.textContent='Устройство запустило совместимый режим графики. Объёмная сцена недоступна.';sh.prepend(n);}
  };
  UI.showMap=function(){map.apply(UI,arguments);const sh=document.querySelector('#ovSheet .sheet');if(sh)sh.classList.add('water-cards');};
  // Preview uses the exact season resource; it never draws a generic landscape.
  FZ.Scene.thumb=(l,season)=>'assets/'+FZ.Assets.manifest.images[FZ.Assets.backdropKey(l.id,season)];
})(window.FZ);

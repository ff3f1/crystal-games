/* Approved cozy concept v2: actual layout, not a skin over the old 1.6 controls.
   Existing menu IDs, handlers, equipment, upgrades and save data remain intact. */
(function(FZ){
 "use strict";
 if(!FZ||!FZ.UI||!FZ.Game)return;
 const UI=FZ.UI,G=FZ.Game, U=FZ.U;
 const menu=document.getElementById("ovMenu");
 const icon=name=>UI.ic?UI.ic(name):"";
 const safeText=(value)=>String(value??"");
 function achievements(){
   const st=G.state(),stats=st.stats||{},species=Object.keys(st.caught||{}).length;
   const milestones=[
     ["Первый улов",stats.total||0,1,"Начало рыбацкой истории"],
     ["Десять уловов",stats.total||0,10,"Первый устойчивый результат"],
     ["Пятьдесят уловов",stats.total||0,50,"Настоящая практика"],
     ["Первый трофей",stats.trophies||0,1,"Серьёзная рыба"],
     ["Десять отпущенных рыб",stats.released||0,10,"Бережное отношение к водоёму"],
     ["Пять разных видов",species,5,"Первые страницы атласа"],
     ["Двадцать разных видов",species,20,"Знаток рыб"],
     ["Сто уловов",stats.total||0,100,"Уверенный рыболов"]
   ];
   const complete=milestones.filter(row=>row[1]>=row[2]).length;
   const html='<div class="eyebrow">РЫБОЛОВНЫЕ ВЕХИ</div><h2>Достижения</h2>'+
      '<div class="sub">Выполнено '+complete+' из '+milestones.length+'. Реальный прогресс твоей рыбалки.</div>'+
      '<div class="scroll concept-achievements">'+milestones.map(([name,value,target,note])=>
        '<div class="concept-achievement '+(value>=target?"done":"")+'">'+
        '<span class="concept-medal">'+(value>=target?"★":"☆")+'</span>'+
        '<div><strong>'+name+'</strong><small>'+note+'</small>'+
        '<div class="concept-achievement-track"><i style="width:'+Math.min(100,Math.round(value/target*100))+'%"></i></div></div>'+
        '<b>'+Math.min(value,target)+' / '+target+'</b></div>').join("")+
      '<p class="quiet-note">Достижения показывают реальные результаты. Награды и вероятности клёва не изменены.</p></div>';
   UI.sheet(html);
 }
 UI.showAchievements=achievements;

 // Restyle the REAL existing catalog after all purchase/tab handlers bind.
 const previousShop=UI.showShop;
 UI.showShop=function(){
   const result=previousShop.apply(this,arguments);
   const sheet=document.querySelector("#ovSheet .sheet");
   if(sheet)sheet.classList.add("concept-shop");
   return result;
 };
 const previousTackle=UI.showTackle;
 UI.showTackle=function(){
   const result=previousTackle.apply(this,arguments);
   const sheet=document.querySelector("#ovSheet .sheet");
   if(sheet)sheet.classList.add("concept-loadout");
   return result;
 };

 const previousMenu=UI.showMenu;
 UI.showMenu=function(){
   const ret=previousMenu.apply(this,arguments);
   const lodge=menu&&menu.querySelector(".lodge");
   const grid=lodge&&lodge.querySelector(".lodge-grid");
   const go=lodge&&lodge.querySelector("#mGo");
   const profile=lodge&&lodge.querySelector(".lodge-profile");
   if(!lodge||!grid||!go||!profile)return ret;

   menu.classList.add("concept-redesign");
   lodge.classList.add("concept-layout");
   const primary=document.createElement("nav");
   primary.className="concept-primary";
   primary.setAttribute("aria-label","Главное меню");
   const tile=(id)=>lodge.querySelector("#"+id);
   const shop=tile("mShop"),settings=tile("mSet");
   primary.appendChild(go);
   if(shop)primary.appendChild(shop);

   const make=(id,label,which,handler)=>{
      const btn=document.createElement("button");
      btn.id=id;btn.type="button";btn.className="concept-quick";
      btn.innerHTML=icon(which)+'<span>'+label+'</span>';
      btn.onclick=()=>{if(FZ.Sound&&FZ.Sound.click)FZ.Sound.click();handler()};
      primary.appendChild(btn);
   };
   make("mInventory","Инвентарь","bag",()=>UI.showTackle());
   make("mAchievements","Достижения","cup",achievements);
   if(settings)primary.appendChild(settings);
   lodge.appendChild(primary);

   const st=G.state();
   const xpNeed=FZ.xpNeed?Math.max(1,FZ.xpNeed(st.lvl)):Math.max(1,st.xp||1);
   const percentage=Math.min(100,Math.round(100*(st.xp||0)/xpNeed));
   const bestWeight=Math.max(0,
      Number(st.stats&&st.stats.best&&st.stats.best.w)||0,
      ...Object.values(st.records||{}).map(r=>Number(r&&r.w)||0));
   const detail=document.createElement("div");
   detail.className="concept-player-detail";
   detail.innerHTML='<div class="concept-player-track"><i style="width:'+percentage+'%"></i></div>'+
     '<span>Опыт '+(st.xp||0).toLocaleString("ru-RU")+' / '+xpNeed.toLocaleString("ru-RU")+
     '</span><span>Рекорд '+bestWeight.toFixed(2).replace(".",",")+' кг</span>';
   lodge.appendChild(detail);

   const scenic=document.createElement("div");
   scenic.className="concept-lakeside";scenic.setAttribute("aria-hidden","true");
   scenic.innerHTML='<span class="concept-lakeside-label">ТВОЯ РЫБАЛЬСКАЯ ИСТОРИЯ</span>'+
       '<strong>Тишина воды.<br>Настоящий клёв.</strong>';
   lodge.appendChild(scenic);

   const shelfTitle=document.createElement("div");
   shelfTitle.className="concept-secondary-label";
   shelfTitle.textContent="Ещё разделы";
   grid.insertAdjacentElement("beforebegin",shelfTitle);
   // Discoverable, snapped navigation instead of a half-cut final tile.
   const next=document.createElement("button");
   next.id="conceptMoreSections";
   next.type="button";next.className="concept-more-sections";
   const updateArrow=()=>{
     const end=grid.scrollLeft>=grid.scrollWidth-grid.clientWidth-3;
     next.textContent=end?"‹":"›";
     next.setAttribute("aria-label",end?"К началу разделов":"Показать ещё разделы");
   };
   next.onclick=()=>{
     const end=grid.scrollLeft>=grid.scrollWidth-grid.clientWidth-3;
     grid.scrollTo({left:end?0:Math.min(grid.scrollWidth-grid.clientWidth,
       grid.scrollLeft+grid.clientWidth*.82),behavior:"smooth"});
     setTimeout(updateArrow,320);
   };
   grid.addEventListener("scroll",updateArrow,{passive:true});
   grid.insertAdjacentElement("afterend",next);
   updateArrow();
   const duel=lodge.querySelector("#mDuel");
   if(duel)duel.setAttribute("aria-label","Испытание дня: Три заброса");
   return ret;
 };

 const oldBuild=UI.buildHud;
 UI.buildHud=function(){
   const res=oldBuild.apply(this,arguments);
   const hud=document.getElementById("hud");
   if(!hud)return res;
   hud.classList.add("concept-hud");
   if(!hud.querySelector("#conceptWeather")){
      const weather=document.createElement("div");
      weather.id="conceptWeather";weather.className="concept-weather";
      weather.setAttribute("aria-live","off");
      const loc=hud.querySelector("#hLoc");
      if(loc)loc.insertAdjacentElement("afterend",weather);
   }
   if(!hud.querySelector("#conceptReelBadge")){
      const badge=document.createElement("span");
      badge.id="conceptReelBadge";badge.className="concept-reel-badge";
      badge.setAttribute("aria-hidden","true");
      const act=hud.querySelector("#bAct");
      if(act)act.appendChild(badge);
   }
   // Keep all original pointer handlers on their original controls.
   return res;
 };
 const oldFrame=UI.frame;
 UI.frame=function(dt,t){
   const res=oldFrame.apply(this,arguments);
   const session=G.sess(),weather=document.getElementById("conceptWeather");
   if(!weather||!session)return res;
   const wx=session.wx||{};
   const temp=Number.isFinite(wx.temp)?(wx.temp>0?"+":"")+wx.temp+"°C":"";
   const wind=Number.isFinite(wx.wind)?"Ветер "+Math.round(wx.wind)+" м/с":"";
   const method=FZ.METHODS&&FZ.METHODS[session.mode]?FZ.METHODS[session.mode].n:"";
   const detail=[temp,wind,method].filter(Boolean).join(" · ");
   if(weather.textContent!==detail)weather.textContent=detail;
   const hud=document.getElementById("hud"),rig=G.rig();
   if(hud&&rig){
     const state=rig.state;
     const phase=(state==="fight"||state==="landing")?"fight":
       state==="idle"?"casting":"waiting";
     if(hud.dataset.conceptState!==phase)hud.dataset.conceptState=phase;
   }
   return res;
 };
})(window.FZ);
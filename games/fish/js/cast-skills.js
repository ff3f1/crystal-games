/* Casting and angler progression: small, accessible UI layered over the existing game. */
(function(FZ){
 "use strict";
 if(!FZ||!FZ.UI||!FZ.Game)return;
 const UI=FZ.UI,G=FZ.Game;
 const definitions=[
  {id:"accuracy",icon:"◎",name:"Меткость",note:"Поплавок попадает ближе к выбранной точке. Спиннинг и фидер тоже точнее.",bonus:()=>Math.round((.042-G.skillBonuses().accuracy)*1000)/10+"% меньше разброс"},
  {id:"casting",icon:"↗",name:"Техника заброса",note:"Доступная дальность растёт, но мощность всё равно задаётся удержанием шкалы.",bonus:()=>Math.round((G.skillBonuses().range-1)*100)+"% к дальности"},
  {id:"control",icon:"〰",name:"Контроль удилища",note:"Когда правильно уводишь удилище против рывка, нагрузка немного снижается.",bonus:()=>Math.round(G.skillBonuses().steering*100)+"% помощь при рывке"}
 ];
 function build(){
   const pending=G.skillPoints(),st=G.state();
   return '<div class="cozy-skill-summary"><span>Уровень '+st.lvl+'</span><strong>'+
     (pending?'Свободно очков: '+pending:'Все очки распределены')+'</strong></div>'+
     '<p class="cozy-skill-intro">За каждый уровень получаешь одно очко. Уровень сам по себе немного улучшает заброс, а выбор навыков — твоя специализация.</p>'+
     definitions.map(s=>{
       const rank=G.skillRank(s.id);
       const off=!pending||rank>=8;
       return '<div class="cozy-skill-item"><div class="cozy-skill-icon">'+s.icon+'</div>'+
         '<div class="cozy-skill-main"><strong>'+s.name+'</strong><small>'+s.note+'</small>'+
         '<div class="cozy-skill-meter">'+Array.from({length:8},(_,i)=>'<i class="'+(i<rank?'on':'')+'"></i>').join('')+'</div>'+
         '<span class="cozy-skill-bonus">'+s.bonus()+'</span></div>'+
         '<button class="cozy-skill-up" data-skill="'+s.id+'" '+(off?'disabled':'')+
           ' aria-label="Улучшить '+s.name+'">+1</button></div>';
     }).join('')+
     '<p class="cozy-skill-foot">Навыки действуют только в обычной рыбалке. В турнире «Три заброса» сохраняются фиксированные правила соревнования.</p>';
 }
 UI.showSkills=function(){
   const sheet=UI.sheet('<div class="eyebrow">ОПЫТ И УМЕНИЯ</div><h2>Навыки рыбака</h2>'+
     '<div class="sub">Прокачивай рыбака за опыт — без покупок за монеты.</div>'+
     '<div class="scroll cozy-skill-scroll"><div id="cozySkillContent"></div></div>');
   const root=sheet.querySelector("#cozySkillContent");
   const refresh=()=>{
     root.innerHTML=build();
     root.querySelectorAll("[data-skill]").forEach(btn=>{
       btn.onclick=()=>{
         if(G.trainSkill(btn.dataset.skill)){
           if(FZ.Sound&&FZ.Sound.click)FZ.Sound.click();
           refresh();
         }
       };
     });
   };
   refresh();
 };
 const oldMenu=UI.showMenu;
 UI.showMenu=function(){
   const result=oldMenu.apply(this,arguments);
   const footer=document.querySelector("#ovMenu .lodge-footer");
   if(footer&&!footer.querySelector("#mSkills")){
     const btn=document.createElement("button");
     btn.id="mSkills";btn.type="button";btn.className="cozy-skill-entry";
     const points=G.skillPoints();
     btn.textContent="✦ Навыки"+(points?" · "+points:"");
     btn.setAttribute("aria-label","Открыть навыки рыбака"+(points?", очков: "+points:""));
     btn.onclick=()=>{if(FZ.Sound&&FZ.Sound.click)FZ.Sound.click();UI.showSkills()};
     footer.insertBefore(btn,footer.querySelector("#mRate")||null);
   }
   return result;
 };
 const oldBuild=UI.buildHud;
 UI.buildHud=function(){
   const result=oldBuild.apply(this,arguments);
   const lvl=document.getElementById("hLvlBox");
   if(lvl){
     lvl.setAttribute("role","button");
     lvl.tabIndex=0;
     lvl.setAttribute("aria-label","Навыки рыбака");
     lvl.onclick=()=>UI.showSkills();
     lvl.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();UI.showSkills()}};
   }
   const hud=document.getElementById("hud");
   if(hud&&!document.getElementById("hCastPower")){
     const bar=document.createElement("div");
     bar.id="hCastPower";bar.className="cozy-power hide";
     bar.setAttribute("role","progressbar");
     bar.setAttribute("aria-label","Сила заброса");
     bar.setAttribute("aria-valuemin","0");
     bar.setAttribute("aria-valuemax","100");
     bar.innerHTML='<div class="cozy-power-copy"><b>Сила заброса</b><span id="hCastLabel">0%</span></div>'+
       '<div class="cozy-power-track"><i id="hCastFill"></i><em></em></div>'+
       '<small>Удерживай — отпусти для заброса</small>';
     hud.appendChild(bar);
   }
   return result;
 };
 const oldFrame=UI.frame;
 UI.frame=function(){
   const result=oldFrame.apply(this,arguments);
   const bar=document.getElementById("hCastPower"),input=FZ.Input;
   if(!bar||!input||!input.castCharge)return result;
   const value=input.castCharge();
   const visible=!!(value&&value.active&&!UI.anyOpen());
   bar.classList.toggle("hide",!visible);
   if(visible){
     const percent=Math.round(value.power*100);
     if(bar._percent!==percent){
       bar._percent=percent;
       bar.setAttribute("aria-valuenow",String(percent));
       document.getElementById("hCastFill").style.width=percent+"%";
       document.getElementById("hCastLabel").textContent=percent+"%";
     }
   }
   return result;
 };
 FZ.CastSkills={definitions};
})(window.FZ);
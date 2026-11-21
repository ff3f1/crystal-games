/* Stage 12: real-state fight meter, without touching catch chance or saves. */
(function(FZ){
  "use strict";
  if(!FZ || !FZ.UI || !FZ.Game)return;
  const UI=FZ.UI,G=FZ.Game;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function describe(f,drag){
    if(!f)return{tone:"idle",title:"Леска",action:"Контроль"};
    const tension=clamp(Number.isFinite(f.tension)?f.tension:0,0,1);
    const threshold=clamp((Number.isFinite(drag)?drag:.7)+.08,.55,.91);
    if(tension>=threshold||f.overload>.15)
      return{tone:"danger",title:"Леска на пределе",action:"Отпустите подмотку"};
    if((f.slackT||0)>.42)
      return{tone:"slack",title:"Слабина лески",action:"Подматывайте"};
    if(f.diveWarning)
      return{tone:"recover",title:"Уход на глубину",action:"Готовьтесь"};
    if(f.warning&&f.coverRun)
      return{tone:"recover",title:"Рывок к траве",action:"Уведите удилище"};
    if(f.warning)
      return{tone:"recover",title:"Сильный рывок",action:"Сбавьте подмотку"};
    if(f.phase==="dive")
      return{tone:"recover",title:"Рыба на глубине",action:"Не форсируйте"};
    if(f.phase==="toward")
      return{tone:"slack",title:"Рыба идёт к вам",action:"Подматывайте"};
    if(f.phase==="tired")
      return{tone:"steady",title:"Рыба устала",action:"Подтягивайте"};
    return{tone:"steady",title:"Леска под контролем",action:"Держите натяжение"};
  }
  const oldBuild=UI.buildHud;
  UI.buildHud=function(){
    const result=oldBuild.apply(this,arguments);
    const el=document.getElementById("hTens");
    if(el && !document.getElementById("cozyFightSignal")){
      const bar=document.createElement("div");
      bar.id="cozyFightSignal";
      bar.className="cozy-fight-signal";
      bar.setAttribute("role","status");
      bar.setAttribute("aria-live","off");
      const title=document.createElement("b"),action=document.createElement("span");
      title.id="cozyFightTitle";action.id="cozyFightAction";
      bar.append(title,action);el.insertBefore(bar,el.firstChild);
    }
    return result;
  };
  const oldFrame=UI.frame;
  UI.frame=function(){
    const result=oldFrame.apply(this,arguments);
    const el=document.getElementById("hTens");
    const title=document.getElementById("cozyFightTitle");
    const action=document.getElementById("cozyFightAction");
    if(!el||!title||!action)return result;
    const r=G.rig();
    if(!r||r.state!=="fight"||!r.fish){
      if(el.dataset.cozyRisk!=="idle")el.dataset.cozyRisk="idle";
      return result;
    }
    const status=describe(r.fish,G.drag());
    if(el.dataset.cozyRisk!==status.tone)el.dataset.cozyRisk=status.tone;
    if(title.textContent!==status.title)title.textContent=status.title;
    if(action.textContent!==status.action)action.textContent=status.action;
    return result;
  };
  FZ.CozyPolish={describe};
})(window.FZ);
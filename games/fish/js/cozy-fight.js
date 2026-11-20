/* Cozy Lodge — fish-fight water choreography and trophy presentation.
   Decorative only: does not modify RNG, catch tables, saved data, or advertisements. */
(function (FZ) {
  'use strict';
  if (!FZ || !FZ.Scene || !FZ.UI) return;
  const R = FZ.Scene, UI = FZ.UI;
  const cv = document.getElementById('cv'), ctx = cv && cv.getContext('2d');
  if (!ctx) return;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const metrics = { fighting: 0, shore: 0, landing: 0 };
  function poolRipple(x,y,size,alpha,t) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(1,.34);
    for (let i=0;i<2;i++) {
      const age = ((t*.55 + i*.48)%1);
      ctx.beginPath();
      ctx.ellipse(0,0,size*(.42+age*.68),size*(.21+age*.11),0,0,TAU);
      ctx.strokeStyle='rgba(229,243,223,'+(alpha*(1-age)*(1-age)).toFixed(3)+')';
      ctx.lineWidth=.9;ctx.stroke();
    }
    ctx.restore();
  }
  function waterMotion(v,L,t,p) {
    const f=v.fish;
    if (!f || v.ice || f.jump || !Number.isFinite(f.X) || !Number.isFinite(f.Z)) return;
    const speed=clamp(Math.hypot(f.vx||0,f.vz||0)/2.3,0,1);
    const surf=clamp(f.surface||0,0,1);
    const near=clamp((13-(f.Z||30))/9,0,1);
    const awake=clamp(.3*speed + .65*surf + .22*near,0,1);
    if (awake < .12 || !Number.isFinite(p.x) || !Number.isFinite(p.y))return;
    const scale=clamp(p.s||30,5,85);
    const alpha=(.11+awake*.24)*(1-clamp(L.dark||0,0,.9)*.28);
    // The original R.drawFightFish already renders a directional wake.
    // Do not draw a duplicate wake on top; only add an occasional near-shore ring.
    // Surface shimmer, only above a genuinely hooked, shallow fish.
    if(surf>.35 && near>.12)poolRipple(p.x,p.y,clamp(5+scale*.20,7,20),alpha*.7,reduced?0:t);
    metrics.fighting++;
    if(near>.15)metrics.shore++;
  }
  const oldFight=R.drawFightFish;
  R.drawFightFish=function(v,L,t,p){
    if(v && v.fish && p)waterMotion(v,L,t,p);
    return oldFight.apply(this,arguments);
  };
  const oldLanding=R.drawLanding;
  R.drawLanding=function(v,L,t,pose){
    const result=oldLanding.apply(this,arguments);
    if(v && !v.ice && pose && pose.lift<.76){
      // A calm ring around the real net: no fake splashes on empty water.
      const openness=clamp(1-pose.lift/.76,0,1);
      if(openness>.04){
        poolRipple(pose.fishX,pose.fishY,clamp(pose.radius*.45,8,32),
          .18*openness*(1-clamp(L.dark||0,0,1)*.25),reduced?0:t*.7);
        metrics.landing++;
      }
    }
    return result;
  };
  const oldCatch=UI.showCatch;
  UI.showCatch=function(r){
    const result=oldCatch.apply(this,arguments);
    const root=document.getElementById('ovCatch');
    const card=root && root.querySelector('.catch');
    if(card && r){
      card.classList.add('cozy-wood-trophy');
      const kind=r.trophy?'trophy':r.record?'record':r.newSpecies?'discovery':'catch';
      card.setAttribute('data-cozy-award',kind);
      // Decorative non-interactive bronze fishing-club seal.
      const seal=document.createElement('div');
      seal.className='cozy-trophy-seal';
      seal.setAttribute('aria-hidden','true');
      seal.textContent='✦';
      card.appendChild(seal);
      const fish=root.querySelector('#cFish');
      if(fish)fish.classList.add('cozy-catch-fish');
    }
    return result;
  };
  FZ.CozyFight={stats:()=>({fighting:metrics.fighting,shore:metrics.shore,landing:metrics.landing}),reduced};
})(window.FZ);

window.autoBrain = function(w){
  const P=w.player; if(!P||!P.alive) return {dx:0,dy:0,mag:0};
  const PS=Math.sqrt(P.n)*w.dmgMul(P);
  let gx=0,gy=0,comp=false;
  // угрозы
  for(const s of w.swarms){ if(s===P||!s.alive) continue;
    const dx=s.x-P.x,dy=s.y-P.y,d=Math.hypot(dx,dy)||1, S=Math.sqrt(s.n)*w.dmgMul(s)*(1+1.5*s.comp);
    if(S>PS*1.1 && d< 500+s.r*2+P.r*2){ gx-=dx/d*3*(1-d/(500+s.r*2+P.r*2)); gy-=dy/d*3*(1-d/(500+s.r*2+P.r*2)); }
  }
  for(const h of w.hazards){ let rr=0; if(h.type==="eel")rr=450+P.r; else if(h.type==="geyser"&&h.state>0)rr=h.r+P.r+80; else if(h.type==="void")rr=h.r+P.r+50; else if(h.type==="well")rr=h.core+P.r+150; else if(h.type==="storm")rr=h.r+P.r;
    if(!rr)continue; const dx=P.x-h.x,dy=P.y-h.y,d=Math.hypot(dx,dy)||1; if(d<rr){gx+=dx/d*3*(1-d/rr);gy+=dy/d*3*(1-d/rr);} }
  let target=null;
  const b=w.beacons.find(b=>!b.lit&&P.n>=b.req*1.05);
  if(b) target=[b.x,b.y];
  if(w.boss && P.n>w.boss.n*0.45) { target=[w.boss.x,w.boss.y]; if(Math.hypot(w.boss.x-P.x,w.boss.y-P.y)<w.boss.r+P.r+150 && P.stamina>0.2) comp=true; }
  if(!target){
    let best=null,bs=0;
    for(const s of w.swarms){ if(s===P||!s.alive) continue; const S=Math.sqrt(s.n)*w.dmgMul(s)*(1+1.5*s.comp); const d=Math.hypot(s.x-P.x,s.y-P.y);
      if(S<PS*2.0 && d<1100){ const sc=s.n/(d+200); if(sc>bs){bs=sc;best=s;} } }
    if(best){ target=[best.x,best.y]; const d=Math.hypot(best.x-P.x,best.y-P.y); if(d<best.r+P.r+120 && P.stamina>0.15) comp=true; }
  }
  if(!target){ let bd=1e18,bx=0,by=0; for(let i=0;i<w.mn;i+=2){const d=(w.mx[i]-P.x)**2+(w.my[i]-P.y)**2; if(d<bd){bd=d;bx=w.mx[i];by=w.my[i];}} target=[bx,by]; }
  const dx=target[0]-P.x,dy=target[1]-P.y,d=Math.hypot(dx,dy)||1; gx+=dx/d; gy+=dy/d;
  const l=Math.hypot(gx,gy)||1; return {dx:gx/l,dy:gy/l,mag:1,compress:comp};
};
window.simLevel = function(s,p,upg){
  const info=planetInfo(12345,s,p); const sp=SPECIES[0];
  const cfg={startN:startSize(upg),hue:60,spread:20,mods:{},eff:{},speedUp:upg*0.06,powerUp:upg*0.08,magnetUp:upg*0.06,staminaUp:upg*0.1,valueMul:1};
  const w=new World({mode:info.boss?"boss":"campaign",biome:info.biome,seed:info.seed,R:info.boss?2300:2200+Math.min(1000,info.L*30),level:info.L,req:info.req,player:cfg,onEvent:(t,d)=>{ if(t==="mutation"){ w.applyMutation(d[0].id);} }});
  const dt=1/30; let t=0;
  while(t<420 && !w.won && !w.over){ w.update(dt, autoBrain(w)); t+=dt; }
  return {L:info.L,biome:info.biome,boss:info.boss,req:info.req.join("/"),won:w.won,dead:w.over,t:Math.round(t),peak:Math.round(w.peak),kills:w.statKills,lit:w.beacons.filter(b=>b.lit).length};
};

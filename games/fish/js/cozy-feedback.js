/* Contextual feedback, all bursts are derived from actual fishing events. */
(function(FZ){
 "use strict";
 const G=FZ.Game,UI=FZ.UI,R=FZ.Scene;
 if(!G||!UI||!R)return;
 const cv=document.getElementById('cv'),ctx=cv&&cv.getContext('2d');
 if(!ctx)return;
 const particles=[];let lastNear=-10;
 function surfaceActivity(f){
   if(!f||f.jump)return 0;
   const energy=FZ.CozyMotion?FZ.CozyMotion.surfaceEnergy(f):
     Math.max(0,Math.min(1,1-Math.max(0,f.D||0)/2.45))*(f.surface||0);
   const speed=Math.min(1,Math.hypot(f.vx||0,f.vz||0)/1.2);
   return Math.max(0,Math.min(1,energy*speed));
 }
 function burst(X,Z,n,energy){
  if(!Number.isFinite(X)||!Number.isFinite(Z))return;
  const p=R.proj(X,Z);
  for(let i=0;i<n&&particles.length<32;i++){
   const a=.24+Math.random()*.9,dir=i%2?1:-1,speed=(12+Math.random()*23)*energy;
   particles.push({x:p.x,y:p.y,vx:dir*speed*Math.cos(a),vy:-speed*Math.sin(a),
    life:.23+Math.random()*.35,age:0,r:.5+Math.random()*.85});
  }
 }
 const originalEvent=UI.onEvent;
 UI.onEvent=function(e){
  const sess=G.sess(),rig=G.rig();
  if(sess&&rig&&!sess.ice){
   if(e.type==='take'&&sess.mode==='float')burst(rig.X,rig.Z,3,.36);
   if(e.type==='hooked'){
     const bait=G.loadout(sess.mode).bait;
     const surfaceLure=sess.mode==='spin'&&
       (bait==='wobbler'||bait==='sea_wobbler'||bait==='mouse');
     // A feeder hook-up or submerged spoon cannot explode at the surface.
     if(sess.mode==='float'||surfaceLure)
       burst(rig.X,rig.Z,e.big?5:3,e.big?.62:.4);
   }
  }
  if(e.type==='session'){particles.length=0;lastNear=-10}
  return originalEvent.call(this,e);
 };
 const originalDraw=R.drawScreenFx;
 R.drawScreenFx=function(dt){
  const result=originalDraw.apply(this,arguments);
  if(!(dt>=0&&dt<=.1))return result;
  const sess=G.sess(),rig=G.rig();
  if(sess&&rig&&!sess.ice&&rig.state==='fight'&&rig.fish){
   const fish=rig.fish;
   // Surface wake is only tied to an actual hooked fish near the surface.
   const activity=surfaceActivity(fish);
   if(activity>.35&&fish.surface>.30&&sess.t-lastNear>1.0){
    lastNear=sess.t;
    burst(fish.X,fish.Z,Math.min(3,Math.ceil(activity*3)),activity*.62);
   }
  }
  ctx.save();
  try{
   for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.age+=dt;
    if(p.age>=p.life){particles.splice(i,1);continue}
    p.vy+=65*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    const k=p.age/p.life,alpha=.48*(1-k)*(1-k);
    ctx.fillStyle='rgba(238,248,236,'+alpha.toFixed(3)+')';
    ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*(1-.4*k),p.r*(1.3-.5*k),
     Math.atan2(p.vy,p.vx)-Math.PI/2,0,Math.PI*2);ctx.fill();
   }
  }finally{ctx.restore()}
  return result;
 };
 FZ.CozyFeedback={surfaceActivity,stats:()=>({particles:particles.length,limit:32}),
  reset:()=>{particles.length=0;lastNear=-10}};
})(window.FZ);
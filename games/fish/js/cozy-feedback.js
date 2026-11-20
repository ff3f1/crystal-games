/* Contextual feedback, all bursts are derived from actual fishing events. */
(function(FZ){
 "use strict";
 const G=FZ.Game,UI=FZ.UI,R=FZ.Scene;
 if(!G||!UI||!R)return;
 const cv=document.getElementById('cv'),ctx=cv&&cv.getContext('2d');
 if(!ctx)return;
 const particles=[];let lastNear=-10;
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
   if(e.type==='take'&&sess.mode==='float')burst(rig.X,rig.Z,4,.52);
   if(e.type==='hooked')burst(rig.X,rig.Z,e.big?14:8,e.big?1.25:.85);
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
   if(fish.surface>.35&&sess.t-lastNear>.58){
    lastNear=sess.t;burst(fish.X,fish.Z,Math.min(4,Math.ceil(fish.surface*4)),Math.min(.9,fish.surface));
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
 FZ.CozyFeedback={stats:()=>({particles:particles.length,limit:32}),
  reset:()=>{particles.length=0;lastNear=-10}};
})(window.FZ);
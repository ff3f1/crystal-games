/* Cozy Motion — motion from actual tackle/fish state, not decorative scripted fish.
 * Never creates another line, model or fake bite.
 */
(function(FZ){
 "use strict";
 const G=FZ.Game,U=FZ.U;
 if(!G||!U)return;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const M={};
 // Gentle water motion comes from the actual session wind and position.
 // It is deterministic across devices, and never creates a synthetic bite.
 M.floatMotion=function(wx,t,X,Z,sink){
   const exposure=clamp((.92-Math.max(0,sink||0))/.92,0,1);
   if(!exposure)return 0;
   const wind=clamp(wx&&wx.wind||0,0,11);
   const amplitude=.16+wind*.094;
   const phase=t*(1.65+.06*wind)+(X||0)*.21+(Z||0)*.09;
   return exposure*amplitude*(.65*Math.sin(phase)+.35*Math.sin(phase*.64+.7));
 };
 // Wind gently flexes the same rod image only while waiting at the water.
 // Fish tension and the cast animation always take priority over weather.
 M.rodWeather=function(v,t){
   if(!v||v.ice||v.fish||!v.tackle||v.tackle.state!=="water")return{x:0,y:0};
   const wind=clamp(v.wx&&v.wx.wind||0,0,11);
   const amplitude=wind/11*.85;
   const phase=t*2.1+(v.tackle.X||0)*.18;
   return{x:amplitude*(Math.sin(phase)+.28*Math.sin(phase*1.6)),
     y:amplitude*.27*Math.sin(phase*.88)};
 };
 // Real underwater position controls whether a fish can disturb the surface.
 // No scripted foam for deep divers, even during a strong lateral run.
 M.surfaceEnergy=function(f){
   if(!f||f.jump)return 0;
   const depth=clamp(1-Math.max(0,f.D||0)/2.45,0,1);
   const attitude=f.phase==="dive"?.24:1;
   return clamp((.25+.75*clamp(f.surface||0,0,1))*depth*attitude,0,1);
 };
 // The single line becomes visibly slack during a genuine low-tension fight.
 // This changes the curvature of the existing endpoint-to-tip path only.
 // A float setup has a deliberately slack main line. The part leaving
 // the tip drops onto the water, then continues along its surface to the
 // bobber. Both curves form ONE continuous strand.
 M.floatLine=function(from,to,H,wind){
   const d=Math.hypot(to.x-from.x,to.y-from.y);
   // Line leaves the raised rod tip and touches the lake closer to the
   // angler; only then does it run out along the surface to the float.
   // Perspective shortens the projected tip-to-float distance drastically.
   const distanceToNearWater=clamp(d*.95,44,100);
   const shoreContactY=Math.max(from.y,to.y)+distanceToNearWater;
   const contact={
     x:from.x+(from.x-to.x)*.22,
     y:Math.min(H-16,shoreContactY)
   };
   // Do not make a strange loop on casts close to the bottom edge.
   contact.y=Math.max(Math.min(H-16,Math.max(from.y,to.y)+12),contact.y);
   const breeze=clamp((wind||0)*.14,0,1.6);
   return{contact,
     air:{x:from.x+(contact.x-from.x)*.62,y:from.y+(contact.y-from.y)*.76},
     water1:{x:contact.x+(to.x-contact.x)*.33,
       y:contact.y+(to.y-contact.y)*.27+breeze},
     water2:{x:contact.x+(to.x-contact.x)*.76,
       y:contact.y+(to.y-contact.y)*.73+breeze*.5},
     opacity:clamp(.82-(wind||0)*.009,.69,.82)};
 };
 M.lineShape=function(v,baseSag,from,to,screenHeight){
   const distance=Math.hypot((to&&to.x||0)-(from&&from.x||0),
                             (to&&to.y||0)-(from&&from.y||0));
   const normal=Math.max(0,Number.isFinite(baseSag)?baseSag:0);
   const fish=v&&v.fish;
   if(!fish||!fish.hooked)return{sag:normal,opacity:1};
   const tension=clamp(fish.tension||0,0,1);
   const slack=clamp((fish.slackT||0)/.9,0,1);
   const bound=Math.min(18,distance*.11,Math.max(8,(screenHeight||800)*.023));
   const sag=Math.min(bound,normal*(1-.62*tension)+bound*.84*slack);
   return{sag:Math.max(0,sag),opacity:clamp(.72+.24*tension-.18*slack,.47,.96)};
 };
 // Continuous swimmer phase comes from the live fight simulation, so changes
 // between charge, dive and rest do not reset the tail mid-stroke.
 M.fishPose=function(f,t){
   if(!f)return{phase:t*3,amp:.1,roll:0,dir:1};
   const motion=clamp(Math.hypot(f.vx||0,f.vz||0)/2.5,0,1);
   const mass=clamp(Math.log2(1+Math.max(0,f.w||0))/5,0,1);
   const phase=f.phase||"rest";
   const tail=phase==="shake"?.49:phase==="run"?.16+.29*motion:
     phase==="dive"?.11+.15*motion:phase==="tired"?.055:.10+.12*motion;
   const roll=phase==="shake"?Math.sin((f.swimPhase||t*9)*1.9)*.10:
     phase==="run"?clamp((f.vx||0)/4,-1,1)*.055:0;
   return{phase:Number.isFinite(f.swimPhase)?f.swimPhase:t*5,
     amp:clamp(tail*(1-.18*mass),.05,.48),
     roll,dir:(f.vx||0)>0?-1:1};
 };
 M.rodReaction=function(v,t){
   const f=v&&v.fish,mode=v&&v.mode;
   if(!f||!f.hooked||v.landing||f.jump||mode==="ice")return{x:0,y:0};
   const tension=clamp(f.tension==null?0:f.tension,0,1);
   if(f.phase==="shake"){
     const amp=clamp((1.3+2.1*tension)*(f.S||.4),.5,3.6);
     return{x:Math.sin(t*24)*amp,y:Math.cos(t*27)*amp*.55};
   }
   if(f.phase==="run"){
     const impulse=clamp(Math.abs(f.vx||0)*.42+Math.abs(f.vz||0)*.17,0,2.5);
     return{x:clamp(f.vx||0,-1,1)*impulse,y:impulse*.55};
   }
   if(f.phase==="dive"){
     // A strong fish bows the existing rod tip toward the water.
     const weight=clamp(.6+1.4*tension,0,2.1);
     return{x:Math.sin(t*7)*.16*weight,y:weight};
   }
   return{x:0,y:0};
 };
 // Let a surface lure settle naturally after the angler stops retrieving.
 // spinPause comes from the actual rig, so a stationary lure cannot make a fake wake.
 M.lurePose=function(id,reeling,spinPause,t,pulse){
   const active=!!reeling,kick=clamp(pulse||0,0,1);
   const residual=Math.max(active?1:Math.exp(-8*clamp(spinPause||0,0,8)),kick*.85);
   const wave=(speed)=>Math.sin(t*speed);
   if(id==="wobbler"||id==="sea_wobbler")
     return{visible:true,angle:wave(17)*.22*residual+kick*.10,
       dy:(active?wave(13)*1.35:Math.sin(t*1.7)*.45)-kick*.85,
       roll:active?1:0,wake:active?.85:Math.max(.10*residual,.4*kick),w:18,h:10};
   if(id==="mouse")
     return{visible:true,angle:wave(5)*.07*residual,dy:Math.sin(t*(active?8:1.7))*.62-kick*.35,
       roll:0,wake:active?1:Math.max(.10*residual,.28*kick),w:17,h:11};
   if(id==="spoon"||id==="spinner"||id==="salmon_spinner")
     return{visible:false,angle:0,dy:0,roll:0,wake:0}; // submerged: no fake surface trail
   if(id==="jig"||id==="deep_jig")
     return{visible:false,angle:0,dy:0,roll:0,wake:0};
   return{visible:false,angle:0,dy:0,roll:0,wake:0};
 };
 // Casting pose: lure-specific flutter is visible only during the genuine flight.
 // It does not alter cast distance, fish AI, tackle type or underwater depth.
 M.castPose=function(id,k,t){
   const travel=clamp(k,0,1),air=Math.sin(Math.PI*travel);
   if(id==="spoon"||id==="icespoon")return{
     angle:-travel*.42+Math.sin(t*17)*.27*air,
     sx:1-.17*Math.abs(Math.sin(t*17))*air,sy:1};
   if(id==="spinner"||id==="salmon_spinner")return{
     angle:-travel*.35+Math.sin(t*24)*.16*air,
     sx:1,sy:1-.13*Math.abs(Math.sin(t*24))*air};
   if(id==="jig"||id==="deep_jig")return{angle:-travel*.35,sx:1,sy:1};
   if(id==="mouse")return{angle:-travel*.20,sx:1,sy:1};
   return{angle:-travel*.65+Math.sin(t*9)*.045*air,sx:1,sy:1};
 };
 M.drawSurface=function(ctx,v,p,tk,t,loadImage){
   if(!v||v.mode!=="spin"||!p||v.fish||!tk)return false;
   const baitId=G.loadout("spin").bait;
   if(!baitId)return false;
   const rig=G.rig(),pause=rig&&rig.spinPause||0;
   const pose=M.lurePose(baitId,tk.reeling,pause,t,rig&&rig.spinPulse||0);
   let painted=false;
   if(pose.visible){
     const img=loadImage(baitId==="spoon"||baitId==="wobbler"?baitId:"bait_"+baitId);
     if(img){
       ctx.save();
       ctx.translate(p.x,p.y+pose.dy);
       ctx.rotate(pose.angle);
       // Keep this lure attached to the existing line endpoint.
       ctx.globalAlpha=.83;
       ctx.drawImage(img,-pose.w/2,-pose.h/2,pose.w,pose.h);
       ctx.restore();
       painted=true;
     }
   }
   if(pose.wake>.01){
     const wake=pose.wake,arc=8+4*wake;
     ctx.save();
     ctx.lineWidth=.8;
     ctx.strokeStyle="rgba(225,243,229,"+(.12+.25*wake).toFixed(3)+")";
     ctx.beginPath();ctx.moveTo(p.x-arc,p.y+2);
     ctx.quadraticCurveTo(p.x-arc*.63,p.y-1.8*wake,p.x-2,p.y);
     ctx.stroke();
     ctx.beginPath();ctx.moveTo(p.x-arc,p.y+3);
     ctx.quadraticCurveTo(p.x-arc*.48,p.y+3*wake,p.x-2,p.y+1);
     ctx.stroke();ctx.restore();
   }
   return painted;
 };
 FZ.CozyMotion=M;
})(window.FZ);
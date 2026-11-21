/* Cozy fishing tackle: real game scene + inventory share the same vector assets. */
(function(FZ){
 "use strict";
 const G=FZ.Game,UI=FZ.UI,R=FZ.Scene,Art=FZ.Art;
 if(!G||!UI||!R||!Art)return;
 const root="assets/cozy/",skins=[["classic","Классика"],["forest","Лесной"],["match","Матчевый"]],cache={};
 function skin(){const s=G.state();return (s&&s.settings&&skins.some(x=>x[0]===s.settings.cozyFloatSkin))?s.settings.cozyFloatSkin:"classic"}
 function img(id){
   if(!cache[id]){
     const x=new Image();
     const realistic=FZ.CozyRealArt && FZ.CozyRealArt.scene(id);
     x.src=realistic || root+id+".svg";
     cache[id]=x;
   }
   return cache[id].complete&&cache[id].naturalWidth?cache[id]:null;
 }
 const priorIcon=Art.icon;
 Art.icon=function(id,size){
   let mapped=null;
   if(id==="float")mapped="float_"+skin();
   else if(id==="line")mapped="line_spool";
   else if(id==="hook")mapped="hook";
   else if(id==="feeder")mapped="feeder";
   else if(id==="swivel")mapped="swivel";
   else if(FZ.ROD&&FZ.ROD[id])mapped="rod_"+id;
   else if(FZ.LINE&&FZ.LINE[id])mapped="line_"+id;
   else if(FZ.HOOK&&FZ.HOOK[id])mapped="hook_"+id;
   else if(FZ.BAIT&&FZ.BAIT[id])mapped=(id==="spoon"||id==="wobbler"?id:"bait_"+id);
   else if(id==="gb")mapped="bait_gb";
   else if(FZ.EXTRAS&&FZ.EXTRAS[id])mapped="extra_"+id;
   return mapped?root+mapped+".svg":priorIcon.call(this,id,size);
 };
 // Small waterline displacement is tied to actual float motion, never a
 // permanent halo around a completely submerged or motionless bobber.
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function exposureOf(sink){
   // A disappearing bobber must lose all surface contact and reflection.
   return clamp((.78-Math.max(0,sink||0))/.78,0,1);
 }
 function meniscusStrength(sink,tilt,dx,bob){
   const exposure=exposureOf(sink);
   const activity=Math.min(1,Math.abs(tilt||0)*.7+Math.abs(dx||0)/13+Math.abs(bob||0)*.20);
   return exposure*(.04+.14*activity);
 }
 function reflectionAlpha(sink,tilt,wind,night){
   const exposure=exposureOf(sink);
   // Water is a soft, blurred mirror; a rolling float or windy lake has
   // a weaker reflection. Keep mobile rendering transparent and lightweight.
   return exposure*clamp(.105-.032*Math.abs(tilt||0)-.003*Math.max(0,wind||0),.035,.105)*(night?.53:1);
 }
 const oldFloat=R.drawFloat;
 R.drawFloat=function(p,tk,L,t,night){
   const asset=img("float_"+skin());if(!asset)return oldFloat.apply(this,arguments);
   const ctx=document.getElementById("cv").getContext("2d");
   const z=Math.max(1,tk.Z||10),h=Math.max(11,Math.min(34,30*Math.pow(10/z,.65)));
   // Anchor the image to the same weather-driven endpoint as the line.
   const sink=tk.sink||0,x=p.x+(tk.dx||0),y=p.y+(tk.bob||0);
   const width=h*(skin()==="match"?.47:.65),height=h*1.5;
   ctx.save();
   ctx.beginPath();ctx.rect(x-h*2,y-h*3,h*4,h*3+.5);ctx.clip();
   ctx.translate(x,y);ctx.rotate(-(tk.tilt||0)*1.35);
   if(night)ctx.filter="brightness(.74)";
   ctx.drawImage(asset,-width/2,-h+h*Math.max(0,sink),width,height);
   ctx.restore();
   // A tiny, inverted reflection of the SAME photographic float just below
   // the waterline. It follows pitch and vanishes on a full take.
   const reflection=reflectionAlpha(sink,tk.tilt,
     G.sess()&&G.sess().wx&&G.sess().wx.wind,night);
   if(reflection>.006){
     ctx.save();
     ctx.beginPath();
     ctx.rect(x-width*1.3,y+.55,width*2.6,height*.45);
     ctx.clip();
     ctx.globalAlpha*=reflection;
     ctx.translate(x,y+1);
     ctx.scale(1,-.32);
     ctx.rotate(-(tk.tilt||0)*1.35);
     ctx.drawImage(asset,-width/2,-h+h*Math.max(0,sink),width,height);
     ctx.restore();
   }
   const strength=meniscusStrength(sink,tk.tilt,tk.dx,tk.bob);
   if(night&&R.glow&&strength>.045)R.glow(x,y-h*.67,h*.42);
   if(strength>.018){
     ctx.save();
     ctx.strokeStyle="rgba(219,235,223,"+strength.toFixed(3)+")";
     ctx.lineWidth=.7;
     ctx.beginPath();
     ctx.ellipse(x,y+.9,width*(.75+strength),width*.17,0,0,Math.PI*2);
     ctx.stroke();ctx.restore();
   }
 };
 const oldTackle=UI.showTackle;
 UI.showTackle=function(){
   const result=oldTackle.apply(this,arguments),s=G.sess();
   const sheet=document.querySelector("#ovSheet .sheet");
   if(!s||!sheet)return result;
   const scroll=sheet.querySelector(".scroll.picker")||sheet.querySelector(".scroll");
   if(!scroll)return result;
   if(s.mode==="float"){
     const area=document.createElement("section");
     area.innerHTML='<h3>Поплавок</h3><div class="cozy-skins">'+skins.map(x=>'<button type="button" data-cozy="'+x[0]+'" class="'+(skin()===x[0]?'sel':'')+'"><img src="'+root+'float_'+x[0]+'.svg" alt=""><small>'+x[1]+'</small></button>').join("")+'</div>';
     const depth=scroll.querySelector("#tkDepth"),drag=scroll.querySelector("#tkDrag");
     if(depth)depth.insertAdjacentElement("afterend",area);else if(drag)drag.insertAdjacentElement("beforebegin",area);else scroll.appendChild(area);
     area.querySelectorAll("[data-cozy]").forEach(btn=>btn.addEventListener("click",function(){
       G.state().settings.cozyFloatSkin=btn.getAttribute("data-cozy");
       G.save(true);if(FZ.Sound&&FZ.Sound.click)FZ.Sound.click();
       area.querySelectorAll("button").forEach(b=>b.classList.toggle("sel",b===btn));
       if(UI.refreshTools)UI.refreshTools();
     }));
   }
   sheet.querySelectorAll("[data-line],[data-hook]").forEach(row=>{
     if(row.querySelector(".cozy-gear-mini"))return;
     const n=row.hasAttribute("data-line")?"line_spool":"hook",i=document.createElement("img");
     i.src=root+n+".svg";i.className="cozy-gear-mini";i.alt="";
     row.insertBefore(i,row.firstChild);
   });
   return result;
 };
 FZ.CozyGear={
   meniscusStrength,reflectionAlpha,
   lineStyle(v,L){
     const id=G.loadout(v.mode).line||"l1";
     const widths={l1:.85,l2:.97,l3:1.06,l4:1.14,l5:1.17,l6:1.29,l7:1.34,l8:1.43};
     const braid=id==="l5"||id==="l6"||id==="l7"||id==="l8";
     return {width:widths[id]||1,color:braid?"rgba(192,202,148,.78)":"rgba(229,236,218,.73)"};
   },
   drawCasting(ctx,v,x,y,k,t){
     let n="float_"+skin();if(v.mode==="feeder")n="feeder";
     if(v.mode==="spin"){
       const bait=G.loadout("spin").bait||"spinner";
       n=bait==="spoon"||bait==="wobbler"?bait:"bait_"+bait;
     }
     const im=img(n);if(!im)return false;
     const w=v.mode==="float"?7:14,h=v.mode==="float"?14:10;
     const pose=FZ.CozyMotion&&v.mode==="spin"
       ?FZ.CozyMotion.castPose(G.loadout("spin").bait||"spinner",k,t)
       :{angle:-k*.7+Math.sin(t*10)*.04,sx:1,sy:1};
     ctx.save();ctx.translate(x,y);ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);
     ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();return true;
   },
   surface(ctx,v,p,tk,t){
     // Feeder tackle and submerged spinners/spoons/jigs must not leave
     // permanent surface rings. The real point of entry is still the line endpoint.
     if(v.mode==="spin"&&FZ.CozyMotion)
       FZ.CozyMotion.drawSurface(ctx,v,p,tk,t,img);
   }
 };
})(window.FZ);
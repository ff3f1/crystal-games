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
 const oldFloat=R.drawFloat;
 R.drawFloat=function(p,tk,L,t,night){
   const asset=img("float_"+skin());if(!asset)return oldFloat.apply(this,arguments);
   const ctx=document.getElementById("cv").getContext("2d");
   const z=Math.max(1,tk.Z||10),h=Math.max(11,Math.min(34,30*Math.pow(10/z,.65)));
   const sink=tk.sink||0,x=p.x+(tk.dx||0),y=p.y+Math.sin(t*2.1)*.6+(tk.bob||0);
   const width=h*(skin()==="match"?.47:.65),height=h*1.5;
   ctx.save();
   ctx.beginPath();ctx.rect(x-h*2,y-h*3,h*4,h*3+.5);ctx.clip();
   ctx.translate(x,y);ctx.rotate(-(tk.tilt||0)*1.35);
   if(night)ctx.filter="brightness(.74)";
   ctx.drawImage(asset,-width/2,-h+h*Math.max(0,sink),width,height);
   ctx.restore();
   if(night&&R.glow)R.glow(x,y-h*.67,h*.45);
   ctx.save();ctx.globalAlpha=.32;ctx.strokeStyle="#e6eee0";ctx.lineWidth=.8;
   ctx.beginPath();ctx.ellipse(x,y+1,width*.95,width*.24,0,0,Math.PI*2);ctx.stroke();ctx.restore();
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
     ctx.save();ctx.translate(x,y);ctx.rotate(-k*.7+Math.sin(t*10)*.04);
     ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();return true;
   },
   surface(ctx,v,p,tk,t){
     // Exactly one animated surface lure at the real line endpoint.
     if(FZ.CozyMotion)FZ.CozyMotion.drawSurface(ctx,v,p,tk,t,img);
     ctx.save();ctx.strokeStyle="rgba(230,245,226,.33)";ctx.lineWidth=.8;
     ctx.beginPath();ctx.ellipse(p.x,p.y+1,tk.reeling?7:4,tk.reeling?2.6:1.4,0,0,Math.PI*2);ctx.stroke();
     // Wake is handled in FZ.CozyMotion and only on genuine retrieve.
     ctx.restore();
   }
 };
})(window.FZ);
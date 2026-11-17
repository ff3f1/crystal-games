/* Complete rod artwork and calibrated anchors shared by WebGL and Canvas.
 * Each mode is ONE transparent image. No independent grip / blank / reel sprites. */
(function(FZ){
 "use strict";
 const C={
   float:{tipX:59,baseX:1108,axisY:112,reelX:818,reelY:206,hd:true},
   feeder:{tipX:55,baseX:818,axisY:130,reelX:562,reelY:196,hd:true},
   spin:{tipX:57,baseX:836,axisY:132,reelX:567,reelY:208,hd:true},
   ice:{tipX:920,baseX:1390,axisY:53,reelX:1202,reelY:145,hd:true}
 };
 const modes=Object.keys(C), images={};
 function load(mode){
   if(!C[mode])mode="float";
   if(images[mode])return images[mode];
   const img=new Image();images[mode]=img;
   img.src=C[mode].hd?"assets/equipment/complete-hd/"+mode+".webp":"assets/equipment/complete/"+mode+".svg";
   return img;
 }
 function layout(mode,base,tip){
   const c=C[mode]||C.float;
   const length=Math.hypot(base.x-tip.x,base.y-tip.y);
   const scale=length/(c.baseX-c.tipX);
   const angle=Math.atan2(base.y-tip.y,base.x-tip.x);
   return {spec:c,length,scale,angle};
 }
 function draw(ctx,mode,base,tip,reelAngle){
   const im=load(mode);
   if(!im.complete||!im.naturalWidth)return false;
   const p=layout(mode,base,tip),c=p.spec;
   ctx.save();
   ctx.translate(base.x,base.y);ctx.rotate(p.angle);ctx.scale(p.scale,p.scale);
   ctx.drawImage(im,-c.baseX,-c.axisY,1440,300);
   ctx.save();ctx.translate(c.reelX-c.baseX,c.reelY-c.axisY);
   if(!c.hd)mechanism(ctx,mode,reelAngle||0,0);
   ctx.restore();ctx.restore();
   return true;
 }

 // Coordinates are in the complete artwork's local space, around its reel axle.
 function mechanism(ctx,mode,angle,slip) {
   const ice=mode==="ice",sx=ice?0:-60,sy=ice?0:5;
   const metal=ctx.createLinearGradient(-45,-35,30,40);
   metal.addColorStop(0,"#48575d");metal.addColorStop(.35,"#f3eee0");metal.addColorStop(.6,"#7b939b");metal.addColorStop(1,"#222e35");
   ctx.save();ctx.lineCap="round";
   if(ice) {
     ctx.save();ctx.rotate(angle);
     ctx.strokeStyle=metal;ctx.lineWidth=3;
     for(let i=0;i<6;i++){const q=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(q)*13,Math.sin(q)*13);ctx.lineTo(Math.cos(q)*27,Math.sin(q)*27);ctx.stroke();}
     ctx.fillStyle="#d4ac62";ctx.beginPath();ctx.arc(24,0,5,0,Math.PI*2);ctx.fill();ctx.restore();
   } else {
     // Axial spool oscillation and a rotating bail with a line roller.
     const oscillation=Math.sin(angle*.62)*3;
     ctx.save();ctx.translate(sx+oscillation,sy);
     ctx.fillStyle="#53665c";ctx.strokeStyle=metal;ctx.lineWidth=3;
     ctx.beginPath();ctx.ellipse(0,0,25,32,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
     ctx.strokeStyle="#b6c7a5";ctx.lineWidth=1;
     for(let i=-3;i<=3;i++){ctx.beginPath();ctx.ellipse(i*2,0,18,28,-.2,0,Math.PI*2);ctx.stroke();}
     const q=angle*4.8,rx=37,ry=42;
     ctx.strokeStyle=metal;ctx.lineWidth=4;
     ctx.beginPath();
     ctx.moveTo(Math.cos(q)*rx,Math.sin(q)*ry);
     ctx.bezierCurveTo(Math.cos(q+.9)*51,Math.sin(q+.9)*52,Math.cos(q+2.2)*51,Math.sin(q+2.2)*52,Math.cos(q+Math.PI)*rx,Math.sin(q+Math.PI)*ry);ctx.stroke();
     ctx.fillStyle="#d8e4e1";ctx.beginPath();ctx.ellipse(Math.cos(q)*rx,Math.sin(q)*ry,5,4,q,0,Math.PI*2);ctx.fill();
     if(slip){ctx.strokeStyle="#e9ca87";ctx.beginPath();ctx.arc(0,0,14,slip,slip+1.6);ctx.stroke();}
     ctx.restore();
     ctx.save();ctx.rotate(angle);ctx.strokeStyle="#142128";ctx.lineWidth=9;
     ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(20,8);ctx.lineTo(30,24);ctx.stroke();
     ctx.strokeStyle=metal;ctx.lineWidth=5;ctx.stroke();
     ctx.translate(30,24);ctx.rotate(-angle);ctx.fillStyle="#17272d";ctx.strokeStyle="#879b9d";ctx.lineWidth=2;
     ctx.beginPath();ctx.ellipse(0,0,7,12,.25,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
   }
   ctx.restore();
 }
 function landingPose(v,W,H,project) {
   const f=v.fish,k=Math.max(0,Math.min(1,v.landing.k)),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
   const p=project(f.X,Math.max(3.6,f.Z)),lift=smooth((k-.46)/.54),approach=1-smooth(k/.42);
   const initial=4*Math.min(85,Math.max(7,p.s*(f.lenM||.4)/3.5));
   const length=initial+(Math.min(W*.64,Math.max(initial, (f.lenM||.4)*210))-initial)*lift;
   const radius=Math.max(W*.11,length*.61);
   const y=p.y-lift*H*.19;
   return {x:p.x+approach*W*.62,y:y+approach*H*.38,
     fishX:p.x,fishY:y+lift*radius*.15,length,radius,lift,
     sag:.7+lift*.38,phase:k<.42?"approach":k<.62?"scoop":"lift"};
 }

 modes.forEach(load);
 FZ.RodArt={modes,info:m=>C[m]||C.float,hd:m=>!!(C[m]&&C[m].hd),image:load,layout,draw,mechanism,landingPose};
})(window.FZ);

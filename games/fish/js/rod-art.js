/* Complete rod artwork and calibrated anchors shared by WebGL and Canvas.
 * Each mode is ONE transparent image. No independent grip / blank / reel sprites. */
(function(FZ){
 "use strict";
 const C={
   float:{tipX:70,baseX:1240,axisY:145,reelX:1137,reelY:215},
   feeder:{tipX:70,baseX:1240,axisY:145,reelX:1137,reelY:215},
   spin:{tipX:70,baseX:1240,axisY:145,reelX:1137,reelY:215},
   ice:{tipX:505,baseX:1240,axisY:145,reelX:1088,reelY:189}
 };
 const modes=Object.keys(C), images={};
 function load(mode){
   if(!C[mode])mode="float";
   if(images[mode])return images[mode];
   const img=new Image();images[mode]=img;
   img.src="assets/equipment/complete/"+mode+".svg";
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
   // A tiny rotating highlight follows the real reel axle already painted into the whole asset.
   ctx.save();ctx.translate(c.reelX-c.baseX,c.reelY-c.axisY);ctx.rotate(reelAngle||0);
   ctx.lineWidth=2.7;ctx.lineCap="round";ctx.strokeStyle="#bbc8c5";
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(11,6);ctx.stroke();
   ctx.fillStyle="#242e34";ctx.beginPath();ctx.arc(11,6,4,0,Math.PI*2);ctx.fill();
   ctx.restore();ctx.restore();
   return true;
 }
 modes.forEach(load);
 FZ.RodArt={modes,info:m=>C[m]||C.float,image:load,layout,draw};
})(window.FZ);

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
 function draw(ctx,mode,base,tip,reelAngle,bend){
   const im=load(mode);
   if(!im.complete||!im.naturalWidth)return false;
   const p=layout(mode,base,tip),c=p.spec;
   ctx.save();
   ctx.translate(base.x,base.y);ctx.rotate(p.angle);ctx.scale(p.scale,p.scale);
   const flexEnd = Math.round(c.reelX - 74);
   const flex = (bend || 0) * (mode === "ice" ? 26 : 115);
   if (flex > 4 && flexEnd > c.tipX) {
     // Warp the blank while the grip and the reel remain aligned.
     const step = (flexEnd - c.tipX) / 14;
     for (let left = 0; left < flexEnd;) {
       const right = Math.min(flexEnd, left < c.tipX ? c.tipX : Math.round(left + step));
       const q = Math.max(0, ((left + right) / 2 - c.tipX) / (flexEnd - c.tipX));
       const offset = flex * 6.75 * q * (1 - q) * (1 - q);
       const slope = left < c.tipX ? 0 : flex * 6.75 * (1 - 4 * q + 3 * q * q) / (flexEnd - c.tipX);
       const width = Math.min(1440 - left, right - left + 1);
       ctx.save();
       ctx.translate(left - c.baseX, offset - slope * (right - left) / 2);
       ctx.transform(1, slope, 0, 1, 0, 0);
       ctx.drawImage(im, left, 0, width, 300, 0, -c.axisY, width, 300);
       ctx.restore();
       left = right;
     }
     ctx.drawImage(im, flexEnd, 0, 1440 - flexEnd, 300, flexEnd - c.baseX, -c.axisY, 1440 - flexEnd, 300);
   } else ctx.drawImage(im,-c.baseX,-c.axisY,1440,300);
   if (reelAngle) {
     ctx.save();
     ctx.translate(c.reelX - c.baseX, c.reelY - c.axisY);
     drawCrank(ctx, mode, reelAngle);
     ctx.restore();
   }
   ctx.restore();
   return true;
 }

 function drawCrank(ctx, mode, angle) {
   const ice = mode === "ice";
   ctx.rotate(angle);
   ctx.lineCap = "round";
   ctx.strokeStyle = "#26383c";
   ctx.lineWidth = ice ? 6 : 8;
   ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ice ? 22 : 26, 9); ctx.lineTo(ice ? 26 : 35, 15); ctx.stroke();
   ctx.strokeStyle = "#b8c3bc";
   ctx.lineWidth = 3;
   ctx.stroke();
   ctx.fillStyle = "#213436";
   ctx.beginPath(); ctx.ellipse(ice ? 26 : 35, 15, 6, ice ? 8 : 11, 0, 0, Math.PI * 2); ctx.fill();
   ctx.strokeStyle = "#819b96";
   ctx.lineWidth = 1.8;
   ctx.stroke();
 }

 modes.forEach(load);
 FZ.RodArt={modes,info:m=>C[m]||C.float,hd:m=>!!(C[m]&&C[m].hd),image:load,layout,draw};
})(window.FZ);

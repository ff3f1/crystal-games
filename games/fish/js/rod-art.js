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
 // Integrate the curvature of a tapered cantilever under a load at the tip.
 const steps = 48, profile = [{ y: 0, slope: 0, arc: 0 }];
 for (let i = 1; i <= steps; i++) {
   const previous = profile[i - 1], q = (i - 0.5) / steps;
   const rigidity = (1 - 0.64 * q) ** 4;
   const slope = previous.slope + (1 - q) / rigidity / steps;
   const mean = (previous.slope + slope) * 0.5;
   profile.push({ y: previous.y + mean / steps, slope, arc: previous.arc + mean * mean / steps });
 }
 const tipProfile = profile[steps];
 function sample(q, field) {
   const index = Math.min(steps - 1, Math.floor(q * steps)), f = q * steps - index;
   return profile[index][field] + (profile[index + 1][field] - profile[index][field]) * f;
 }
 function solve(mode, base, neutral, target, load, power) {
   const p = layout(mode, base, neutral), c = p.spec;
   const flexEnd = c.reelX - 74, span = flexEnd - c.tipX;
   const L = Math.max(1, span * p.scale);
   const nx = -Math.sin(p.angle), ny = Math.cos(p.angle);
   const ux = -ny, uy = nx;
   let delta = 0;
   if (target && load > 0) {
     const dx = target.x - neutral.x, dy = target.y - neutral.y;
     const normal = dx * nx + dy * ny, along = dx * ux + dy * uy;
     const compliance = L * 0.31 * Math.min(1.1, load / power);
     let lo = 0, hi = Math.min(Math.abs(normal), compliance);
     // The force acts along the line from the displaced tip, not the rest pose.
     for (let i = 0; i < 9; i++) {
       const d = (lo + hi) * 0.5, remaining = Math.abs(normal) - d;
       if (d * Math.hypot(along, remaining) < compliance * remaining) lo = d;
       else hi = d;
     }
     delta = Math.sign(normal) * (lo + hi) * 0.5;
   }
   const lengthRecovery = 0.5 * delta * delta / L;
   const tipRetreat = lengthRecovery * tipProfile.arc / tipProfile.y ** 2;
   const tip = { x: neutral.x + nx * delta - ux * tipRetreat, y: neutral.y + ny * delta - uy * tipRetreat };
   return { ...p, flexEnd, span, delta, lengthRecovery, nx, ny, ux, uy, tip };
 }
 function pointAt(base, beam, t) {
   const at = beam.length * t;
   const root = (beam.spec.baseX - beam.flexEnd) * beam.scale;
   const q = Math.max(0, Math.min(1, (at - root) / Math.max(1, beam.span * beam.scale)));
   const move = beam.delta * sample(q, "y") / tipProfile.y;
   const retreat = beam.lengthRecovery * sample(q, "arc") / tipProfile.y ** 2;
   return { x: base.x + beam.ux * (at - retreat) + beam.nx * move,
     y: base.y + beam.uy * (at - retreat) + beam.ny * move };
 }
 function lineSag(from, to, load, screenHeight) {
   const horizontal = Math.abs(to.x - from.x);
   const distance = Math.hypot(horizontal, to.y - from.y);
   if (distance < 1) return 0;
   const horizontalLoad = Math.max(0.013, load * horizontal / distance);
   const weight = 0.00055 * 800 / screenHeight;
   return Math.min(horizontal * 0.16, weight * horizontal * horizontal / (8 * horizontalLoad));
 }
 function draw(ctx, mode, base, beam, reelAngle) {
   const im = load(mode);
   if (!im.complete || !im.naturalWidth) return false;
   const { spec: c, angle, scale, flexEnd, span, delta, lengthRecovery } = beam;
   if (!(scale > 0)) return false;
   ctx.save();
   ctx.translate(base.x, base.y); ctx.rotate(angle); ctx.scale(scale, scale);
   if (Math.abs(delta) >= 0.15) {
     const flex = delta / (scale * tipProfile.y), axial = lengthRecovery / (scale * tipProfile.y ** 2);
     const step = span / 18;
     for (let left = 0; left < flexEnd;) {
       const right = Math.min(flexEnd, left < c.tipX ? c.tipX : Math.round(left + step));
       const middle = (left + right) / 2, q = Math.max(0, Math.min(1, (flexEnd - middle) / span));
       const shapeSlope = sample(q, "slope");
       const slope = left < c.tipX ? 0 : -flex * shapeSlope / span;
       const stretch = left < c.tipX ? 0 : -axial * shapeSlope ** 2 / span;
       const width = right - left + 1;
       ctx.save();
       ctx.translate(left - c.baseX + axial * sample(q, "arc") - stretch * (middle - left),
         flex * sample(q, "y") - slope * (middle - left));
       ctx.transform(1 + stretch, slope, 0, 1, 0, 0);
       ctx.drawImage(im, left, 0, width, 300, 0, -c.axisY, width, 300);
       ctx.restore();
       left = right;
     }
     ctx.drawImage(im, flexEnd, 0, 1440 - flexEnd, 300, flexEnd - c.baseX, -c.axisY, 1440 - flexEnd, 300);
   } else ctx.drawImage(im, -c.baseX, -c.axisY, 1440, 300);
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
 FZ.RodArt={modes,info:m=>C[m]||C.float,hd:m=>!!(C[m]&&C[m].hd),image:load,layout,solve,pointAt,lineSag,draw};
})(window.FZ);

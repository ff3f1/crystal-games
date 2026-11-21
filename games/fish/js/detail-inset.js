/* Close-up optics for float and spin. Only the active bite supplies a fish.
 * Photographic equipment sprites and actual species sprites replace mock silhouettes. */
(function(FZ){
  'use strict';
  const R=FZ.Scene,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let layout=null,layoutAt=-1,layoutKey='';
  function rect(w,h){
    const controls=typeof document==='undefined'?[]:
      Array.from(document.querySelectorAll('button,input,select,[role="button"],#bAct'))
        .map(e=>e.getBoundingClientRect()).filter(b=>b.width>0&&b.height>0);
    return R.lureInsetRect(w,h,controls);
  }
  function water(g,x,y,w,h,t,light){
    const sea=g.createLinearGradient(x,y,x,y+h);
    sea.addColorStop(0,'#547b80');sea.addColorStop(.17,'#254a54');
    sea.addColorStop(.65,'#163741');sea.addColorStop(1,'#0c252d');
    g.fillStyle=sea;g.fillRect(x,y,w,h);
    // Soft subsurface light scattering and moving caustics, clipped to inset.
    const sh=g.createLinearGradient(x+w*.16,y,x+w*.7,y+h);
    sh.addColorStop(0,'rgba(208,233,210,.19)');
    sh.addColorStop(.4,'rgba(210,227,203,.025)');
    sh.addColorStop(1,'rgba(160,198,185,0)');
    g.fillStyle=sh;g.beginPath();g.moveTo(x+w*.21,y);
    g.lineTo(x+w*.66,y);g.lineTo(x+w*.97,y+h);g.lineTo(x+w*.4,y+h);g.fill();
    g.strokeStyle='rgba(172,214,209,.12)';
    for(let i=0;i<8;i++){
      const yy=y+16+i*11;
      const px=x+((i*.391+t*.018)%1)*w;
      g.lineWidth=.4+i*.025;
      g.beginPath();g.moveTo(px-12,yy);g.bezierCurveTo(px-4,yy-2,px+7,yy+2,px+19,yy-1);g.stroke();
    }
    // Gentle depth haze, no flat cartoon strip.
    const ground=g.createLinearGradient(x,y+h*.79,x,y+h);
    ground.addColorStop(0,'rgba(20,35,33,0)');
    ground.addColorStop(1,'rgba(37,43,36,.62)');
    g.fillStyle=ground;g.fillRect(x,y+h*.79,w,h*.21);
  }
  function paintedLure(g,kind,t){
    const wobble=Math.sin(t*13)*.12;
    g.save();g.rotate(wobble);
    if(kind==='bottom'){
      const body=g.createLinearGradient(-15,-6,12,7);
      body.addColorStop(0,'#42595b');body.addColorStop(.45,'#c8c6aa');body.addColorStop(1,'#536763');
      g.fillStyle=body;g.beginPath();g.ellipse(-4,0,8,5,-.25,0,Math.PI*2);g.fill();
      g.strokeStyle='#d5b985';g.lineWidth=2.2;
      g.beginPath();g.moveTo(4,1);g.bezierCurveTo(13,0,19,Math.sin(t*7)*5,25,Math.sin(t*7)*4);g.stroke();
    }else{
      const steel=g.createLinearGradient(-13,-5,13,5);
      steel.addColorStop(0,'#44585b');steel.addColorStop(.3,'#dbe6dc');steel.addColorStop(.6,'#f0d7aa');steel.addColorStop(1,'#5a777c');
      g.fillStyle=steel;g.beginPath();g.ellipse(0,0,12,4.5,Math.sin(t*10)*.32,0,Math.PI*2);g.fill();
      g.strokeStyle='#a7b5ae';g.lineWidth=1;g.beginPath();g.moveTo(-12,0);g.lineTo(12,0);g.stroke();
    }
    g.strokeStyle='rgba(206,215,212,.8)';g.lineWidth=1;
    g.beginPath();g.arc(12,3,3,0,Math.PI);g.stroke();g.restore();
  }
  function fish(g,approach,x,y,t,size){
    if(!approach||!approach.species||!FZ.Art||typeof FZ.Art.drawFish!=='function')return;
    const k=clamp(approach.progress||0,0,1),species=approach.species;
    // Fish does not materialize until a real eligible bite has been initiated.
    const px=x+(1-k)*Math.min(75,size*1.8),py=y+Math.sin(t*3.5)*2;
    const dir=-1;
    g.save();g.globalAlpha=.35+k*.45;
    FZ.Art.drawFish(g,species,px,py,size*(.7+k*.32),{
      silhouette:k<.45,alpha:.72,phase:t*6,amp:.18+.15*k,dir
    });
    g.restore();
  }
  R.drawLureInset=function(g,v,w,h){
    // Don't mask the real lake with a schematic underwater box.
    if(FZ.LivingWater)return;
    if(v.ice||(v.mode!=='spin'&&v.mode!=='float')||(FZ.UI&&FZ.UI.anyOpen()))return;
    const isSpin=v.mode==='spin',tk=v.tackle||{};
    if(tk.state!=='water'&&tk.state!=='fight')return;
    if(isSpin&&!v.lure)return;
    if(!isSpin&&tk.state==='fight')return;
    const key=w+'x'+h;
    if(key!==layoutKey||v.t<layoutAt||v.t-layoutAt>.6){
      layout=rect(w,h);layoutAt=v.t;layoutKey=key;
    }
    const box=layout;if(!box)return;
    const x=box.x,y=box.y,bw=box.w,bh=box.h,t=v.t;
    const surface=y+28;
    g.save();
    g.beginPath();g.roundRect(x,y,bw,bh,8);g.clip();
    water(g,x,y,bw,bh,t,1);
    const waveY=surface+Math.sin(t*1.8)*.8;
    g.strokeStyle='rgba(231,242,220,.38)';g.lineWidth=1.2;
    g.beginPath();g.moveTo(x,waveY);
    for(let i=0;i<16;i++){
      const xx=x+(i+1)*bw/16;
      g.lineTo(xx,waveY+Math.sin(i*.9+t*1.9)*1.2);
    }
    g.stroke();
    if(isSpin){
      const l=v.lure;
      const depth=clamp(l.depth/Math.max(.4,l.waterDepth),0,1);
      const speed=clamp(l.speed||0,0,4);
      const lx=x+bw*.43+(l.reeling?Math.sin(t*2)*1.5:0);
      const ly=surface+15+depth*(bh-65);
      fish(g,l.approach,lx+17,ly,t,Math.min(45,bw*.3));
      // The lure follows actual depth and reel speed; distinct realistic play per lure type.
      const isWobbler = l.baitId && (l.baitId.indexOf("wobbler") >= 0);
      const isJig = l.kind === "bottom";
      const wobbleFreq = isWobbler ? 24 : isJig ? 16 : 12;
      const wobbleAmp = (l.reeling ? (isWobbler ? 0.22 : 0.16) : (l.twitch ? 0.35 : 0.05));
      const fallAngle = (!l.reeling && isJig && (l.speed || 0) < 0.05) ? 0.38 : 0;
      g.strokeStyle='rgba(220,238,228,.42)';g.lineWidth=.7;
      g.beginPath();g.moveTo(lx+(l.reeling?5:0),y);g.quadraticCurveTo(lx-6,surface+6,lx,ly);g.stroke();
      g.save();g.translate(lx,ly);
      g.rotate(Math.sin(t*(3+speed*wobbleFreq))*wobbleAmp+(l.twitch||0)*.25+fallAngle);
      if (l.reeling && speed > 0.2) {
        g.strokeStyle = "rgba(200,240,245,0.45)"; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(-20 - speed * 3, Math.sin(t * 20) * 1.8); g.stroke();
      }
      const lure=FZ.Assets&&FZ.Assets.item(l.baitId||'spinner');
      if(lure){
        const scale=clamp(bw*.20/Math.max(lure.width,lure.height),.045,.3);
        g.drawImage(lure,-lure.width*scale*.45,-lure.height*scale*.45,lure.width*scale,lure.height*scale);
      }else paintedLure(g,l.kind,t);
      g.restore();
      g.fillStyle='rgba(232,243,233,.92)';g.font='10px sans-serif';
      g.fillText('Проводка · '+l.depth.toFixed(1)+' м',x+8,y+14);
      g.fillStyle='rgba(210,231,223,.78)';g.fillText(l.style,x+8,y+bh-8);
    }else{
      const sink=clamp(tk.sink||0,-1,1),bx=x+bw*.53+(tk.dx||0)*.4,by=surface+Math.sin(t*2)*1.2+sink*13;
      const bite=v.floatDetail&&v.floatDetail.approach;
      fish(g,bite,bx+12,surface+44,t,Math.min(38,bw*.28));
      const ff=FZ.Assets&&FZ.Assets.item('float');
      if(ff){
        const hgt=clamp(bh*.33,23,49),width=hgt*ff.width/ff.height;
        g.save();g.translate(bx,by);g.rotate(-clamp(tk.tilt||0,-1,1)*.52+Math.sin(t*1.8)*.016);
        g.drawImage(ff,-width/2,-hgt*.73,width,hgt);g.restore();
      }else{
        const varnish=g.createLinearGradient(bx-5,by,bx+5,by);
        varnish.addColorStop(0,'#5e201b');varnish.addColorStop(.45,'#eb6e42');varnish.addColorStop(1,'#47251c');
        g.fillStyle=varnish;g.beginPath();g.ellipse(bx,by-13,4,18,-(tk.tilt||0)*.4,0,Math.PI*2);g.fill();
      }
      g.fillStyle='rgba(232,243,233,.92)';g.font='10px sans-serif';g.fillText('Поплавок · '+(bite?'поклёвка':'ожидание'),x+8,y+14);
      g.fillStyle='rgba(210,231,223,.78)';g.fillText(bite?'Рыба у насадки':'Следите за антенной',x+8,y+bh-8);
    }
    g.strokeStyle='rgba(204,231,221,.35)';g.lineWidth=1;g.strokeRect(x+.5,y+.5,bw-1,bh-1);
    g.restore();
  };
})(window.FZ);

/* Physically scaled, texture-backed disturbances, shared by Canvas and WebGL overlay.
 * Activity only comes from Game.view().spots; rendering does not invent feeding fish. */
(function(FZ){
  'use strict';
  const rings=[], spray=[], droplets=[];
  const TAU=Math.PI*2, MAX_RINGS=48, MAX_SPRAY=100;
  let waveTex=null, dropTex=null, foamTex=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function canvasTex(w,h,paint){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d'),im=g.createImageData(w,h),a=im.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=(y*w+x)*4,rgba=paint(x,y,w,h);
      a[p]=rgba[0];a[p+1]=rgba[1];a[p+2]=rgba[2];a[p+3]=rgba[3];
    }
    g.putImageData(im,0,0);return c;
  }
  function ensureTextures(){
    if(waveTex)return;
    waveTex=[];
    for(let frame=0;frame<12;frame++){
      const age=frame/11;
      waveTex.push(canvasTex(128,128,(x,y,w,h)=>{
        const dx=(x-w*.5)/(w*.5),dy=(y-h*.5)/(h*.5);
        const r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
        const distortion=.014*Math.sin(angle*7+age*9)+.009*Math.sin(angle*13-age*5);
        const center=.36+age*.42+distortion;
        const width=.015+age*.013;
        const u=(r-center)/width;
        const crest=Math.exp(-u*u*1.4);
        const trailing=Math.exp(-Math.pow((r-center+width*2.5)/(width*1.8),2))*.36;
        const wake=clamp((Math.sin(angle*6+age*11)*.14+.78),.5,1);
        const alpha=clamp((crest+trailing)*wake*(1-age*.64),0,1)*182;
        return [220,240,244,Math.round(alpha)];
      }));
    }
    dropTex=canvasTex(32,32,(x,y)=>{
      const d=Math.hypot((x-15.5)/16,(y-15.5)/16);
      const edge=Math.exp(-Math.pow(d/.57,3));
      const sparkle=Math.exp(-((x-11)*(x-11)+(y-10)*(y-10))/21);
      return [218+Math.round(sparkle*34),233+Math.round(sparkle*22),244,Math.round(clamp(edge*.74+sparkle*.42,0,1)*238)];
    });
    foamTex=canvasTex(64,64,(x,y)=>{
      const dx=(x-32)/32,dy=(y-32)/32,r=Math.hypot(dx,dy);
      const grain=Math.sin(x*1.7+y*2.3)*Math.cos(x*3.1-y*2.1);
      const bubbles=Math.pow(Math.max(0,Math.sin(x*.71+y*.35)*Math.cos(y*.85-x*.27)),8);
      const a=clamp((1-r*r)*(.34+.43*bubbles+.07*grain),0,1);
      return [215,235,240,Math.round(a*190)];
    });
  }
  function ring(X,Z,size,life){
    if(!Number.isFinite(X)||!Number.isFinite(Z))return;
    if(rings.length>=MAX_RINGS)rings.shift();
    rings.push({X,Z,size:clamp(Number(size)||.4,.08,2.6),life:clamp(Number(life)||1.5,.3,3.5),age:0,seed:Math.random()*TAU});
  }
  function splash(X,Z,power){
    const strength=clamp(Number(power)||.45,.1,2.5);
    ring(X,Z,.25+strength*.6,1.4+strength*.4);
    ring(X,Z,.17+strength*.42,1.1+strength*.35);
    const count=Math.min(29,Math.round(7+strength*14));
    for(let i=0;i<count;i++){
      const theta=Math.random()*TAU,speed=(15+Math.random()*55)*(.45+strength*.55);
      if(spray.length>=MAX_SPRAY)spray.shift();
      spray.push({X,Z,dx:0,dy:0,vx:Math.cos(theta)*speed,vy:-speed*(.75+Math.random()*1.2),
        age:0,life:.36+Math.random()*.62,scale:.7+Math.random()*1.8,gravity:205+Math.random()*135});
    }
  }
  function bubbles(X,Z,n){
    for(let i=0;i<Math.min(8,n||3);i++){
      if(droplets.length>=36)droplets.shift();
      droplets.push({X:X+(Math.random()-.5)*.45,Z:Z+(Math.random()-.5)*.4,
        age:-Math.random()*.4,life:.65+Math.random()*.8,seed:Math.random()*TAU});
    }
  }
  function drawRing(g,p,k,fade,size,seed){
    const radius=clamp(p.s*size*(.35+k*1.6),4,125);
    const c=waveTex[Math.min(11,Math.floor(k*12))];
    g.globalAlpha=fade;
    g.drawImage(c,p.x-radius,p.y-radius*.43,radius*2,radius*.86);
    // Multiple nearby capillary fronts, not a rigid perfect circle.
    if(radius>7){
      const off=Math.sin(seed+k*8)*radius*.12;
      g.globalAlpha=fade*.24;
      g.drawImage(c,p.x-radius*.73+off,p.y-radius*.33,radius*1.46,radius*.66);
    }
  }
  // Real mechanical feeding/hunting areas must read clearly above photo water.
  // The center and spatial radius are exactly the same ones used by spotBonus().
  // All marks are projections of active sess.spots. No random decorative fish.
  // The dark wake and bright broken crests stay legible on both pale and dark water.
  function activity(g,v,project){
    if(!v||v.ice||!v.spots||!v.spots.length)return;
    ensureTextures();
    g.save();
    for(const sp of v.spots){
      if(!(sp.life>0&&sp.intensity>0))continue;
      const pred=sp.type==="boil",power=clamp(sp.intensity,0,1);
      const age=Math.max(0,(sp.duration||sp.life)-sp.life);
      const center=project(sp.X,sp.Z);
      const zoneSize=sp.radius||4.5;
      // Tie the visible footprint to the real spotBonus radius, not an arbitrary
      // screen-space decal. The smallest crest remains readable at 360px.
      const physicalRadius=Math.max(1,Math.abs(project(sp.X+zoneSize,sp.Z).x-center.x));
      const radius=clamp(physicalRadius*.65,24,108);
      const lifeFade=clamp(sp.life/2,0,1);
      const envelope=power*lifeFade;
      const cycle=pred?1.45:2.15;
      const rhythm=.78+.22*Math.sin(age*(pred?5.4:3.1));
      const reach=radius*(pred?1.05:.82);
      g.globalCompositeOperation="source-over";
      const shadow=g.createRadialGradient(center.x,center.y,0,center.x,center.y,reach);
      shadow.addColorStop(0,"rgba(9,35,39,"+(.36*envelope)+")");
      shadow.addColorStop(.55,"rgba(19,51,56,"+(.21*envelope)+")");
      shadow.addColorStop(1,"rgba(12,46,49,0)");
      g.fillStyle=shadow;
      g.beginPath();g.ellipse(center.x,center.y,reach,reach*.39,0,0,TAU);g.fill();
      // Irregular short waves repeatedly emanate from actual feeding points.
      // Keeping bright AND dark edges is essential on sunny water and in rain.
      for(let i=0;i<(pred?8:7);i++){
        const seed=i*2.3999632;
        const phase=((age/cycle+i*.171)%1+1)%1;
        const bearing=seed+Math.sin(age*.33+i)*.17;
        const orbit=.17+.55*Math.sqrt((i+.5)/(pred?8:7));
        const X=sp.X+Math.cos(bearing)*zoneSize*orbit;
        const Z=sp.Z+Math.sin(bearing)*zoneSize*orbit*.56;
        const p=project(X,Z);
        const size=zoneSize*(pred?.23:.18);
        const fade=envelope*(pred?.98:.87)*(1-.56*phase)*rhythm;
        drawRing(g,p,phase,fade,size,seed);
        const foam=clamp(radius*(pred?.23:.14)*(.85+.24*Math.sin(age*6+seed)),4,32);
        g.globalAlpha=fade*(pred?.79:.63);
        g.drawImage(foamTex,p.x-foam,p.y-foam*.39,foam*2,foam*.78);
        if(!pred){
          // Fine bubbles, not large rigid circles.
          const dot=clamp(2.3+p.s*.034,2,5.5);
          g.globalAlpha=fade*.94;
          g.drawImage(dropTex,p.x-dot+Math.sin(age*3.7+i)*dot*.6,p.y-dot*.8,dot*2,dot*2);
        }else{
          // A predator makes an intermittent, directional, two-tone wake.
          const burst=Math.pow(Math.max(0,Math.sin(age*4.8+i*1.7)),3);
          if(burst>.06){
            const sweep=clamp(radius*(.19+.20*burst),8,41);
            const dx=Math.cos(seed+age*.4),dy=Math.sin(seed+age*.4)*.35;
            g.beginPath();
            g.moveTo(p.x-dx*sweep*.55,p.y-dy*sweep*.55);
            g.quadraticCurveTo(p.x+dy*sweep*.35,p.y-dx*sweep*.24,p.x+dx*sweep*.72,p.y+dy*sweep*.72);
            g.lineCap="round";g.lineWidth=2.8;
            g.strokeStyle="rgba(17,44,48,"+(.57*fade*burst)+")";g.stroke();
            g.lineWidth=1.45;g.strokeStyle="rgba(245,250,246,"+(.88*fade*burst)+")";g.stroke();
          }
        }
      }
      // Visible in the gaps between crests, but never a painted bullseye.
      const breathing=.88+.12*Math.sin(age*(pred?6.2:3.5));
      const wide=radius*(pred?.49:.39)*breathing;
      g.globalAlpha=envelope*(pred?.78:.64);
      g.drawImage(foamTex,center.x-wide,center.y-wide*.35,wide*2,wide*.70);
      if(pred){
        // A brief surface break, inside the existing simulated hunting spot.
        const kick=Math.pow(Math.max(0,Math.sin(age*4.8)),5);
        const h=clamp(radius*.26,6,24);
        g.globalAlpha=envelope*kick*.92;
        g.drawImage(dropTex,center.x-h*.45,center.y-h*.65-kick*h*.65,h*.9,h*1.3);
      }
    }
    g.restore();
  }
  function draw(g,v,dt,project){
    dt=clamp(Number(dt)||0,0,.08);
    if(v.ice){rings.length=0;spray.length=0;droplets.length=0;return;}
    ensureTextures();
    const night=FZ.Scene&&FZ.Scene.lastLight?FZ.Scene.lastLight.dark:0;
    const light=.55+(.45*(1-night));
    g.save();
    g.globalCompositeOperation='screen';
    for(let i=rings.length-1;i>=0;i--){
      const a=rings[i];a.age+=dt;
      const k=a.age/a.life;if(k>=1){rings.splice(i,1);continue;}
      drawRing(g,project(a.X,a.Z),k,(1-k)*.62*light,a.size,a.seed);
    }
    for(let i=droplets.length-1;i>=0;i--){
      const d=droplets[i];d.age+=dt;if(d.age>d.life){droplets.splice(i,1);continue;}
      if(d.age<0)continue;
      const p=project(d.X,d.Z),k=d.age/d.life;
      const rad=clamp(p.s*.055,1,5);
      g.globalAlpha=(1-k)*.55*light;
      g.drawImage(dropTex,p.x-rad,p.y-rad*1.1,rad*2,rad*2.2);
    }
    for(let i=spray.length-1;i>=0;i--){
      const s=spray[i];s.age+=dt;
      if(s.age>=s.life){spray.splice(i,1);continue;}
      s.dx+=s.vx*dt;s.dy+=s.vy*dt;s.vy+=s.gravity*dt;
      const p=project(s.X,s.Z),floor=p.y+2;
      if(p.y+s.dy>floor){spray.splice(i,1);continue;}
      const scale=clamp(p.s/28,.35,1.35),r=s.scale*scale;
      g.globalAlpha=Math.pow(1-s.age/s.life,1.5)*.78*light;
      g.drawImage(dropTex,p.x+s.dx-r*1.6,p.y+s.dy-r*1.6,r*3.2,r*3.2);
    }
    g.restore();
  }
  function clear(){rings.length=0;spray.length=0;droplets.length=0;}
  FZ.WaterFX={ring,splash,bubbles,activity,draw,clear,stats:()=>({rings:rings.length,spray:spray.length,droplets:droplets.length})};
})(window.FZ);

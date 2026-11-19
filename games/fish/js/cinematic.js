/* Full landscape rendering over the original 1.0.10 camera and interaction model. */
(function(FZ){
 'use strict';
 const Sc=FZ.Scene,U=FZ.U,A=FZ.Assets;
 const oldRender=Sc.render;let cache=null,cacheKey='',ctx=null,water=null;
 // Open-water polygons in percent of the original photographs.
 const waterBounds={
  akhtuba:[[13,41],[100,40],[100,100],[52,100],[29,84],[18,70]],
  amur:[[14,42],[100,41],[100,100],[65,100],[41,83],[23,74]],
  baikal:[[0,34],[100,34],[100,77],[80,86],[46,79],[20,76],[0,70]],
  barents:[[0,35],[100,35],[100,76],[64,77],[32,73],[0,64]],
  blacksea:[[22,40],[100,38],[100,100],[55,100],[44,85],[30,70],[29,58]],
  don:[[11,37],[100,36],[100,91],[74,96],[48,87],[26,76],[14,62]],
  kamchatka:[[21,32],[100,32],[100,86],[66,85],[36,73],[24,64],[8,52]],
  katun:[[19,42],[100,40],[100,91],[63,97],[47,88],[26,77],[22,63]],
  kola:[[16,43],[100,42],[100,89],[67,93],[38,81],[23,72],[15,60]],
  ladoga:[[13,33],[100,34],[100,93],[70,85],[54,77],[25,68],[16,56]],
  mountainlake:[[7,36],[100,34],[100,82],[65,87],[28,83],[14,71]],
  northstream:[[25,38],[93,40],[100,90],[91,100],[59,100],[45,92],[25,72],[17,55]],
  oka:[[11,37],[100,44],[100,96],[67,92],[49,84],[27,72],[16,61]],
  onega:[[20,42],[100,45],[100,95],[74,100],[51,92],[30,84],[19,72]],
  platnik:[[14,42],[100,41],[100,73],[88,85],[58,87],[34,81],[23,71]],
  polar:[[0,34],[100,34],[100,88],[64,89],[27,79],[0,69]],
  pond:[[13,43],[100,42],[100,83],[88,83],[60,91],[34,84],[25,69],[14,61]],
  seliger:[[13,42],[94,41],[86,65],[81,79],[57,87],[32,83],[18,68]],
  taiga:[[19,46],[87,43],[100,56],[100,83],[84,88],[55,89],[34,82],[22,68]],
  volga:[[14,37],[100,36],[100,94],[61,92],[33,83],[19,71]]
 };
 function waterShape(loc,image,W,H) {
  const scale=Math.max(W/image.width,H/image.height);
  const width=image.width*scale,height=image.height*scale;
  const points=waterBounds[loc].map(([x,y])=>[(W-width)/2+x*width/100,(H-height)/2+y*height/100]);
  const path=new Path2D();
  points.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));
  path.closePath();
  function contains(x,y) {
   let inside=false;
   for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
   }
   return inside;
  }
  return {path,contains};
 }
 function surfaceLight(v,W,H,D) {
  const warm=v.period==='dawn'||v.period==='dusk';
  const count=D<=1.25?24:39,t=v.t;
  const wind=U.clamp(v.wx.wind/12,0,1);
  const rain=v.wx.sky==='rain'||v.wx.sky==='storm';
  const current=v.loc.current;
  const reflection=W*(v.period==='dusk'?0.61:0.38);
  ctx.save();ctx.clip(water.path);
  ctx.lineCap='round';
  for(let i=0;i<count;i++){
   const q=(i+.5)/count;
   const y=H*(.35+q*.65);
   const x=((i*137.5+t*(3+13*wind+current*6))%(W+68))-34;
   const glint=Math.max(0,1-Math.abs(x-reflection)/(W*(.17+q*.25)));
   const pulse=Math.max(0,Math.sin(t*(1.1+wind*.9)+i*2.4));
   const length=(2+q*(8+wind*11))*(.45+(i%7)*.15);
   ctx.globalAlpha=(.026+q*.045+pulse*.05) * (warm?1+glint*.85:rain?.7:1);
   ctx.strokeStyle=warm&&glint>.32?'#ffe6ae':'#d2edf0';
   ctx.lineWidth=.65+q*.7;
   ctx.beginPath();
   ctx.moveTo(x-length,y);ctx.quadraticCurveTo(x,y-1,x+length,y+.6);ctx.stroke();
  }
  ctx.restore();
 }
 function urlFor(loc,season){if(loc==='pond'&&season==='winter')return A.url('winter/ice');return A.url((season==='winter'&&!FZ.LOC[loc].openWinter?'bg/'+loc+'_winter':'base/'+loc))}
 function imageFor(v){if(v.loc.id==='pond'&&v.ice)return A.get('winter/ice');return A.get((v.ice?'bg/'+v.loc.id+'_winter':'base/'+v.loc.id))}
 function cover(g,im,w,h){const s=Math.max(w/im.width,h/im.height);g.drawImage(im,(w-im.width*s)/2,(h-im.height*s)/2,im.width*s,im.height*s)}
 function clearDetail(surface, image, W, H, D, season) {
  const g=surface.getContext('2d',{willReadFrequently:true});
  g.scale(D,D);
  g.imageSmoothingQuality='high';
  if(season==='autumn')g.filter='sepia(.13) saturate(.93)';
  else if(season==='spring')g.filter='saturate(1.02) brightness(1.035)';
  cover(g,image,W,H);
  g.setTransform(1,0,0,1,0,0);
  const w=surface.width,h=surface.height;
  const frame=g.getImageData(0,0,w,h), pixels=frame.data, source=new Uint8ClampedArray(pixels);
  const line=w*4;
  for(let y=1;y<h-1;y++){
   for(let x=4,i=y*line+x;x<line-4;x+=4,i+=4){
    for(let c=i;c<i+3;c++) {
     const average=(source[c-4]+source[c+4]+source[c-line]+source[c+line])*0.25;
     const detail=source[c]-average;
     if(Math.abs(detail)>2)pixels[c]=source[c]+0.32*detail;
    }
   }
  }
  g.putImageData(frame,0,0);
 }

 function weatherLight(v, L, size) {
  const W=size.W,H=size.H,y=size.shoreY;
  const palette={cloudy:[132,159,160,0.13],overcast:[120,144,151,0.24],rain:[87,120,137,0.29],storm:[58,79,103,0.42],snow:[167,191,198,0.25]};
  const air=palette[v.wx.sky];
  if(air){
   const fog=ctx.createLinearGradient(0,0,0,H*.82);
   fog.addColorStop(0,`rgba(${air.slice(0,3).join(',')},${air[3]*0.68})`);
   fog.addColorStop(U.clamp(y/H,.05,.75),`rgba(${air.slice(0,3).join(',')},${air[3]})`);
   fog.addColorStop(1,`rgba(${air.slice(0,3).join(',')},0)`);
   ctx.fillStyle=fog;ctx.fillRect(0,0,W,H*.82);
  }
  if(L.dark>.01){ctx.fillStyle='rgba(7,16,42,'+(L.dark*.59)+')';ctx.fillRect(0,0,W,H)}
 }

 function sites(){
  const G=FZ.Game,m=G.maxCast(),sea=G.sess().loc.openWinter;
  return [{n:sea?'Прибрежные камни':'Кромка травы',Z:Math.max(4.7,m*.52),side:-.73},{n:'Бровка',Z:Math.max(5.5,m*.72),side:.72},{n:'Глубина',Z:Math.max(6,m*.94),side:-.06}].map(s=>({...s,X:Sc.maxLat(s.Z)*s.side}));
 }
 Sc.render=function(v,dt){
  const legacy=v.loc.style==='coast'?{...v,loc:{...v.loc,style:'lake'}}:v;
  if(A.style==='art')return oldRender(legacy,dt);
  const im=imageFor(v);if(!im)return oldRender(legacy,dt);
  const cv=document.getElementById('cv'),size=Sc.size(),W=size.W,H=size.H,D=cv.width/W;
  if(!ctx)ctx=cv.getContext('2d');Sc.setFar(v.loc.zfar);
  const L=Sc.light(v.hour,v.season);Sc.lastLight=L;Sc._sx=0;Sc._sy=0;
  ctx.setTransform(D,0,0,D,0,0);ctx.save();
  if(v.ice&&v.loc.id==='pond'){cover(ctx,im,W,H)}else if(v.ice){
   const cutoff=im.height*.66,s=Math.max(W/im.width,size.shoreY/cutoff);
   ctx.drawImage(im,(W-im.width*s)/2,size.shoreY-cutoff*s,im.width*s,im.height*s);
   const ice=A.get('winter/ice');
   if(ice){ctx.drawImage(ice,0,ice.height*.42,ice.width,ice.height*.58,0,size.shoreY-6,W,H-size.shoreY+6)}
   else {const fill=ctx.createLinearGradient(0,size.shoreY,0,H);fill.addColorStop(0,'#b7ccda');fill.addColorStop(1,'#7698b2');ctx.fillStyle=fill;ctx.fillRect(0,size.shoreY,W,H-size.shoreY)}
  }else{
   const key=v.loc.id+'|'+v.season+'|'+W+'|'+H+'|'+D;
   if(key!==cacheKey){
    cache=document.createElement('canvas');
    cache.width=cv.width;cache.height=cv.height;
    clearDetail(cache,im,W,H,D,v.season);
    water=waterShape(v.loc.id,im,W,H);
    cacheKey=key;
   }
   ctx.drawImage(cache,0,0,W,H);
   surfaceLight(v,W,H,D);
  }
  weatherLight(v,L,size);
  if(v.period==='dawn'||v.period==='dusk'){const glow=ctx.createLinearGradient(0,0,0,H);glow.addColorStop(0,'rgba(241,191,119,.09)');glow.addColorStop(.6,'rgba(241,191,119,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H)}
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(3,16,22,.28)');shade.addColorStop(.3,'rgba(0,0,0,0)');shade.addColorStop(.82,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(3,19,25,.25)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  Sc.drawBirds(L,dt,v.t);
  const surface=v.ice?null:water;
  ctx.save();
  if(surface)ctx.clip(surface.path);
  Sc.drawWorldFx(v,L,dt);
  ctx.restore();
  const rig=FZ.Game.rig();
  if(!v.ice&&rig.state==='idle')for(const site of sites()){
   const p=Sc.proj(site.X,site.Z),k=(v.t*.23+site.side+3)%1;
   if(surface&&!surface.contains(p.x,p.y))continue;
   ctx.save();ctx.strokeStyle='rgba(237,239,209,'+(.32*(1-k))+')';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,15+k*19,5+k*4,0,0,Math.PI*2);ctx.stroke();ctx.font='500 10px Rubik,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(7,29,32,.85)';ctx.strokeText(site.n,p.x,p.y-15);ctx.fillStyle='#e8ead4';ctx.fillText(site.n,p.x,p.y-15);ctx.restore();
  }
  Sc.drawTackle(v,L,v.t);
  // Follow the actual fish velocity; the text tells the player to steer opposite.
  const fish=rig.fish;
  if(!v.ice&&rig.state==='fight'&&fish&&(fish.warning||fish.phase==='run'&&fish.runSpeed)){
   const p=Sc.proj(fish.X,fish.Z),x=U.clamp(p.x,24,W-24),y=U.clamp(p.y-28,H*.40,H*.68);
   ctx.save();ctx.fillStyle='rgba(12,43,48,.82)';ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=fish.against?'#a8e3b8':'#f7d38c';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((fish.warning ? fish.runDirection : fish.runSpeed)>0?'→':'←',x,y);ctx.restore();
  }
  Sc.drawWeather(v,L,v.t,dt,v.wx,surface&&surface.contains);Sc.drawScreenFx(dt);
  ctx.restore();ctx.setTransform(1,0,0,1,0,0);
 };
 Sc.drawAim=function(v,a){
  if(!ctx)return;const p=Sc.proj(a.X,a.Z),s=Sc.size(),D=document.getElementById('cv').width/s.W;
  ctx.save();ctx.setTransform(D,0,0,D,0,0);ctx.strokeStyle='#f7d38c';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.ellipse(p.x,p.y,17,5,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-25,p.y);ctx.lineTo(p.x-10,p.y);ctx.moveTo(p.x+10,p.y);ctx.lineTo(p.x+25,p.y);ctx.stroke();
  ctx.fillStyle='#15353b';ctx.fillRect(p.x-42,p.y+12,84,21);ctx.font='500 10px Rubik,sans-serif';ctx.textAlign='center';ctx.fillStyle='#f7d38c';ctx.fillText(Math.round(a.Z)+' м · '+FZ.Game.depthAt(a.X,a.Z).toFixed(1)+' м',p.x,p.y+26);ctx.restore();
 };
 FZ.Cinematic={urlFor,sites,waterShape};
})(window.FZ);

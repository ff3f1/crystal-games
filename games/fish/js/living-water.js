/* Living Water: persistent feeding territories tied to actual catch probabilities.
 * The water isn't a decoration: shoals drift, feed, retreat and can be read.
 * Deterministic clock and seed; no DOM, network, extra save fields or frame RNG. */
(function (FZ) {
  "use strict";
  const L = {};
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const smooth = v => { v=clamp(v,0,1); return v*v*(3-2*v); };
  const TAU=Math.PI*2;
  const PLACES=[
    {id:"reeds",n:"У камышей",side:-.72,range:.30,kind:"peace",depth:"mid",hint:"Под берегом шевелится мелочь"},
    {id:"lilies",n:"У прибрежной травы",side:.68,range:.26,kind:"peace",depth:"top",hint:"Под травой кормится рыба"},
    {id:"break",n:"На бровке",side:-.24,range:.70,kind:"peace",depth:"bottom",hint:"Со дна поднимаются мелкие пузыри"},
    {id:"hunt",n:"На свале",side:.34,range:.62,kind:"pred",depth:"mid",hint:"Хищник гоняет малька"},
    {id:"channel",n:"У струи",side:-.55,range:.53,kind:"pred",depth:"top",hint:"Короткие всплески у струи"},
    {id:"shallows",n:"На мелководье",side:.14,range:.20,kind:"peace",depth:"top",hint:"Малёк собирается у поверхности"}
  ];
  function hash(s) { let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0; }
  function generator(seed) {let x=seed||1;return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
  L.create=function(loc,season,library,maxCast,maxLat,dayKey) {
    const seed=hash(loc.id+"/"+season+"/"+(dayKey||"default"));
    const rnd=generator(seed), far=Math.max(14,Math.min(loc.zfar-8,maxCast||45));
    const groups=[];
    for(const place of PLACES) {
      // Feeding signs are composed only of species living in this water.
      const selected={}, choices=Object.keys(loc.fish||{}).map(id=>({id,s:library[id],n:loc.fish[id]}))
        .filter(p=>p.s&&p.n>0&&p.s.kind===place.kind&&p.s.depth);
      let total=0;
      for(const fish of choices) {
        const depth=fish.s.depth[place.depth]||0;
        const weight=fish.n*Math.max(0,depth);
        if(weight<=0)continue;
        selected[fish.id]=weight;total+=weight;
      }
      if(total<=0)continue;
      for(const id of Object.keys(selected))selected[id]/=total;
      const Z=7+(far-7)*place.range;
      const X=place.side*maxLat(Z);
      groups.push({id:place.id,name:place.n,hint:place.hint,kind:place.kind,
        fish:selected,centerX:X,centerZ:Z,X,Z,radius:place.id==="break"?6.1:5.1,
        phase:rnd()*TAU+groups.length*.72,pace:.013+rnd()*.012,
        dx:.55+rnd()*.65,dz:.75+rnd()*.9,pressure:0,intensity:0,
        source:choices.sort((a,b)=>(selected[b.id]||0)-(selected[a.id]||0))[0]?.id||null});
    }
    return {groups,time:0,seed,casts:0,reads:0};
  };
  L.update=function(world,sess,dt) {
    if(!world)return;
    world.time+=dt;
    for(const g of world.groups){
      const t=world.time;
      g.pressure=Math.max(0,g.pressure-dt);
      // No screen-space teleporting: the actual feeding position moves slowly.
      g.X=g.centerX+Math.sin(t*g.pace+g.phase)*g.dx;
      g.Z=g.centerZ+Math.cos(t*g.pace*.73+g.phase)*g.dz;
      const cycle=Math.sin(t*(g.kind==="pred"?.068:.046)+g.phase);
      const feeding=.14+.86*smooth((cycle+.38)/1.24);
      const source=sess&&sess.loc&&FZ.SP?FZ.SP[g.source]:null;
      const timeFactor=source&&source.time?clamp((source.time[sess.period]||0)/1.1,.15,1.15):1;
      const seasonal=source&&source.season?clamp((source.season[sess.season]||0)/1.05,.18,1.12):1;
      const weather=sess&&sess.wx?clamp(sess.wx[g.kind]||1,.4,1.25):1;
      const scared=g.pressure>0?0.12:1;
      g.intensity=clamp(feeding*timeFactor*seasonal*weather*scared,0,1);
    }
  };
  L.spots=function(world) {
    if(!world)return[];
    // Existing WaterFX renders these exact zones in Canvas and WebGL.
    const age=world.time%110;
    return world.groups.filter(g=>g.intensity>.22).map(g=>({
      X:g.X,Z:g.Z,type:g.kind==="pred"?"boil":"bubbles",
      radius:g.radius,fish:g.fish,peak:1,intensity:g.intensity,
      born:world.time-age,duration:110,life:110-age
    }));
  };
  L.bonus=function(world,species,X,Z) {
    if(!world||!species)return 1;
    let best=0;
    for(const g of world.groups){
      const affinity=g.fish[species.id]||0;
      if(!affinity||g.pressure>0)continue;
      const d=Math.hypot(X-g.X,Z-g.Z);
      if(d>=g.radius*1.5)continue;
      const near=smooth(1-d/(g.radius*1.5));
      const attraction=(.75+.25*clamp(affinity*3,0,1))*g.intensity*near;
      best=Math.max(best,attraction);
    }
    return .86+2.45*best;
  };
  L.read=function(world,X,Z) {
    if(!world||!world.groups.length)return {level:0,text:"Смотрите на воду — рыба выдаёт себя рябью"};
    let nearest=null,score=0;
    for(const g of world.groups){
      if(g.intensity<.27||g.pressure>0)continue;
      const distance=Math.hypot(X-g.X,Z-g.Z);
      const near=smooth(1-distance/(g.radius*2));
      const value=near*g.intensity;
      if(value>score){score=value;nearest=g;}
    }
    if(nearest&&score>.30)return{level:2,zone:nearest.id,text:nearest.name+": "+nearest.hint.toLowerCase()};
    const active=world.groups.filter(g=>g.intensity>.40&&g.pressure<=0).sort((a,b)=>b.intensity-a.intensity);
    if(active.length) {
      const g=active[0];
      return {level:1,zone:g.id,text:g.kind==="pred"?
        "Присмотритесь: "+g.name.toLowerCase()+" охотится хищник":
        "Присмотритесь: "+g.name.toLowerCase()+" есть кормовая рябь"};
    }
    return {level:0,text:"Вода затихла. Рыба может выйти на кормёжку позже"};
  };
  L.onCatch=function(world,species,X,Z) {
    if(!world)return null;
    let found=null,min=Infinity;
    for(const g of world.groups){
      if(!(g.fish[species.id]>0))continue;
      const d=Math.hypot(X-g.X,Z-g.Z);
      if(d<g.radius*1.3&&d<min){found=g;min=d;}
    }
    if(found){
      // Repeat casting a depleted shoal is not the optimal strategy.
      found.pressure=18+Math.round(found.intensity*12);
      world.reads++;
      return {name:found.name,rest:Math.round(found.pressure)};
    }
    return null;
  };
  L.onCast=function(world,X,Z) {
    if(!world)return {level:0,text:""};
    world.casts++;
    return L.read(world,X,Z);
  };
  FZ.LivingWater=L;
})(window.FZ);

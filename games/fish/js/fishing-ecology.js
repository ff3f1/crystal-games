/* Fishing Ecology — habitat, compatible presentations, observable feeding spots,
 * and species-specific fighting temperament. No invented species or catch guarantees.
 * This module intentionally reads the existing 62-species data tables.
 */
(function(FZ){
  "use strict";
  const U=FZ.U;
  const E={};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const EDGE=new Set(["crucian","gcrucian","tench","rudd","pike","amurpike","rotan","perch","grasscarp","minnow","gudgeon","brooktrout"]);
  const DEEP=new Set(["bream","sbream","zander","catfish","burbot","sturgeon","sterlet","wildcarp","carp","halibut","cod","flounder","navaga","whitefish","chir","muksun"]);
  const CURRENT=new Set(["asp","chub","dace","ide","grayling","lenok","taimen","rybets","nase","chekhon","nelma","brooktrout","marinka","osman"]);
  const FEEDING_PRED=new Set(["pike","amurpike","perch","zander","asp","chub","lenok","taimen","nelma","grayling","brooktrout","trout","coho","chinook","pinksalmon","chumsalmon","terpug"]);
  const FIGHTS={
    pike:{run:1.16,shake:1.4,speed:1.1,duration:.9,cover:1.3},
    amurpike:{run:1.16,shake:1.4,speed:1.1,duration:.9,cover:1.3},
    zander:{run:.92,shake:1.6,speed:.94,duration:.95,dive:.9},
    perch:{run:.85,shake:1.3,speed:1,duration:.85},
    catfish:{run:1.30,shake:.65,speed:.72,duration:1.45,dive:1.7},
    burbot:{run:.75,shake:.7,speed:.75,duration:1.15,dive:1.3},
    carp:{run:1.38,shake:.72,speed:1.17,duration:1.30,dive:.25},
    wildcarp:{run:1.47,shake:.72,speed:1.24,duration:1.34,dive:.3},
    grasscarp:{run:1.32,shake:.7,speed:1.14,duration:1.23},
    crucian:{run:.65,shake:.6,speed:.82,duration:.84},
    gcrucian:{run:.68,shake:.6,speed:.84,duration:.85},
    bream:{run:.7,shake:.65,speed:.7,duration:1.05,dive:.25},
    tench:{run:1.23,shake:.9,speed:.85,duration:1.23,cover:1.15},
    taimen:{run:1.38,shake:1.32,speed:1.26,duration:1.23},
    trout:{run:1.14,shake:1.2,speed:1.2,duration:.92},
    brooktrout:{run:1.14,shake:1.2,speed:1.2,duration:.92},
    grayling:{run:1.18,shake:1.15,speed:1.18,duration:.93},
    asp:{run:1.3,shake:.92,speed:1.32,duration:1.07},
    sturgeon:{run:.9,shake:.5,speed:.64,duration:1.48,dive:1.5},
    sterlet:{run:.84,shake:.6,speed:.72,duration:1.24,dive:1.1},
    halibut:{run:.78,shake:.56,speed:.67,duration:1.35,dive:1.45},
    cod:{run:.91,shake:.8,speed:.83,duration:1.11,dive:1.06},
    rudd:{run:.72,shake:.86,speed:.89,duration:.88,cover:.8},
    chub:{run:1.12,shake:1.02,speed:1.14,duration:.95,cover:.7},
  };
  E.profile=function(s,w){
    const p=FIGHTS[s.id]||{};
    const trophy=clamp(w/Math.max(.01,s.trophy),0,2);
    // Trophy fish retain their original strength but have longer, more distinct runs.
    return {run:p.run||1,shake:p.shake||1,speed:(p.speed||1)*(1+.08*clamp(trophy-.45,0,1)),
      duration:(p.duration||1)*(1+.12*clamp(trophy-.5,0,1)),
      dive:p.dive||0,cover:p.cover||(EDGE.has(s.id)?1:0),trophy};
  };
  E.habitat=function(s,loc,X,Z,maxCast,maxLat){
    if(!s)return 1;
    const edge=clamp(Math.abs(X)/Math.max(1,maxLat),0,1);
    const far=clamp(Z/Math.max(6,maxCast),0,1);
    let value=1;
    if(EDGE.has(s.id)){
      value*=1+.42*clamp((edge-.28)/.65,0,1);
      if(far>.84)value*=.93;
    }
    if(DEEP.has(s.id)){
      value*=1+.32*clamp((far-.52)/.42,0,1);
      if(far<.34)value*=.91;
    }
    if(CURRENT.has(s.id)&&loc&&loc.current>.2){
      // Current seams: not the very centre, not the extreme bank.
      const seam=1-clamp(Math.abs(edge-.53)/.6,0,1);
      value*=1+(Math.min(1,loc.current)/.9)*.20*seam;
    }
    if(s.id==="pike"||s.id==="amurpike"){
      // Ambush fish seek cover rather than featureless, open water.
      value*=1+.12*clamp((edge-.32)/.5,0,1);
    }
    return clamp(value,.55,1.85);
  };
  E.presentation=function(s,bait,mode,period,rig){
    if(!s||!bait||!(s.baits[bait.id]>0)||!(s.methods[mode]>0)||!bait.m.includes(mode))return 0;
    if(mode!=="spin")return 1;
    const paused=Math.max(0,rig&&rig.spinPause||0);
    const moving=!!(rig&&rig.reeling),twitch=clamp(rig&&rig.spinPulse||0,0,1);
    // Food, habitat, depth and season still gate eligibility. The player can
    // only improve presentation for an already compatible species.
    if(bait.id==="jig"||bait.id==="deep_jig"){
      const fall=paused>.25&&paused<1.8?1.22:paused>3.4?.46:moving?1.05:.82;
      return fall*(1+.22*twitch);
    }
    if(bait.id==="mouse"){
      const light=period==="dusk"||period==="night"?1.26:period==="day"?.55:.95;
      return light*(moving?1.08:twitch>.1?.9:paused>3?.30:.72);
    }
    if(bait.id==="spinner"||bait.id==="salmon_spinner")
      return moving?1.12:paused>.9?.25:paused>.28?.55:.92;
    if(bait.id==="wobbler"||bait.id==="sea_wobbler")
      return moving?1.08:paused>2.3?.30:(.73+.53*twitch);
    if(bait.id==="spoon"||bait.id==="icespoon")
      return moving?1.12:paused>2.5?.56:paused>.25&&paused<1.3?1.18:.90;
    return paused>2.5?.62:1;
  };
  E.spotBonus=function(s,spots,X,Z){
    let b=1;
    if(!s||!spots)return b;
    for(const sp of spots){
      if(!sp||!Number.isFinite(sp.X)||!Number.isFinite(sp.Z))continue;
      if(sp.type==="boil"&&!FEEDING_PRED.has(s.id))continue;
      if(sp.type==="bubbles"&&s.kind!=="peace")continue;
      const d=Math.hypot(sp.X-X,sp.Z-Z);
      if(d>8)continue;
      const match=sp.speciesId===s.id;
      const factor=match?2.5:sp.speciesId?1.22:1.35;
      // Observed feeding activity decays smoothly with distance. Never guarantees a fish.
      b*=1+(factor-1)*Math.exp(-d*d/(2*2.8*2.8));
    }
    return clamp(b,1,3.5);
  };
  E.patience=function(total,idleSeconds){
    if(!(total>0))return 0;
    const build=clamp((idleSeconds-9)/20,0,1);
    const quality=clamp(total/.075,0,1);
    return 1+build*(.35+1.9*quality);
  };
  E.trophyQuality=function(s,bait,loc,position,maxCast,maxLat,season,period,spots){
    const active=clamp((s.season[season]||0)*(s.time[period]||0),0,2);
    const habitat=E.habitat(s,loc,position.X,position.Z,maxCast,maxLat);
    const spot=E.spotBonus(s,spots,position.X,position.Z);
    const baitFit=clamp((s.baits[bait]||0)/1.2,0,1.4);
    return clamp(.58+active*.12+habitat*.14+(spot-1)*.11+baitFit*.15,.6,1.45);
  };
  E.spawnSpot=function(loc,season,period,wx,maxCast,maxLat,rand){
    if(!loc||!loc.fish||!(maxCast>7))return null;
    const available=[];
    for(const id of Object.keys(loc.fish)){
      const s=FZ.SP[id];if(!s)continue;
      const active=(s.season[season]||0)*(s.time[period]||0);
      if(active<.22)continue;
      const pred=FEEDING_PRED.has(id)&&(s.depth.top>.19||s.depth.mid>.34);
      const peace=s.kind==="peace";
      if(!pred&&!peace)continue;
      const w=loc.fish[id]*active*(s.kind==="pred"?wx.pred:wx.peace)*(pred?.8:1);
      if(w>0)available.push({s,w,type:pred?"boil":"bubbles"});
    }
    if(!available.length)return null;
    const total=available.reduce((a,b)=>a+b.w,0),roll=rand()*total;
    let seen=0,chosen=available[available.length-1];
    for(const v of available){seen+=v.w;if(roll<=seen){chosen=v;break}}
    let best=null,bestScore=-Infinity;
    for(let k=0;k<4;k++){
      const z=6+rand()*Math.max(0,maxCast-11);
      const x=(rand()*1.6-.8)*maxLat(z);
      const score=E.habitat(chosen.s,loc,x,z,maxCast,maxLat(z))+.05*rand();
      if(score>bestScore){bestScore=score;best={X:x,Z:z}}
    }
    return {type:chosen.type,speciesId:chosen.s.id,X:best.X,Z:best.Z,life:17+rand()*10};
  };
  E.nextPhase=function(f,reeling,rand){
    if(f.S<.16)return "tired";
    const p=E.profile(f.s,f.w);
    // Deep-water fish must recover after a dive rather than chaining them.
    if(f.phase==="dive")return "rest";
    if(f.phase==="run")return rand()<.16*p.shake?"shake":"rest";
    const active=.3+.7*f.S;
    const run=clamp(f.s.fight.runs*active*p.run*(reeling?1.17:1),0,.74);
    const toward=clamp(.1+(f.s.id==="crucian"||f.s.id==="bream"?.07:0),.08,.18);
    const shake=clamp(f.s.fight.shake*(.25+.09*f.S)*p.shake,0,.27);
    const dive=clamp(p.dive*(.085+.07*f.S),0,.23);
    const roll=rand();
    return roll<run?"run":roll<run+toward?"toward":roll<run+toward+shake?"shake":
      roll<run+toward+shake+dive?"dive":"rest";
  };
  E.chooseRunDirection=function(s,X,bank,rand){
    if(!(bank>0)||!Number.isFinite(X))return rand()<.5?-1:1;
    const edge=Math.abs(X)/bank,side=Math.sign(X)||1;
    if(edge>.93)return -side; // physical limit: cannot swim through land
    // Physical bank limit beats the fish's preference for cover.
    if(edge>.75)return -side;
    if(edge>.52&&EDGE.has(s.id)&&rand()<.56)return side; // cover-seeking fish
    return rand()<.5?-1:1;
  };
  E.isEdgeFish=s=>!!s&&EDGE.has(s.id);
  E.isPredatorSpot=s=>!!s&&FEEDING_PRED.has(s.id);
  FZ.Ecology=E;
})(window.FZ);

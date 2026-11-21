/* Regression of casting direction, real power, skills and old saves. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../games/fish");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const backing={};
const localStorage={getItem:k=>backing[k]||null,setItem:(k,v)=>{backing[k]=v}};
const context={window:{},document:{getElementById:()=>null},localStorage,
 console,setTimeout:()=>0,clearTimeout:()=>{}};
for(const p of ["util","data","content","world","fishing-ecology","game","cozy-motion"])
 vm.runInNewContext(read("js/"+p+".js"),context,{filename:p+".js"});
const F=context.window.FZ,G=F.Game,M=F.CozyMotion;
F.Scene={period:h=>h<6?"night":h<9?"dawn":h<18?"day":h<21?"dusk":"night",
 maxLat:z=>10+z*.22,sunTimes:()=>[6,20],
 ring(){},splash(){},shake(){},distantJump(){},chips(){},holeGeom(){return{x:100,y:100}}};
F.Sound=new Proxy({},{get:()=>()=>{}});
F.Platform={vibrate(){}};
G.load();
const old=JSON.parse(JSON.stringify(G.state()));
old.lvl=7;delete old.skills;backing.fz_save=JSON.stringify(old);
G.load();
const st=G.state();
assert.deepEqual(JSON.parse(JSON.stringify(st.skills)),{accuracy:0,casting:0,control:0},
 "old saves gain default skill ranks without losing progress");
assert.equal(st.lvl,7);
assert.equal(G.skillPoints(),6,"all prior level-up points are available to an existing player");
const before=G.skillBonuses();
assert(G.trainSkill("accuracy"));assert(G.trainSkill("casting"));assert(G.trainSkill("control"));
assert(!G.trainSkill("not-a-skill"),"arbitrary keys cannot be purchased");
assert.equal(G.skillPoints(),3);
assert(G.skillBonuses().accuracy<before.accuracy,"accuracy reduces actual placement scatter");
assert(G.skillBonuses().range>before.range,"casting technique increases real range");
assert(G.skillBonuses().steering>0,"fight control rewards correctly aimed rod");
assert.equal(JSON.parse(backing.fz_save).skills.casting,1,"skill investments are saved");
assert.equal(G.castPower(-20),.18);assert.equal(G.castPower(1350),1);
assert.equal(G.castPower(9999),1,"power bar has a hard cap");
st.active="float";G.startSession("pond","summer");
const original=G.maxCast();
const chosen=G.aimClamp(0,Math.min(14,original));
const float=G.castPreview(chosen.X,chosen.Z,.20);
assert.equal(float.Z,chosen.Z,"float cast ignores power, uses precise free aim");
const rod=G.rig();
assert(G.cast(chosen.X,chosen.Z),"float cast succeeds with a real equipped rod");
assert(rod.state==="fly");
assert(Math.abs(rod.Z-chosen.Z)<=chosen.Z*G.skillBonuses().accuracy+.001,
 "float misses only within the level-and-skill controlled error ellipse");
st.active="spin";st.load.spin.rod="s1";st.rods.push("s1");
st.lures.wobbler=1;st.load.spin.bait="wobbler";
G.startSession("pond","summer");
const spinMax=G.maxCast();
const short=G.castPreview(4,spinMax,.20),long=G.castPreview(4,spinMax,.95);
assert(short.Z<long.Z&&long.Z<spinMax,"holding power controls real spin casting distance");
assert(Math.abs(short.X/short.Z-long.X/long.Z)<1e-6,
 "power changes reach without changing chosen direction");
assert(G.cast(4,spinMax,{power:.20}),"spin accepts charged cast");
assert(G.rig().Z<=short.Z+short.Z*G.skillBonuses().accuracy+.001,
 "short charge never becomes a maximum-distance cast");
assert(G.rig().castTarget.power===.20,"charge power is retained for visual feedback");
st.active="feeder";st.load.feeder.rod="d1";st.rods.push("d1");
st.load.feeder.bait="worm";G.startSession("pond","summer");
assert(G.gear("feeder").rod,"feeder test has a valid rod");
assert(G.cast(0,G.maxCast(),{power:.38}),"feeder uses the same real power meter");
const testFloat=M.floatLine({x:302,y:343},{x:219,y:412},844,4);
assert(testFloat.contact.y>Math.max(343,412)+35,
 "float line visibly descends to near-side water before travelling to the float");
assert(testFloat.opacity>.35&&testFloat.opacity<.6, "a float's surface line stays faint on water");
assert(Number.isFinite(testFloat.water1.x)&&Number.isFinite(testFloat.water2.y),
 "one continuous surface Bezier connects the rod tip to the actual float");
assert(read("js/scene.js").includes("ctx.bezierCurveTo(q.air.x") &&
 !read("js/scene.js").includes("ctx.quadraticCurveTo(q.air.x"),
 "float line must have one continuous curved strand, without a V-shaped kink");
assert(read("js/main.js").includes("G.castPower(performance.now()-began)"),
 "action button release uses actual hold duration");
assert(read("js/main.js").includes("if(mode===\"float\")"),
 "float aiming remains independent of the spin power meter");
console.log("PASS old saves, level-up skills, float slack, free aiming, charged spin/feeder casts");

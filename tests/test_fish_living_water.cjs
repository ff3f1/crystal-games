/* Ecosystem contract tests for the real Living Water model. */
"use strict";
const assert=require("node:assert/strict");
global.window={FZ:{}};
require("../games/fish/js/living-water.js");
const L=window.FZ.LivingWater;
const spec={
 roach:{id:"roach",kind:"peace",depth:{top:.6,mid:1,bottom:.4},time:{day:1},season:{summer:1}},
 perch:{id:"perch",kind:"pred",depth:{top:.5,mid:1,bottom:.3},time:{day:1},season:{summer:1}},
 carp:{id:"carp",kind:"peace",depth:{top:.1,mid:.4,bottom:1},time:{day:1},season:{summer:1}}
};
window.FZ.SP=spec;
const loc={id:"pond",zfar:100,fish:{roach:20,perch:10,carp:5}};
const a=L.create(loc,"summer",spec,38,z=>z*.32,"2026-11-21");
const b=L.create(loc,"summer",spec,38,z=>z*.32,"2026-11-21");
assert.deepEqual(a,b,"the same water/day should start with the same fish territories");
const sess={period:"day",season:"summer",wx:{peace:1,pred:1},loc};
for(let i=0;i<900;i++)L.update(a,sess,1/60);
assert(a.groups.length>=4,"pond has multiple different places to read");
assert(a.groups.some(g=>g.kind==="peace")&&a.groups.some(g=>g.kind==="pred"),"real peace and predator territories");
for(const g of a.groups){
 assert(Number.isFinite(g.X)&&Number.isFinite(g.Z)&&g.intensity>=0&&g.intensity<=1);
 const ids=Object.keys(g.fish);
 assert(ids.length&&ids.every(id=>spec[id].kind===g.kind),"a zone advertises only resident compatible species");
}
const g=a.groups.find(g=>g.kind==="peace"&&g.intensity>.22);
assert(g,"an active peaceful territory is readable");
const s=spec[Object.keys(g.fish)[0]];
const close=L.bonus(a,s,g.X,g.Z);
const far=L.bonus(a,s,g.X+1000,g.Z+1000);
assert(close>far*1.4,"moving closer to real feeding fish must improve bite odds materially");
assert.equal(L.bonus(a,spec.perch,g.X,g.Z) <= close,true,"peaceful shoal cannot boost predator odds");
const cue=L.onCast(a,g.X,g.Z);
assert(cue.level===2 && cue.text.includes(g.name),"casting to a real shoal produces a readable fishing hint");
const caught=L.onCatch(a,s,g.X,g.Z);
assert(caught&&caught.rest>=18,"hooked fish should scatter a real shoal");
assert(L.bonus(a,s,g.X,g.Z)<close*.6,"spot pressure reduces immediate repeat farming");
assert(!L.spots(a).some(sp=>sp.X===g.X&&sp.Z===g.Z),"scared shoal cannot show fake feeding activity");
for(let i=0;i<60*32;i++)L.update(a,sess,1/60);
assert(g.pressure===0,"shoal returns after a finite recovery period");
assert(L.spots(a).every(sp=>sp.life>0&&sp.intensity>0),"the rendered signs describe actual living positions");
const empty=L.create({id:"bare",zfar:50,fish:{}},"summer",spec,30,z=>z*.2,"day");
assert.equal(L.bonus(empty,s,0,20),.86,"no invented fish or reward for empty water");
console.log("PASS living water: persistent shoals, season, habitat, visual/catch coherence, response, recovery");

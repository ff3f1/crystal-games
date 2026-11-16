/* Frame-rate stability and landing continuity, using production functions. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const FZ={};vm.runInNewContext(fs.readFileSync("games/fish/js/fight-physics.js","utf8"),{window:{FZ}});
vm.runInNewContext(fs.readFileSync("games/fish/js/rod-art.js","utf8"),{window:{FZ},Image:function(){},Math});
function retrieve(fps){const r={reeling:true};for(let i=0;i<fps*2;i++)FZ.FightPhysics.lure(r,{zone:"bottom",speed:2,depth:4},1/fps);r.reeling=false;for(let i=0;i<fps;i++)FZ.FightPhysics.lure(r,{zone:"bottom",speed:2,depth:4},1/fps);return r;}
const results=[30,60,120].map(retrieve);
for(const r of results){assert.equal(r.retrieveStyle,"Падение");assert.ok(r.lureSpeed<.001);assert.ok(Math.abs(r.lureDepth-results[1].lureDepth)<.04);}
const r={reeling:false,lureDepth:2,twitch:1};
FZ.FightPhysics.lure(r,{zone:"bottom",speed:2,depth:4},1/60);
assert.equal(r.retrieveStyle,"Ступенька");assert.ok(r.lureDepth<2);
let previous=null;
for(let i=0;i<=210;i++){
 const v={fish:{X:1,Z:5,lenM:.8},landing:{k:i/210}};
 const p=FZ.RodArt.landingPose(v,390,844,()=>({x:180,y:640,s:35}));
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.fishY));
 if(previous){assert.ok(Math.abs(p.fishY-previous.fishY)<4);assert.ok(Math.abs(p.length-previous.length)<4);}
 if(i===0){assert.equal(p.fishX,180);assert.equal(p.fishY,640);}
 if(i===210){assert.equal(p.x,p.fishX);assert.ok(p.fishY<640);assert.ok(p.sag>1);}
 previous=p;
}
console.log("PASS lure 30/60/120 FPS; jig lift/fall; continuous fish-to-net trajectory");

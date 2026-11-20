/* Smoke tests for illustrated fish-fight FX, no dependencies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../games/fish/js/cozy-fight.js'),'utf8');
let calls={ellipses:0,strokes:0,oldFish:0,oldLanding:0,oldCatch:0};
const ctx={save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},ellipse(){calls.ellipses++},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){calls.strokes++},set strokeStyle(v){},set lineWidth(v){},set lineCap(v){}};
const root={querySelector(s){return s==='.catch'?card:s==='#cFish'?fish:null}};
const card={classList:{add(x){this.last=x}},setAttribute(k,v){this[k]=v},appendChild(el){this.last=el}},fish={classList:{add(x){this.last=x}}};
const FZ={Scene:{
  drawFightFish(){calls.oldFish++},
  drawLanding(){calls.oldLanding++}
},UI:{showCatch(){calls.oldCatch++}}};
vm.runInNewContext(src,{window:{FZ,matchMedia:()=>({matches:false})},document:{
  getElementById(id){return id==='cv'?{getContext:()=>ctx}:root},
  createElement(){return {className:'',setAttribute(){}}}
}});
function sample(overrides={}){return {fish:{X:1,Z:6,vx:1.1,vz:.6,surface:.7,jump:null,...overrides},ice:null}}
const light={dark:.25},p={x:160,y:380,s:30};
FZ.Scene.drawFightFish(sample(),light,2,p);
assert.equal(calls.oldFish,1);
assert(calls.strokes>0,'fish wake');
const previous=calls.strokes;
FZ.Scene.drawFightFish(sample({jump:{k:.3}}),light,2,p);
assert.equal(calls.strokes,previous,'jump has no water wake');
FZ.Scene.drawFightFish({...sample(),ice:{holeId:1}},light,2,p);
assert.equal(calls.strokes,previous,'winter has no water wake');
FZ.Scene.drawLanding({...sample(),landing:{k:.4}},light,2,{fishX:160,fishY:380,lift:.4,radius:26});
assert.equal(calls.oldLanding,1);
assert(calls.strokes>previous,'net ripple');
FZ.UI.showCatch({trophy:true,record:true});
assert.equal(card['data-cozy-award'],'trophy');
assert.equal(card.classList.last,'cozy-wood-trophy');
assert.equal(fish.classList.last,'cozy-catch-fish');
assert.equal(calls.oldCatch,1);
const stats=FZ.CozyFight.stats();
assert(stats.fighting>=1&&stats.shore>=1&&stats.landing>=1);
console.log('PASS water wake, no fake winter/jump waves, net ripple, trophy overlay and original handlers');

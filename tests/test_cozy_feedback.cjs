/* Cozy SFX and visual FX are deterministic about *when* they may trigger. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../games/fish');
for(const id of ['bite','take','strike','drag','hook','land','plop']){
 const p=path.join(ROOT,'assets/audio/cozy',id+'.wav'),b=fs.readFileSync(p);
 assert.equal(b.toString('ascii',0,4),'RIFF',id);
 assert.equal(b.toString('ascii',8,12),'WAVE',id);
 assert.equal(b.readUInt16LE(20),1,'PCM format '+id);
 assert.equal(b.readUInt16LE(22),1,'mono '+id);
 assert.equal(b.readUInt32LE(24),22050,'sample rate '+id);
 assert.equal(b.readUInt16LE(34),16,'PCM16 '+id);
 assert.equal(b.readUInt32LE(40),b.length-44,'data length '+id);
 let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));
 assert(peak>300,'not silent '+id);assert(peak<32767,'not clipped '+id);
}
const source=fs.readFileSync(path.join(ROOT,'js/cozy-feedback.js'),'utf8');
const calls=[],ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},set fillStyle(v){}};
const cv={getContext:()=>ctx};
const session={ice:false,mode:'float',t:0};
const rig={X:2,Z:8,state:'wait',fish:null};
const FZ={Game:{sess:()=>session,rig:()=>rig},UI:{onEvent(e){calls.push(e.type)}},Scene:{
 proj:(x,z)=>({x:200+x*9,y:300+z}),drawScreenFx(dt){return'original';}
}};
vm.runInNewContext(source,{window:{FZ},document:{getElementById:()=>cv}});
assert.equal(FZ.CozyFeedback.stats().particles,0);
FZ.UI.onEvent({type:'msg',text:'Тихо'});
assert.equal(FZ.CozyFeedback.stats().particles,0,'idle does not fake ripples');
FZ.UI.onEvent({type:'take'});
assert.equal(FZ.CozyFeedback.stats().particles,4,'real take produces four droplets');
FZ.UI.onEvent({type:'hooked',big:true});
assert(FZ.CozyFeedback.stats().particles<=32,'particle budget');
for(let k=0;k<50;k++){session.t+=1/60;FZ.Scene.drawScreenFx(1/60)}
assert.equal(FZ.CozyFeedback.stats().particles,0,'particles expire');
session.ice={holeId:1};FZ.UI.onEvent({type:'take'});
assert.equal(FZ.CozyFeedback.stats().particles,0,'winter does not draw droplets');
session.ice=false;rig.state='fight';rig.fish={X:1,Z:7,surface:.7};session.t+=2;
FZ.Scene.drawScreenFx(1/60);
assert(FZ.CozyFeedback.stats().particles>0,'a hooked surface fish makes a small wake');
FZ.UI.onEvent({type:'session'});
assert.equal(FZ.CozyFeedback.stats().particles,0,'session reset');
assert.deepEqual(calls,['msg','take','hooked','take','session'],'original event pipeline intact');
console.log('PASS seven WAV, event triggers, particle cap, expiry, winter, fight, reset');

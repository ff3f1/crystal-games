/* Input ownership regression. Runs real main.js with a minimal host. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function host(width=390) {
  const handlers={};
  const target=name=>({classList:{remove(){},add(){}},addEventListener(t,f){(handlers[name+":"+t]||=[]).push(f);},
    setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}});
  const cv=target("cv"),win=target("window"),doc=target("document");
  let rig={state:"fight",tilt:0,reeling:false},open=false,casts=0,strikes=0;
  const sess={mode:"spin",ice:false};
  doc.getElementById=id=>id==="cv"?cv:target(id);
  doc.fonts={load:()=>new Promise(()=>{})};
  const FZ={U:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},
    Game:{rig:()=>rig,sess:()=>sess,cast(){casts++;},strike(){strikes++;},
      aimClamp:(X,Z)=>({X,Z})},
    UI:{anyOpen:()=>open},
    Scene:{size:()=>({W:width,shoreY:180}),unproj:(x,y)=>({X:x,Z:y})},
    Sound:{unlock(){}}};
  win.FZ=FZ;
  vm.runInNewContext(fs.readFileSync("games/fish/js/main.js","utf8"),{
    window:win,document:doc,navigator:{webdriver:true},performance:{now:()=>100},
    requestAnimationFrame(){},setTimeout(){},Promise,Map,Set,Math,Array
  });
  const fire=(name,type,id,x=100,y=500)=>{for(const f of handlers[name+":"+type]||[])f({
    pointerId:id,pointerType:"touch",button:0,clientX:x,clientY:y,preventDefault(){}});};
  return {I:FZ.Input,fire,rig,sess,setOpen:v=>open=v,setRig:r=>rig=r,counts:()=>({casts,strikes})};
}
for(const width of [360,390,412,768]) {
  const h=host(width),{I,rig,fire}=h;
  I.actionDown(11);assert.equal(rig.reeling,true);
  fire("cv","pointerdown",22);fire("cv","pointermove",22,150);
  assert.ok(rig.tilt>0);assert.equal(rig.reeling,true);
  fire("cv","pointerup",22,150);assert.equal(rig.reeling,true);
  I.actionUp(11);assert.equal(rig.reeling,false);
  I.actionDown(11);fire("cv","pointerdown",22);
  fire("cv","pointercancel",22);assert.equal(rig.reeling,true);
  I.actionUp(11);assert.equal(rig.reeling,false);
  I.actionDown(11);I.actionDown(33);I.actionUp(11);assert.equal(rig.reeling,true);
  I.actionUp(33);assert.equal(rig.reeling,false);
  I.actionDown(11);h.setOpen(true);I.sync();assert.equal(rig.reeling,false);
  h.setOpen(false);I.sync();assert.equal(rig.reeling,false);
  I.actionDown(11);fire("window","blur",0);assert.equal(rig.reeling,false);
  rig.state="idle";fire("cv","pointerdown",22);fire("cv","pointercancel",22);
  assert.equal(h.counts().casts,0);
  rig.state="fight";fire("cv","pointerdown",22);rig.state="idle";
  fire("cv","pointerup",22);assert.equal(h.counts().casts,0);
  rig.state="fight";I.actionDown(11);h.setRig({state:"fight"});I.sync();
  assert.equal(I.snapshot().actions,0);
  console.log("PASS independent pointers, cancellation, menu, blur, rig change:",width);
}

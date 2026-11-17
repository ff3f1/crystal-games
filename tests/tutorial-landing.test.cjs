const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const FZ={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../games/fish/js/fight-physics.js'),'utf8'),{window:{FZ}});
for(const fps of [30,60,120])test(`tired tutorial fish can be steadily landed at ${fps} FPS`,()=>{
  const rod={power:3,sens:.8,reel:1.2};
  const parameters={rod,lineTest:6,drag:.8,fishPull:.3,phase:'tired',currentLoad:0,surge:0,reeling:true};
  let normal=11, novice=11;
  const standard={Fmax:2,S:0,T:.4,vz:0,vx:0};
  const tutorial={Fmax:2,S:0,T:.4,vz:0,vx:0};
  for(let i=0;i<fps*8;i++){
    const dt=1/fps;
    const a=FZ.FightPhysics.line(standard,{...parameters,tutorial:false},dt);
    const b=FZ.FightPhysics.line(tutorial,{...parameters,tutorial:true},dt);
    assert.ok(!b.slipping);
    novice-=b.intake*dt;normal-=a.intake*dt;
  }
  assert.ok(novice < 3.6,`novice should reach net distance: ${novice}`);
  assert.ok(normal > novice+4,`non-tutorial pace unchanged: ${normal}, ${novice}`);
  assert.ok(Math.abs(tutorial.T-standard.T)<1e-6,'teaching assist must not modify line tension');
});

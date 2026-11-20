const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../games/fish/js');
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:()=>null},console,setTimeout:()=>0,clearTimeout:()=>{}};
for(const p of ['util','data','content','world','fishing-ecology','game']){
 vm.runInNewContext(fs.readFileSync(path.join(base,p+'.js'),'utf8'),context,{filename:p+'.js'});
}
const F=context.window.FZ,G=F.Game;
F.Scene={period:h=>h<6?'night':h<9?'dawn':h<18?'day':h<21?'dusk':'night',sunTimes:()=>[6,20],maxLat:z=>10+z*.22,ring(){},splash(){},shake(){},distantJump(){},chips(){},holeGeom(){return{x:100,y:140}}};
F.Platform={vibrate(){}};
F.Sound=new Proxy({},{get:()=>()=>{}});
const st=G.load(),s=G.startSession('pond','summer'),r=G.rig();
const spec=F.SP.pike,w=spec.trophy*1.1;st.active='float';
r.state='landing';r.X=1;r.Z=3.6;r.netting=false;
r.fish={s:spec,w,lenCm:100,lenM:1,hooked:true,X:1,Z:3.6,D:0,vx:0,vz:0,
 S:.12,effort:0,phase:'tired',phaseT:2,T:1,Fmax:5,slackT:0,snagT:0,
 surface:1,jump:null,chance:0,jumped:0,t:0};
r.landing={k:0,trophyNet:true};
G.update(.1,0.1);const slow=r.landing.k;
assert(slow>.02 && slow<.05,slow);
r.landing.k=0;r.netting=true;G.update(.1,.2);const fast=r.landing.k;
assert(fast>slow*2,JSON.stringify({slow,fast}));
r.landing.k=0;r.landing.trophyNet=false;r.netting=false;G.update(.1,.3);
const ordinary=r.landing.k;
assert(ordinary>slow,'ordinary fish use original faster auto-landing');
const source=fs.readFileSync(path.join(base,'cozy-concept-menu.js'),'utf8');
assert.match(source,/id="mRate"/);assert.match(source,/FZ\.Platform\.rate\(\)/);
assert.match(fs.readFileSync(path.join(base,"renewal.js"),"utf8"),/id=\\"mHelp\\"/); // tutorial remains in original menu
console.log('PASS stage8: trophy landing is skill-assisted but not mandatory; menu has official RuStore rate control');

/* Real-species ecology and fish-fight regression, no browser dependencies.
 * node tests/test_fishing_ecology.cjs
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../games/fish/js');
const storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const context={window:{},localStorage,document:{getElementById:()=>null},console,setTimeout:()=>0,clearTimeout:()=>{}};
for(const p of ['util','data','content','world','fishing-ecology','game'])
  vm.runInNewContext(fs.readFileSync(path.join(root,p+'.js'),'utf8'),context,{filename:p+'.js'});
const FZ=context.window.FZ,U=FZ.U,E=FZ.Ecology,G=FZ.Game;
FZ.Scene={
 period:h=>h<6?'night':h<9?'dawn':h<18?'day':h<21?'dusk':'night',
 sunTimes:()=>[6,20],maxLat:z=>10+z*.22,
 splash(){},ring(){},shake(){},distantJump(){},chips(){},holeGeom(){return{x:150,y:140}}
};
FZ.Sound=new Proxy({}, {get:()=>()=>{}});
FZ.Platform={vibrate(){}};
FZ.Expeditions={};
assert.equal(FZ.SPECIES.length,62);
assert.equal(FZ.LOCATIONS.length,20);
assert.equal(new Set(FZ.SPECIES.map(s=>s.id)).size,62);
for(const s of FZ.SPECIES){
 assert(s.season&&s.time&&s.methods&&s.baits&&s.depth, 'species model '+s.id);
 assert(Object.values(s.baits).some(x=>x>0),'has a valid food '+s.id);
 assert(Object.values(s.methods).some(x=>x>0),'has a viable method '+s.id);
}
const st=G.load(),sess=G.startSession('pond','summer'),rig=G.rig();
sess.period='day';rig.X=5;rig.Z=10;
const weight=id=>G.biteTable().find(x=>x[0].id===id)?.[1]||0;
st.load.float.bait='bread';const breadPike=weight('pike'),breadCrucian=weight('crucian');
assert.equal(breadPike,0,'pike cannot bite bread');
assert(breadCrucian>0,'crucian can bite bread');
st.load.float.bait='livebait';st.inv.livebait=30;
assert(weight('pike')>0,'pike can bite live bait');assert.equal(weight('crucian'),0);
st.active='spin';st.load.spin.rod='s1';st.load.spin.bait='spoon';st.lures.spoon=1;
G.startSession('pond','summer');G.sess().period='day';
assert(weight('pike')>0,'pike can bite lure');assert.equal(weight('crucian'),0,'crucian cannot bite spoon');
// Habitat logic: species actually react to edges/depth/current.
const pond=FZ.LOC.pond,pike=FZ.SP.pike,bream=FZ.SP.bream;
assert(E.habitat(pike,pond,15,9,35,18)>E.habitat(pike,pond,0,9,35,18));
assert(E.habitat(FZ.SP.crucian,pond,15,9,35,18)>E.habitat(FZ.SP.crucian,pond,0,9,35,18));
assert(E.habitat(bream,FZ.LOC.oka,0,38,42,18)>E.habitat(bream,FZ.LOC.oka,0,7,42,18));
assert(E.habitat(FZ.SP.chub,FZ.LOC.oka,9,15,25,18)>E.habitat(FZ.SP.chub,FZ.LOC.oka,0,15,25,18));
// Spot signs are grounded in a real live species and weaken with distance.
const spot=[{type:'boil',speciesId:'pike',X:4,Z:9,life:19}];
assert(E.spotBonus(pike,spot,4,9)>2);
assert(E.spotBonus(pike,spot,20,30)===1);
assert.equal(E.spotBonus(FZ.SP.crucian,spot,4,9),1);
const bubble=[{type:'bubbles',speciesId:'crucian',X:4,Z:9,life:19}];
assert(E.spotBonus(FZ.SP.crucian,bubble,4,9)>E.spotBonus(FZ.SP.roach,bubble,4,9));
assert.equal(E.spotBonus(pike,bubble,4,9),1);
const rng=U.rng(5513);
for(let i=0;i<100;i++){
 const sp=E.spawnSpot(FZ.LOC.pond,'summer','day',{pred:1,peace:1},30,z=>15,rng);
 assert(sp && FZ.LOC.pond.fish[sp.speciesId] && sp.Z>=6 && sp.Z<=30,'observable actual pond fish');
 assert(sp.type===(E.isPredatorSpot(FZ.SP[sp.speciesId])?'boil':'bubbles'));
 assert(FZ.SP[sp.speciesId].season.summer*FZ.SP[sp.speciesId].time.day>=.22);
}
// A moving spoon/spinner, or bottom jig with a deliberate pause, is more credible.
const spinner=FZ.BAIT.spinner,jig=FZ.BAIT.jig;
assert(E.presentation(pike,spinner,'spin','day',{spinPause:0})>E.presentation(pike,spinner,'spin','day',{spinPause:4}));
assert(E.presentation(FZ.SP.perch,jig,'spin','day',{spinPause:.8})>E.presentation(FZ.SP.perch,jig,'spin','day',{spinPause:5}));
assert.equal(E.presentation(FZ.SP.crucian,spinner,'spin','day',{spinPause:0}),0);
assert.equal(E.patience(0,300),0,'no guaranteed bites from empty table');
assert(E.patience(.08,30)>E.patience(.002,30),'good spot improved, poor spot not forced');
const T=E.trophyQuality(pike,'spoon',pond,{X:14,Z:8},35,18,'summer','dusk',spot);
assert(T>.5&&T<1.5,'trophy chance still rare, not guaranteed');
// Big carp is a longer, more powerful runner than a small bream.
assert(E.profile(FZ.SP.carp,10).duration>E.profile(bream,.5).duration);
assert(E.profile(FZ.SP.catfish,20).speed<E.profile(FZ.SP.taimen,20).speed);
const baseFish=(s,w)=>({s,w,S:1,phase:'rest'});
assert.equal(E.nextPhase(baseFish(pike,7),true,()=>.3),'run');
assert.notEqual(E.nextPhase(baseFish(FZ.SP.crucian,.25),false,()=>.3),'run');
// There must be no forced empty-spot catch merely because time passes.
st.active='float';st.load.float.bait='crawler';st.inv.crawler=25;
G.startSession('pond','summer');G.sess().period='day';
const state=G.rig();state.state='wait';state.X=3;state.Z=10;state.idleT=0;
assert.equal(G.biteTable().length,0,'no pond species eats crawler with starter float');
for(let i=0;i<95;i++)G.update(1,i);
assert.equal(state.state,'wait','no idle time bypass on incompatible bait');
assert.equal(state.bite,null,'zero probability must remain zero');
assert.match(fs.readFileSync(path.join(root,'game.js'),'utf8'),/E[cC]ology\.patience|FZ\.Ecology\.patience/);
assert(!fs.readFileSync(path.join(root,'game.js'),'utf8').includes('r.idleT > Math.min(24'), 'forced bite was removed');
// Shore tactics must be species-aware and never send fish through dry land.
assert.equal(E.chooseRunDirection(FZ.SP.pike,12,16,()=>.1),1);
assert.equal(E.chooseRunDirection(FZ.SP.bream,12,16,()=>.1),-1);
assert.equal(E.chooseRunDirection(FZ.SP.pike,15.8,16,()=>.1),-1);
// Real engine regression: a trophy may make one warned final run near the bank.
const species=FZ.SP.carp,fishWeight=10,maxPull=species.fight.power*(.6+1.2*Math.pow(fishWeight,.75));
st.load.float.rod='f3';st.load.float.line='l7';st.load.float.hook='h4';
state.state='fight';state.X=6;state.Z=11;
state.fish={s:species,w:fishWeight,lenCm:80,lenM:.8,hooked:true,X:6,Z:11,D:0,vx:0,vz:0,
  S:.25,effort:.38,phase:'rest',phaseT:.95,T:maxPull*.35,Fmax:maxPull,slackT:0,snagT:0,
  surface:0,jump:null,chance:0,jumped:0,t:0};
G.update(.05,96);
assert(state.fish.finalSurge,'trophy final surge initiated');
assert(state.fish.warning,'warning occurs before actual run');
assert.equal(state.fish.nextPhase,'run');
for(let i=0;i<12;i++)G.update(.05,96.05+i*.05);
assert.equal(state.fish.phase,'run','trophy enters its final run');
assert(state.fish.finalSurge,'final surge can trigger only once');
assert.match(fs.readFileSync(path.join(root,'ui.js'),'utf8'),/Трофей делает последний рывок/);

console.log('PASS 62 species, 20 waters, bait compatibility, habitat, feeding spots, presentation, trophy temperament, no forced bite, cover tactics and warned trophy surge');

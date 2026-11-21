/* Cozy motion and fight safety: use the same source shipped to mobile WebView. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../games/fish");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const context={window:{},document:{getElementById:()=>null},console,setTimeout:()=>0,clearTimeout:()=>{},
 localStorage:{getItem:()=>null,setItem:()=>{} }};
for(const p of ["util","data","content","world","fishing-ecology","game","cozy-motion"]){
 vm.runInNewContext(read("js/"+p+".js"),context,{filename:p+".js"});
}
const F=context.window.FZ, G=F.Game, M=F.CozyMotion, E=F.Ecology;
F.Scene={
 period:h=>h<6?"night":h<9?"dawn":h<18?"day":h<21?"dusk":"night",
 sunTimes:()=>[6,20],maxLat:z=>10+z*.22,
 ring(){},splash(){},shake(){},distantJump(){},chips(){},holeGeom(){return{x:150,y:140}}
};
F.Sound=new Proxy({},{get:()=>()=>{}});
F.Platform={vibrate(){}};
assert(M,"CozyMotion module loaded");
const agile={w:3,phase:"run",vx:2.4,vz:.2,swimPhase:2,S:.9};
const exhausted={...agile,phase:"tired",vx:0,vz:0};
const shaking={...agile,phase:"shake"};
assert(M.fishPose(agile,1).amp>M.fishPose(exhausted,1).amp*2,
  "fast pike beats its tail much harder than an exhausted fish");
assert(M.fishPose(shaking,1).amp>M.fishPose(agile,1).amp,
  "head shake and sprint have distinct movement");
assert.equal(M.fishPose({...agile,swimPhase:4.5},20).phase,4.5,
  "swim animation is driven by integrated game time, not reset on phase change");
assert(read("js/scene.js").includes("FZ.CozyMotion.fishPose"),
  "real game must animate fish with phase-aware pose");
assert.equal(M.surfaceEnergy({phase:"dive",D:3,surface:1}),0,
 "deep fish cannot create surface foam even at high speed");
assert(M.surfaceEnergy({phase:"run",D:.12,surface:.8})>.5,
 "a genuine near-surface run still disturbs water");
assert(M.surfaceEnergy({phase:"dive",D:0,surface:.5}) <
 M.surfaceEnergy({phase:"run",D:0,surface:.5}),
 "deep-fish surface activity decays at the start of its dive");
const from={x:300,y:280},to={x:80,y:400};
const tautLine=M.lineShape({fish:{hooked:true,tension:.8,slackT:0}},3,from,to,844);
const slackLine=M.lineShape({fish:{hooked:true,tension:.05,slackT:.9}},3,from,to,844);
assert(slackLine.sag>tautLine.sag+6,"real slack makes the one fishing line visibly bow");
assert(slackLine.sag<19,"slack never creates an enormous cartoon loop");
assert(M.lineShape({fish:null},3,from,to,844).sag===3,
 "the cast line retains the original physics when there is no hooked fish");
assert(slackLine.opacity<tautLine.opacity,"slack line is optically lighter, not duplicated");
assert(read("js/scene.js").includes("FZ.CozyMotion.lineShape"),
 "game renderer must draw real tension through the existing line path");
assert(read("js/rod-art.js").includes("drawRotor(ctx, mode, reelAngle)") &&
 !read("js/rod-art.js").includes("drawCrank(ctx, mode, reelAngle)"),
 "reel image must have subtle rotor animation instead of oversized cartoon crank");
assert.equal(M.lurePose("wobbler",true,0,1).visible,true);
assert.equal(M.lurePose("mouse",false,4,1).visible,true);
assert.equal(M.lurePose("jig",true,0,1).visible,false);
assert.equal(M.lurePose("spoon",true,0,1).visible,false,"mid-water spoon not falsely floating");
assert.equal(M.lurePose("spinner",false,4,1).wake,0,"no wake when paused");
assert.equal(M.lurePose("spoon",true,0,1).wake,0,"submerged spoon never paints a surface wake");
assert.equal(M.lurePose("spinner",true,0,1).wake,0,"submerged spinner never paints a surface wake");
assert(M.lurePose("wobbler",false,2,1).wake<.001,"stationary surface lure settles after retrieve");
assert(M.lurePose("wobbler",false,.1,1,1).wake>M.lurePose("wobbler",false,.1,1,0).wake,
 "existing wobbler responds visually to a real twitch");
assert.equal(M.lurePose("spoon",false,0,1,1).wake,0,"twitch never makes submerged spoon look surface-floating");
const spoonFlight=M.castPose("spoon",.5,1),jigFlight=M.castPose("jig",.5,1);
assert(spoonFlight.sx<1 && Number.isFinite(spoonFlight.angle),"spoon visibly flutters during real cast");
assert.equal(jigFlight.sx,1,"submerged jig stays stable in air");
const f={hooked:true,phase:"shake",S:.9,tension:.8,vx:0,vz:0};
const shake=M.rodReaction({mode:"spin",fish:f},.08);
assert(Math.abs(shake.x)>0||Math.abs(shake.y)>0,"actual head-shake shakes rod tip");
const none=M.rodReaction({mode:"float",fish:null},.1);
assert.equal(none.x,0);assert.equal(none.y,0);
const ice=M.rodReaction({mode:"ice",fish:f},.1);
assert.equal(ice.x,0);
const run=M.rodReaction({mode:"spin",fish:{...f,phase:"run",vx:3,vz:-1}},.1);
assert(run.x>0,"rod pulls with actual fish run");
assert(Math.abs(run.x)<5,"no overacted pixel jumps");
const dive=M.rodReaction({mode:"spin",fish:{...f,phase:"dive",tension:.7}},.2);
assert(dive.y>1&&Math.abs(dive.x)<1,"deep fish load bends the same rod tip, without fake motion");
const actions=[];const ctx={
 save(){actions.push("save")},restore(){actions.push("restore")},translate(){},rotate(){},
 drawImage(){actions.push("drawImage")},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){actions.push("stroke")},
 set lineWidth(x){},set strokeStyle(x){},set globalAlpha(x){}
};
const st=G.load();st.load.spin.rod="s1";st.rods.push("s1");st.lures.wobbler=1;
G.startSession("pond","summer");G.sess().mode="spin";G.loadout("spin").bait="wobbler";
G.rig().spinPause=0;
const surfaceImage={naturalWidth:200};
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:null},{x:45,y:110},{reeling:true},2,()=>surfaceImage),true);
assert(actions.includes("drawImage"));
assert(actions.includes("stroke"),"actual lure leaves a short surface wake");
let noExtra=0;
ctx.drawImage=()=>{noExtra++};
actions.length=0;
 st.load.spin.bait="spoon";
 assert.equal(M.drawSurface(ctx,{mode:"spin",fish:null},{x:45,y:110},{reeling:true},2,()=>surfaceImage),false);
 assert(!actions.includes("stroke"),"underwater spoon must not create a false surface wake");
 st.load.spin.bait="jig";
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:null},{x:45,y:110},{reeling:true},2,()=>surfaceImage),false);
assert.equal(noExtra,0,"underwater jig never drawn at surface");
st.load.spin.bait="wobbler";
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:{hooked:true}},{x:45,y:110},{reeling:true},2,()=>surfaceImage),false,"no lure when fish hooked");
assert(E.isEdgeFish(F.SP.pike));
assert(!E.isEdgeFish(F.SP.bream));
assert(!read("js/game.js").includes("EDGE_FISH"),"no dangling fish class reference");
assert(!read("js/cozy-gear.js").includes("ctx.ellipse(p.x,p.y+1"),"never draw unconditional ring above submerged gear");
assert(read("js/main.js").includes("G.twitchSpin()"),"canvas input is wired to real lure action");
// An extended fight at the edge should end in loss, not a ReferenceError.
const sess=G.startSession("pond","summer"),rig=G.rig();
st.active="float";st.load.float.rod="f3";st.rods.push("f3");st.load.float.line="l7";st.lines.push("l7");st.load.float.hook="h4";st.hooks.push("h4");
const sp=F.SP.pike,w=8,power=sp.fight.power*(.6+1.2*Math.pow(w,.75));
rig.state="fight";rig.X=14;rig.Z=11;rig.reeling=false;rig.tilt=0;
rig.fish={s:sp,w,lenCm:90,lenM:.9,hooked:true,X:999,Z:11,D:0,vx:0,vz:0,
 S:.7,effort:.85,phase:"run",nextPhase:"run",phaseT:2,T:power*.2,Fmax:power,
 slackT:0,snagT:2.39,surface:0,jump:null,chance:0,jumped:0,t:0,overload:0,runSpeed:2.5};
G.update(.07,1);
assert(rig.state!=="fight","snag fails gracefully, no reference errors");
assert(F.CozyMotion.rodReaction({mode:"spin",fish:{...f,hooked:true,phase:"run",vx:200,vz:200}},1).x<=5);
console.log("PASS lure movement, pause, fish-driven rod tip, one endpoint, no underwater jig, grass snag safety");

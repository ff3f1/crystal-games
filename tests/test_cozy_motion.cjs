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
assert.equal(M.lurePose("wobbler",true,0,1).visible,true);
assert.equal(M.lurePose("mouse",false,4,1).visible,true);
assert.equal(M.lurePose("jig",true,0,1).visible,false);
assert.equal(M.lurePose("spoon",true,0,1).visible,false,"mid-water spoon not falsely floating");
assert.equal(M.lurePose("spinner",false,4,1).wake,0,"no wake when paused");
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
const actions=[];const ctx={
 save(){actions.push("save")},restore(){actions.push("restore")},translate(){},rotate(){},
 drawImage(){actions.push("drawImage")},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){actions.push("stroke")},
 set lineWidth(x){},set strokeStyle(x){},set globalAlpha(x){}
};
const st=G.load();st.load.spin.rod="s1";st.load.spin.bait="wobbler";st.rods.push("s1");
G.startSession("pond","summer");G.sess().mode="spin";
G.rig().spinPause=0;
const surfaceImage={naturalWidth:200};
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:null},{x:45,y:110},{reeling:true},2,()=>surfaceImage),true);
assert(actions.includes("drawImage"));
assert(!actions.includes("moveTo")===false);
let noExtra=0;
ctx.drawImage=()=>{noExtra++};
st.load.spin.bait="jig";
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:null},{x:45,y:110},{reeling:true},2,()=>surfaceImage),false);
assert.equal(noExtra,0,"underwater jig never drawn at surface");
st.load.spin.bait="wobbler";
assert.equal(M.drawSurface(ctx,{mode:"spin",fish:{hooked:true}},{x:45,y:110},{reeling:true},2,()=>surfaceImage),false,"no lure when fish hooked");
assert(E.isEdgeFish(F.SP.pike));
assert(!E.isEdgeFish(F.SP.bream));
assert(!read("js/game.js").includes("EDGE_FISH"),"no dangling fish class reference");
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

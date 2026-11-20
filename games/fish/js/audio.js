/* Original score and short foley, with independent music, effects and nature levels. */
(function(FZ){
 'use strict';
 const S={on:true,music:true};let ac=null,unlocked=false,music=null,wanted='dawn',track='',clock=0,nextBird=14;
 const gates=new Set(),cache={},voices=new Set();let params={},lastReel=-10,lastDrag=-10;
 const cozyFiles=new Set(['bite','take','strike','drag','hook','land','plop']);
 const file=id=>(id.startsWith('cozy_')&&cozyFiles.has(id.slice(5))?'assets/audio/cozy/'+id.slice(5)+'.wav':
  cozyFiles.has(id)?'assets/audio/cozy/'+id+'.wav':'assets/audio/renewal/'+id+'.mp3');
 function settings(){return FZ.Game&&FZ.Game.state()?FZ.Game.settings():{}}
 function vol(key){const v=settings().volumes||{};return v[key]==null?{music:.35,effects:.7,nature:.18}[key]:v[key]}
 function syncMusic(){
  if(!unlocked||!S.music||gates.size){if(music)music.pause();return}
  const id=wanted==='winter'?'winter':wanted==='night'?'night':'dawn';
  if(!music||track!==id){if(music)music.pause();music=new Audio(file(id));music.loop=true;track=id}
  music.volume=vol('music')*.52;music.play().catch(()=>{});
 }
 S.unlock=function(){
  unlocked=true;if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(_){}}
  if(ac&&ac.state==='suspended'&&!gates.size)ac.resume();syncMusic();
 };
 async function cue(id,gain=1,channel='effects'){
  if(!unlocked||!S.on||gates.size||!ac||!vol(channel))return;
  try{
   if(!cache[id])cache[id]=fetch(file(id)).then(r=>r.arrayBuffer()).then(b=>ac.decodeAudioData(b));
   const b=await cache[id];if(gates.size||!S.on||!vol(channel))return;
   const src=ac.createBufferSource(),v=ac.createGain();src.buffer=b;v.gain.value=vol(channel)*gain;src.connect(v);v.connect(ac.destination);voices.add(src);src.onended=()=>voices.delete(src);src.start();
  }catch(_){}
 }
 for(const id of ['click','cast','plop','splash','bite','bell','strike','snap','coin','level','trophy','fail','drill','flop','thunder'])S[id]=(intensity=1)=>cue(id,(id==='bite'?.65:1)*Math.max(.2,Math.min(1,intensity)));
 S.cozy=(id,gain=1)=>cozyFiles.has(id)?cue('cozy_'+id,Math.max(.15,Math.min(1,gain))):undefined;
 S.reel=function(speed){if(!ac)return;const t=ac.currentTime;if(t-lastReel<.12/Math.max(.5,speed))return;lastReel=t;cue('reel',.42)};
 S.drag=function(k){if(!ac)return;const t=ac.currentTime;if(t-lastDrag<.14)return;lastDrag=t;cue('drag',.35+k*.3)};
 S.updateAmbience=p=>{params=p||{}};
 S.tick=function(dt){
  if(!unlocked||!S.on||!ac||gates.size||!vol('nature'))return;
  clock+=dt;if(clock<nextBird||params.season==='winter'||params.period==='night')return;
  nextBird=clock+16+Math.random()*19;
  // Sparse, quiet phrases with real silence between them.
  cue('birds',.3,'nature');
 };
 S.playMusic=key=>{wanted=key;syncMusic()};S.stopMusic=()=>{if(music)music.pause()};
 S.setOn=v=>{S.on=!!v;if(!v)for(const s of voices){try{s.stop()}catch(_){}}};
 S.setMusic=v=>{S.music=!!v;syncMusic()};
 S.setVolumes=function(v){const st=settings();st.volumes={...st.volumes,...v};if(music)music.volume=vol('music')*.52};
 S.suspend=function(reason='app'){gates.add(reason);if(ac)ac.suspend();if(music)music.pause();for(const v of voices){try{v.stop()}catch(_){}}};
 S.resume=function(reason='app'){gates.delete(reason);if(gates.size)return;if(ac&&unlocked)ac.resume();syncMusic()};
 S.status=()=>({unlocked,paused:[...gates],music:S.music,track,playing:!!music&&!music.paused,volumes:settings().volumes||{},voices:voices.size});
 FZ.Sound=S;
})(window.FZ);

/* Clean authored score and resonant effects. No looping noise, rain hiss or sawtooth beds. */
(function(FZ){
 'use strict';
 const S={on:true,music:true};let ac=null,unlocked=false,music=null,wanted='dawn',track='',clock=0,nextBird=14;
 const gates=new Set(),cache={},voices=new Set();let params={},lastReel=-10,lastDrag=-10;
 const file=id=>'assets/audio/renewal/'+id+'.mp3';
 function settings(){return FZ.Game&&FZ.Game.state()?FZ.Game.settings():{}}
 function vol(key){const v=settings().volumes||{};return v[key]==null?{music:.35,effects:.7,nature:.18}[key]:v[key]}
 function syncMusic(){
  if(!unlocked||!S.music||gates.size){if(music)music.pause();return}
  const id=wanted==='winter'?'winter':'dawn';
  if(!music||track!==id){if(music)music.pause();music=new Audio(file(id));music.loop=true;track=id}
  music.volume=vol('music')*.52;music.play().catch(()=>{});
 }
 S.unlock=function(){
  unlocked=true;if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(_){}}
  if(ac&&ac.state==='suspended'&&!gates.size)ac.resume();syncMusic();
 };
 async function cue(id,gain=1){
  if(!unlocked||!S.on||gates.size||!ac||!vol('effects'))return;
  try{
   if(!cache[id])cache[id]=fetch(file(id)).then(r=>r.arrayBuffer()).then(b=>ac.decodeAudioData(b));
   const b=await cache[id];if(gates.size||!S.on||!vol('effects'))return;
   const src=ac.createBufferSource(),v=ac.createGain();src.buffer=b;v.gain.value=vol('effects')*gain;src.connect(v);v.connect(ac.destination);voices.add(src);src.onended=()=>voices.delete(src);src.start();
  }catch(_){}
 }
 for(const id of ['click','cast','plop','splash','bite','bell','strike','snap','coin','level','trophy','fail','drill','flop','thunder'])S[id]=()=>cue(id,id==='bite'?.65:1);
 S.reel=function(speed){if(!ac)return;const t=ac.currentTime;if(t-lastReel<.12/Math.max(.5,speed))return;lastReel=t;cue('reel',.42)};
 S.drag=function(k){if(!ac)return;const t=ac.currentTime;if(t-lastDrag<.14)return;lastDrag=t;cue('drag',.35+k*.3)};
 S.updateAmbience=p=>{params=p||{}};
 S.tick=function(dt){
  if(!unlocked||!S.on||!ac||gates.size||!vol('nature'))return;
  clock+=dt;if(clock<nextBird||params.season==='winter'||params.period==='night')return;
  nextBird=clock+16+Math.random()*19;
  // Sparse distant birds, bounded in level; silence between phrases.
  for(let j=0;j<3;j++){
   const t=ac.currentTime+j*.13,o=ac.createOscillator(),v=ac.createGain();
   o.frequency.setValueAtTime(2100+j*90,t);o.frequency.exponentialRampToValueAtTime(2650-j*120,t+.07);o.frequency.exponentialRampToValueAtTime(2000,t+.15);
   v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(vol('nature')*.018,t+.025);v.gain.exponentialRampToValueAtTime(.00001,t+.16);
   o.connect(v);v.connect(ac.destination);o.start(t);o.stop(t+.17);voices.add(o);o.onended=()=>voices.delete(o);
  }
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

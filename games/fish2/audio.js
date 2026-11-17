/* Original locally rendered score and sound design; no network playback. */
window.FishingAudio=(()=>{
 'use strict';
 let prefs={music:.38,nature:.65,effects:.75},active=false,hidden=false,biome='pond',winter=false;
 let music=null,nature=null,reel=null,ctx=null,cache={};
 const voices=new Set();
 function file(id){return 'assets/audio/'+id+'.mp3'}
 function loop(id,volume){const a=new Audio(file(id));a.loop=true;a.volume=volume;a.preload='auto';a.play().catch(()=>{});return a}
 function apply(){if(music)music.volume=prefs.music*.48;if(nature)nature.volume=prefs.nature;if(reel)reel.volume=prefs.effects*.36}
 function sync(){
  if(!active||hidden)return;
  const song=winter?'winter':'waterside',bed=winter&&biome!=='sea'?'winterwind':biome;
  if(!music||music.dataset.track!==song){if(music)music.pause();music=loop(song,prefs.music*.48);music.dataset.track=song}
  if(!nature||nature.dataset.track!==bed){if(nature)nature.pause();nature=loop(bed,prefs.nature);nature.dataset.track=bed}
 }
 function unlock(){active=true;hidden=false;sync();try{if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch(_){} }
 async function cue(id){
  if(!active||hidden||!prefs.effects)return;
  try{
   if(!ctx){unlock()}
   if(!cache[id])cache[id]=fetch(file(id)).then(r=>r.arrayBuffer()).then(b=>ctx.decodeAudioData(b));
   const buf=await cache[id];if(hidden||!prefs.effects)return;
   const s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=buf;v.gain.value=prefs.effects;s.connect(v);v.connect(ctx.destination);s.start();voices.add(s);s.onended=()=>voices.delete(s);
  }catch(_){}
 }
 function setReel(on){if(on&&active&&!hidden){if(!reel)reel=loop('reel',prefs.effects*.36);else if(reel.paused)reel.play().catch(()=>{})}else if(reel)reel.pause()}
 function pause(){hidden=true;[music,nature,reel].forEach(a=>a&&a.pause());for(const s of voices){try{s.stop()}catch(_){}}if(ctx&&ctx.state==='running')ctx.suspend()}
 function resume(){hidden=false;if(!active)return;[music,nature].forEach(a=>a&&a.play().catch(()=>{}));if(ctx&&ctx.state==='suspended')ctx.resume();sync()}
 return {unlock,cue,setReel,pause,resume,configure(p){prefs={...prefs,...p};apply()},scene(type,ice){biome=type;winter=ice;sync()},get status(){return {active,hidden,prefs,music:music?music.dataset.track:null,nature:nature?nature.dataset.track:null}}};
})();

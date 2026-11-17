/* On-demand local assets: never decode the whole fish atlas and all waters at boot. */
(function(FZ){
 'use strict';
 const M=window.FZ_ASSETS||{images:{},audio:{},tuning:{}};
 const A={img:{},ok:false,manifest:M,tuning:M.tuning||{},style:'paint',version:0};
 const requests={},use={};let tick=0;
 A.url=k=>M.images[k]?'assets/'+M.images[k]:null;
 A.request=function(k){
  use[k]=++tick;if(A.img[k])return A.img[k];if(requests[k]||!M.images[k])return null;
  const im=new Image();requests[k]=im;
  im.onload=()=>{A.img[k]=im;delete requests[k];A.version++;trim()};im.onerror=()=>{delete requests[k]};im.src=A.url(k);return null;
 };
 function trim(){
  for(const prefix of ['base/','bg/','fish/']){
   const keys=Object.keys(A.img).filter(k=>k.indexOf(prefix)===0).sort((a,b)=>(use[b]||0)-(use[a]||0));
   keys.slice(prefix==='fish/'?5:4).forEach(k=>{delete A.img[k];delete use[k]});
  }
 }
 A.load=function(onProgress){
  const keys=['base/pond','items/worm','items/float','items/gb','items/rod_float_entry','items/reel','items/line','items/hook','items/corn','items/bread','fish/crucian'];
  let done=0;return Promise.all(keys.filter(k=>M.images[k]).map(k=>new Promise(resolve=>{
   const im=new Image();im.onload=()=>{A.img[k]=im;use[k]=++tick;done++;if(onProgress)onProgress(done/keys.length);resolve()};im.onerror=()=>{done++;resolve()};im.src=A.url(k);
  }))).then(()=>{A.ok=true;A.version++;if(onProgress)onProgress(1)});
 };
 A.get=k=>A.request(k);
 A.has=()=>true;
 A.setStyle=style=>{A.style=style==='art'?'art':'paint';A.version++};
 A.bg=(loc,season)=>A.style==='art'?null:A.request('bg/'+loc+'_'+season);
 A.fish=id=>A.style==='art'?null:A.request('fish/'+id);
 A.item=id=>A.style==='art'?null:A.request('items/'+id);
 A.audio=k=>M.audio[k]?'assets/'+M.audio[k]:null;
 A.waterline=(loc,season)=>(A.tuning.waterline||{})['bg/'+loc+'_'+season]||.4;
 FZ.Assets=A;
})(window.FZ);

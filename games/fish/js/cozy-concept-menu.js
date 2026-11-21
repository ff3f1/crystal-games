/* Cozy Lodge Stage 8 — approved warm dawn / timber sign / real tackle.
   Existing nine game menu buttons and click handlers remain untouched. */
(function(FZ){
 "use strict";
 if(!FZ||!FZ.UI)return;
 const UI=FZ.UI, old=UI.showMenu,ov=document.getElementById("ovMenu");
 if(!old||!ov)return;
 const art={
   mMap:"assets/base/seliger.webp",
   mShop:"assets/equipment/reel_spinning_gold.png",
   mAtlas:"assets/fish-hd/perch.webp",
   mJourney:"assets/base/taiga.webp",
   mForecast:"assets/base/akhtuba.webp"
 };
 UI.showMenu=function(){
   const out=old.apply(this,arguments),lodge=ov.querySelector(".lodge");
   if(!lodge)return out;
   ov.classList.add("cozy-concept-menu");
   // A stable, atmospheric home panorama, independent of the currently selected fishing map.
   ov.style.backgroundImage='linear-gradient(180deg,rgba(255,219,153,.01),rgba(255,210,128,.04) 38%,rgba(6,34,29,.26) 62%,#0b2525 100%),url("assets/base/seliger.webp")';
   const title=lodge.querySelector(".lodge-title");
   if(title){
     title.insertAdjacentHTML("beforeend",'<img class="cozy-sign-fish" alt="" src="assets/fish-hd/perch.webp">');
     title.insertAdjacentHTML("afterend",
       '<div class="cozy-menu-scene" aria-hidden="true"><div class="cozy-menu-sun"></div><div class="cozy-menu-horizon"></div>'+
       '<img class="cozy-rod-still" src="assets/equipment/complete-hd/spin.webp" alt="">'+
       '<div class="cozy-menu-reeds"></div></div>');
   }
   const go=lodge.querySelector(".go");
   if(go){
     go.insertAdjacentHTML("afterbegin",'<span class="cozy-play-angler" aria-hidden="true">🎣</span>');
     // The decorative sunlit panorama is not the actual in-game weather.
     const session=FZ.Game&&FZ.Game.sess&&FZ.Game.sess();
     const weather=session&&session.wx&&session.wx.sky;
     const subtitle=go.querySelector("small");
     if(weather&&subtitle&&FZ.World&&FZ.World.skyName){
       subtitle.textContent+=" · "+FZ.World.skyName(weather);
       go.setAttribute("data-current-weather",weather);
     }
   }
   // Explicit, unobtrusive store rating action — same official route as Settings.
   const footer=lodge.querySelector(".lodge-footer");
   if(footer){
     const rating=document.createElement("button");
     rating.id="mRate";rating.type="button";rating.className="cozy-rate-btn";
     rating.textContent="★ Оценить игру";rating.setAttribute("aria-label","Оценить игру в RuStore");
     footer.appendChild(rating);
     rating.addEventListener("click",function(){
       FZ.Sound&&FZ.Sound.unlock&&FZ.Sound.unlock();
       FZ.Sound&&FZ.Sound.click&&FZ.Sound.click();
       FZ.Platform.rate();
     });
   }
   for(const [id,src] of Object.entries(art)){
     const tile=lodge.querySelector("#"+id);if(!tile)continue;
     const frame=document.createElement("span");frame.className="cozy-tile-art";
     const img=document.createElement("img");img.src=src;img.alt="";img.decoding="async";
     frame.appendChild(img);tile.insertBefore(frame,tile.firstChild);
     tile.classList.add("cozy-has-art");
   }
   return out;
 };
})(window.FZ);
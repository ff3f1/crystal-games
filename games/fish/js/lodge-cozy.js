/* Cozy Lodge: non-invasive visual polish for the existing 2.0.1 menu. */
(function(FZ){
  'use strict';
  if(!FZ||!FZ.UI||!FZ.Sound)return;
  var UI=FZ.UI,originalMenu=UI.showMenu,ov=document.getElementById('ovMenu');
  if(!ov||!originalMenu)return;
  var pressTimer=null,activeButton=null,installed=false;
  var decoration='<div class="cozy-atmosphere" aria-hidden="true">'+
    '<i class="cozy-sunlight"></i><i class="cozy-mist mist-a"></i><i class="cozy-mist mist-b"></i>'+
    '<i class="cozy-ripple ripple-a"></i><i class="cozy-ripple ripple-b"></i>'+
    '<i class="cozy-firefly" style="--fly-x:12%;--fly-y:59%;--fly-speed:5s;--fly-delay:-3s"></i>'+
    '<i class="cozy-firefly" style="--fly-x:82%;--fly-y:46%;--fly-speed:7s;--fly-delay:-1s"></i>'+
    '<i class="cozy-firefly" style="--fly-x:42%;--fly-y:52%;--fly-speed:6s;--fly-delay:-4s"></i></div>';
  function release(){if(activeButton)activeButton.classList.remove('cozy-pressed');activeButton=null;if(pressTimer){clearTimeout(pressTimer);pressTimer=null}}
  function bind(){
    if(installed)return;installed=true;
    ov.addEventListener('pointerdown',function(e){
      var b=e.target.closest&&e.target.closest('button');
      if(!b||!ov.contains(b))return;
      release();activeButton=b;b.classList.add('cozy-pressed');
      pressTimer=setTimeout(release,240);
    },{passive:true});
    ov.addEventListener('pointerup',function(){setTimeout(release,90)},{passive:true});
    ov.addEventListener('pointercancel',release,{passive:true});
    ov.addEventListener('pointerleave',release,{passive:true});
  }
  UI.showMenu=function(){
    var result=originalMenu.apply(this,arguments);
    ov.classList.add('cozy-lodge');
    var lodge=ov.querySelector('.lodge');
    if(lodge){
      ov.insertAdjacentHTML('afterbegin',decoration);
      lodge.setAttribute('aria-label','Главное меню: Рыбалка Клюёт');
      bind();
    }
    return result;
  };
})(window.FZ);

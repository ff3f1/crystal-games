/* Загрузка сгенерированных ассетов. Список лежит в assets/assets.js (его пишет tools/fish_process.py).
   Чего нет — рисуется кодом, так что игра работает и без картинок. */
(function (FZ) {
  "use strict";
  const A = { img: {}, ok: false };
  const M = window.FZ_ASSETS || { images: {}, audio: {}, tuning: {} };
  A.manifest = M;
  A.tuning = M.tuning || {};
  const pending=Object.create(null), bgRecent=[], fishRecent=[], failures=Object.create(null);
  A.failures=failures;
  function bgTouch(key) {
    if(key.indexOf("fishhd/")===0){
      const i=fishRecent.indexOf(key);if(i>=0)fishRecent.splice(i,1);fishRecent.push(key);
      while(fishRecent.length>4)delete A.img[fishRecent.shift()];return;
    }
    if(key.indexOf("bg/")!==0 && key.indexOf("base/")!==0)return;
    const index=bgRecent.indexOf(key);if(index>=0)bgRecent.splice(index,1);
    bgRecent.push(key);
    while(bgRecent.length>3) {
      const old=bgRecent.shift();
      // Keep the active backdrop plus a few previous scenes for quick travel.
      if(old!==key)delete A.img[old];
    }
  }
  // Photo loading is lazy and LRU-bounded. Scene invalidation updates cached
  // reflections as soon as the correct regional image finishes decoding.
  A.ensure=function(key) {
    if(A.img[key]){bgTouch(key);return Promise.resolve(A.img[key]);}
    if(!M.images[key] || (failures[key] && Date.now()-failures[key]<30000))return Promise.resolve(null);
    if(pending[key])return pending[key];
    pending[key]=new Promise(function(resolve) {
      const im=new Image();
      im.onload=function(){
        A.img[key]=im;bgTouch(key);A.version++;
        delete pending[key];resolve(im);
      };
      im.onerror=function(){delete pending[key];failures[key]=Date.now();resolve(null);};
      im.src="assets/"+M.images[key];
    });
    return pending[key];
  };

  A.load = function (onProgress) {
    // Decode the active scene and all small tackle/fish sprites at boot.
    // Do not decode all 80 photographic backdrops at once on low-RAM phones.
    const st=FZ.Game&&FZ.Game.state&&FZ.Game.state();
    const current=(st&&st.loc)||"pond",season=(st&&st.seasonPick)||FZ.U.seasonOf();
    const keys=Object.keys(M.images||{}).filter(function(k){
      return k.indexOf("base/")!==0 && k.indexOf("fish/")!==0 && k.indexOf("fishhd/")!==0 && (k.indexOf("bg/")!==0 || k==="bg/"+current+"_"+season);
    });
    if (!keys.length) { A.ok = true; return Promise.resolve(); }
    let done = 0;
    return Promise.all(keys.map(function (k) {
      return new Promise(function (res) {
        const im = new Image();
        im.onload = function () {
          let out = im;
          const t = (A.tuning.flip || {})[k];
          if (t) { // спрайт смотрит вправо — разворачиваем один раз
            const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
            const g = c.getContext("2d"); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); out = c;
          }
          A.img[k] = out; bgTouch(k); done++; onProgress && onProgress(done / keys.length); res();
        };
        im.onerror = function () { done++; onProgress && onProgress(done / keys.length); res(); };
        im.src = "assets/" + M.images[k];
      });
    })).then(function () { A.ok = true; });
  };

  // Две версии графики: «paint» — сгенерированные картинки, «art» — нарисованная кодом
  A.style = "paint"; A.version = 0;
  A.has = () => Object.keys(A.img).some((k) => k.indexOf("bg/") === 0 || k.indexOf("fish/") === 0);
  A.setStyle = function () { A.style = "paint"; A.version++; };
  const on = () => true;
  A.get = (k) => A.img[k] || null;
  A.backdropKey=(loc,season)=>season!=="winter" && M.images["base/"+loc]?"base/"+loc:"bg/"+loc+"_"+season;
  A.bg=function(loc,season) {
    const key=A.backdropKey(loc,season);
    const im=A.img[key];
    if(im){bgTouch(key);return im;}
    if(on())A.ensure(key);
    return null;
  };
  A.fish = (id) => (on() && A.img["fish/" + id]) || null;
  A.item = (id) => (on() && A.img["items/" + id]) || null;
  A.audio = (k) => (M.audio && M.audio[k] ? "assets/" + M.audio[k] : null);
  // Где у фоновой картинки линия воды (доля высоты), если отличается от стандартной
  A.waterline = (loc, season) => ((A.tuning.waterline || {})[A.backdropKey(loc,season)]) || 0.97;

  FZ.Assets = A;
})(window.FZ);

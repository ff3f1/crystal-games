/* Загрузка сгенерированных ассетов. Список лежит в assets/assets.js (его пишет tools/fish_process.py).
   Чего нет — рисуется кодом, так что игра работает и без картинок. */
(function (FZ) {
  "use strict";
  const A = { img: {}, ok: false };
  const M = window.FZ_ASSETS || { images: {}, audio: {}, tuning: {} };
  A.manifest = M;
  const ATLAS_IDS = ["perch","catfish","palia","brooktrout","sterlet","nelma","muksun","chir","nase","rybets","chekhon","chinook","coho","sockeye","halibut","terpug"];
  // Cut a single compact photographic atlas into individual transparent sprites.
  // One decoded bitmap is shared by all fish; no extra network requests.
  function expandFishAtlas() {
    const img = A.img["fish/realism_atlas"];
    if (!img) return;
    const sw = Math.floor(img.width / 4), sh = Math.floor(img.height / 4);
    ATLAS_IDS.forEach(function(id, i) {
      const c = document.createElement("canvas"); c.width = sw; c.height = sh;
      c.getContext("2d").drawImage(img, (i % 4) * sw, Math.floor(i / 4) * sh, sw, sh, 0, 0, sw, sh);
      A.img["fish/" + id] = c;
    });
  }
  A.tuning = M.tuning || {};
  // Every species must have a raster portrait, including newly added fish.
  // Keep silhouettes generated from the photographic sprite instead of
  // accidentally falling back to the retired vector renderer.
  function expandVariants() {
    FZ.SPECIES.forEach(function (s) {
      if (A.img["fish/" + s.id] || !s.assetAlias) return;
      const src = A.img["fish/" + s.assetAlias];
      if (!src) return;
      const c = document.createElement("canvas"); c.width=src.width; c.height=src.height;
      const g=c.getContext("2d"); g.drawImage(src,0,0);
      if (s.assetTint) {
        g.save();g.globalCompositeOperation="source-atop";g.globalAlpha=.19;
        g.fillStyle=s.assetTint;g.fillRect(0,0,c.width,c.height);g.restore();
      }
      A.img["fish/" + s.id]=c;
    });
  }

  const pending=Object.create(null), bgRecent=[];
  function bgTouch(key) {
    if(key.indexOf("bg/")!==0)return;
    const index=bgRecent.indexOf(key);if(index>=0)bgRecent.splice(index,1);
    bgRecent.push(key);
    while(bgRecent.length>10) {
      const old=bgRecent.shift();
      // Keep the active backdrop plus a few previous scenes for quick travel.
      if(old!==key)delete A.img[old];
    }
  }
  // Photo loading is lazy and LRU-bounded. Scene invalidation updates cached
  // reflections as soon as the correct regional image finishes decoding.
  A.ensure=function(key) {
    if(A.img[key]){bgTouch(key);return Promise.resolve(A.img[key]);}
    if(!M.images[key])return Promise.resolve(null);
    if(pending[key])return pending[key];
    pending[key]=new Promise(function(resolve) {
      const im=new Image();
      im.onload=function(){
        A.img[key]=im;bgTouch(key);A.version++;
        delete pending[key];resolve(im);
      };
      im.onerror=function(){delete pending[key];resolve(null);};
      im.src="assets/"+M.images[key];
    });
    return pending[key];
  };

  A.load = function (onProgress) {
    // Decode the active scene and all small tackle/fish sprites at boot.
    // Do not decode all 80 photographic backdrops at once on low-RAM phones.
    const st=FZ.Game&&FZ.Game.state&&FZ.Game.state();
    const current=(st&&st.loc)||"pond";
    const keys=Object.keys(M.images||{}).filter(function(k){
      return k.indexOf("bg/")!==0 || k.indexOf("bg/"+current+"_")===0;
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
          A.img[k] = out; done++; onProgress && onProgress(done / keys.length); res();
        };
        im.onerror = function () { done++; onProgress && onProgress(done / keys.length); res(); };
        im.src = "assets/" + M.images[k];
      });
    })).then(function () { expandFishAtlas(); expandVariants(); A.ok = true; });
  };

  // Две версии графики: «paint» — сгенерированные картинки, «art» — нарисованная кодом
  A.style = "paint"; A.version = 0;
  A.has = () => Object.keys(A.img).some((k) => k.indexOf("bg/") === 0 || k.indexOf("fish/") === 0);
  A.setStyle = function () { A.style = "paint"; A.version++; };
  const on = () => true;
  A.get = (k) => A.img[k] || null;
  A.bg=function(loc,season) {
    const key="bg/"+loc+"_"+season;
    const im=A.img[key];
    if(im){bgTouch(key);return im;}
    if(on())A.ensure(key);
    return null;
  };
  A.fish = (id) => (on() && (A.img["fish/" + id] || (FZ.SP[id] && A.img["fish/" + FZ.SP[id].assetAlias]))) || null;
  A.item = (id) => (on() && A.img["items/" + id]) || null;
  A.audio = (k) => (M.audio && M.audio[k] ? "assets/" + M.audio[k] : null);
  // Где у фоновой картинки линия воды (доля высоты), если отличается от стандартной
  A.waterline = (loc, season) => ((A.tuning.waterline || {})["bg/" + loc + "_" + season]) || 0.97;

  FZ.Assets = A;
})(window.FZ);

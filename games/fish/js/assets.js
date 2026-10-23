/* Загрузка сгенерированных ассетов. Список лежит в assets/assets.js (его пишет tools/fish_process.py).
   Чего нет — рисуется кодом, так что игра работает и без картинок. */
(function (FZ) {
  "use strict";
  const A = { img: {}, ok: false };
  const M = window.FZ_ASSETS || { images: {}, audio: {}, tuning: {} };
  A.manifest = M;
  A.tuning = M.tuning || {};

  A.load = function (onProgress) {
    const keys = Object.keys(M.images || {});
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
    })).then(function () { A.ok = true; });
  };

  // Две версии графики: «paint» — сгенерированные картинки, «art» — нарисованная кодом
  A.style = "paint"; A.version = 0;
  A.has = () => Object.keys(A.img).some((k) => k.indexOf("bg/") === 0 || k.indexOf("fish/") === 0);
  A.setStyle = function (st) { A.style = st === "art" ? "art" : "paint"; A.version++; };
  const on = () => A.style !== "art";
  A.get = (k) => A.img[k] || null;
  A.bg = (loc, season) => (on() && A.img["bg/" + loc + "_" + season]) || null;
  A.fish = (id) => (on() && A.img["fish/" + id]) || null;
  A.item = (id) => (on() && A.img["items/" + id]) || null;
  A.audio = (k) => (M.audio && M.audio[k] ? "assets/" + M.audio[k] : null);
  // Где у фоновой картинки линия воды (доля высоты), если отличается от стандартной
  A.waterline = (loc, season) => ((A.tuning.waterline || {})["bg/" + loc + "_" + season]) || 0.97;

  FZ.Assets = A;
})(window.FZ);

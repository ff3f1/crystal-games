/* Платформа: настройки, реклама (Яндекс в Android / VK / заглушка), шаринг, ссылки, вибрация */
(function (FZ) {
  "use strict";

  FZ.CONFIG = {
    pkg: "ru.crystalgames.fishing",
    store: "https://www.rustore.ru/catalog/app/ru.crystalgames.fishing",
    youtube: "https://youtube.com/@shpargalka_rybaka",
    title: "Рыбалка: Клюёт!",
    interGap: 90
  };

  const platform = window.AndroidAds ? "android" : (/vk_app_id=/.test(location.search) ? "vk" : "web");
  const AD_TIMEOUT = 30000;
  let bridge = null, busy = false, lastInter = Date.now() - 60e3, seq = 0;
  const pending = Object.create(null);

  // Android вызывает этот callback после показа/закрытия рекламы.
  window.__adResult = function (id, ok) {
    const job = pending[id];
    if (!job) return;
    clearTimeout(job.timer);
    delete pending[id];
    job.resolve(!!ok);
  };

  function androidAd(kind) {
    return new Promise(function (resolve) {
      const id = ++seq;
      const method = kind === "reward" ? "showRewarded" : "showInterstitial";
      const job = { resolve, timer: null };
      pending[id] = job;
      job.timer = setTimeout(function () {
        if (!pending[id]) return;
        delete pending[id];
        resolve(false);
      }, AD_TIMEOUT);
      try {
        if (!window.AndroidAds || typeof window.AndroidAds[method] !== "function") {
          clearTimeout(job.timer);
          delete pending[id];
          resolve(false);
          return;
        }
        window.AndroidAds[method](id);
      } catch (e) {
        clearTimeout(job.timer);
        delete pending[id];
        resolve(false);
      }
    });
  }

  async function show(kind) {
    if (busy) return false;
    busy = true;
    let ok = false;
    try {
      if (FZ.Sound && FZ.Sound.suspend) FZ.Sound.suspend();
      if (platform === "android") {
        ok = await androidAd(kind);
      } else if (platform === "vk") {
        // Не подменяем недоступную VK-рекламу браузерной имитацией.
        if (bridge) {
          const r = await Promise.race([
            bridge.send("VKWebAppShowNativeAds", { ad_format: kind === "reward" ? "reward" : "interstitial" }),
            new Promise((resolve) => setTimeout(() => resolve(null), AD_TIMEOUT))
          ]);
          ok = !!(r && r.result);
        }
      } else {
        const o = document.getElementById("ovAd");
        if (!o) return false;
        o.classList.add("on");
        await new Promise((r) => setTimeout(r, 1200));
        o.classList.remove("on");
        ok = true;
      }
    } catch (e) {
      ok = false;
    } finally {
      busy = false;
      if (FZ.Sound && FZ.Sound.resume) FZ.Sound.resume();
    }
    return ok;
  }

  FZ.Ads = {
    platform,
    init: function () {
      if (platform !== "vk") return;
      const s = document.createElement("script");
      s.src = "vk-bridge.min.js";
      s.onerror = function () {
        const c = document.createElement("script");
        c.src = "https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js";
        c.onload = function () { bridge = window.vkBridge || null; try { if (bridge) bridge.send("VKWebAppInit"); } catch (e) {} };
        document.head.appendChild(c);
      };
      s.onload = function () {
        bridge = window.vkBridge || null;
        try { if (bridge) bridge.send("VKWebAppInit"); } catch (e) {}
      };
      document.head.appendChild(s);
    },
    rewarded: () => show("reward"),
    interstitial: async function (force) {
      if (!force && Date.now() - lastInter < FZ.CONFIG.interGap * 1000) return false;
      const ok = await show("inter");
      if (ok) lastInter = Date.now();
      return ok;
    },
    bridge: () => bridge
  };

  let reviewSeq = 0;
  const reviewPending = Object.create(null);
  window.__reviewResult = function (id, ok) { const done = reviewPending[id]; if (done) { delete reviewPending[id]; done(!!ok); } };

  FZ.Platform = {
    openUrl: function (url) {
      if (!url) return;
      if (window.AndroidShare && window.AndroidShare.openUrl) { window.AndroidShare.openUrl(url); return; }
      if (platform === "vk" && bridge) { try { bridge.send("VKWebAppOpenApp", {}); } catch (e) {} }
      window.open(url, "_blank");
    },
    requestReview: function () {
      if (platform !== "android" || !window.AndroidShare || typeof window.AndroidShare.requestReview !== "function") return Promise.resolve(false);
      return new Promise(function (resolve) {
        const id = ++reviewSeq;
        reviewPending[id] = resolve;
        try { window.AndroidShare.requestReview(id); } catch (e) { delete reviewPending[id]; resolve(false); }
        setTimeout(function () { if (reviewPending[id]) { delete reviewPending[id]; resolve(false); } }, 12000);
      });
    },
    rate: function () {
      if (window.AndroidShare && window.AndroidShare.rate) { window.AndroidShare.rate(); return; }
      FZ.Platform.openUrl(FZ.CONFIG.store);
    },
    shareImage: async function (canvas, text) {
      const url = FZ.CONFIG.store;
      const full = text + "\n" + url;
      let dataUrl = "";
      try { dataUrl = canvas.toDataURL("image/jpeg", 0.9); } catch (e) { dataUrl = ""; }
      if (window.AndroidShare && window.AndroidShare.shareImage && dataUrl) { window.AndroidShare.shareImage(dataUrl.split(",")[1], full); return true; }
      if (platform === "vk" && bridge) {
        try { await bridge.send("VKWebAppShowStoryBox", { background_type: "image", blob: dataUrl, attachment: { text: "go_to", type: "url", url: url } }); return true; }
        catch (e) { try { await bridge.send("VKWebAppShare", { link: url }); return true; } catch (e2) { return false; } }
      }
      try {
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
        if (!blob) return false;
        const file = new File([blob], "ulov.jpg", { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: full }); return true; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ulov.jpg"; document.body.appendChild(a); a.click(); a.remove();
        return true;
      } catch (e) { return false; }
    },
    vibrate: function (ms) {
      if (!FZ.Game || !FZ.Game.settings().vibro) return;
      try { if (window.AndroidShare && window.AndroidShare.vibrate) window.AndroidShare.vibrate(Array.isArray(ms) ? ms[0] : ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
    }
  };
})(window.FZ);

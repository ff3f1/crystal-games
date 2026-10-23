/* Платформа: настройки, реклама (Яндекс в Android / VK / заглушка), шаринг, ссылки, вибрация */
(function (FZ) {
  "use strict";

  // ===== Настройки издателя (меняются здесь) =====
  FZ.CONFIG = {
    pkg: "ru.crystalgames.fishing",
    store: "https://www.rustore.ru/catalog/app/ru.crystalgames.fishing",
    youtube: "",            // ссылка на YouTube-канал (кнопка в настройках появится, когда заполнено)
    title: "Рыбалка: Клюёт!",
    interGap: 150           // секунд между межстраничной рекламой
  };

  const platform = window.AndroidAds ? "android" : (/vk_app_id=/.test(location.search) ? "vk" : "web");
  let bridge = null, busy = false, lastInter = Date.now() - 60e3, seq = 0;
  const pending = {};
  window.__adResult = function (id, ok) { if (pending[id]) { pending[id](!!ok); delete pending[id]; } };

  async function show(kind) {
    if (busy) return false; busy = true; FZ.Sound.suspend(); let ok = false;
    try {
      if (platform === "vk" && bridge) { const r = await bridge.send("VKWebAppShowNativeAds", { ad_format: kind === "reward" ? "reward" : "interstitial" }); ok = !!(r && r.result); }
      else if (platform === "android") {
        ok = await new Promise(function (res) {
          const id = ++seq; pending[id] = res;
          kind === "reward" ? window.AndroidAds.showRewarded(id) : window.AndroidAds.showInterstitial(id);
          setTimeout(function () { if (pending[id]) { pending[id](false); delete pending[id]; } }, 60e3);
        });
      } else { // в браузере — имитация
        const o = document.getElementById("ovAd"); o.classList.add("on");
        await new Promise((r) => setTimeout(r, 1200)); o.classList.remove("on"); ok = true;
      }
    } catch (e) { ok = false; }
    busy = false; FZ.Sound.resume(); return ok;
  }

  FZ.Ads = {
    platform,
    init: function () {
      if (platform !== "vk") return;
      const s = document.createElement("script"); s.src = "vk-bridge.min.js";
      s.onerror = function () { const c = document.createElement("script"); c.src = "https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"; c.onload = s.onload; document.head.appendChild(c); };
      s.onload = function () { bridge = window.vkBridge; try { bridge.send("VKWebAppInit"); } catch (e) {} };
      document.head.appendChild(s);
    },
    rewarded: () => show("reward"),
    interstitial: async function (force) {
      if (!force && Date.now() - lastInter < FZ.CONFIG.interGap * 1000) return false;
      const ok = await show("inter"); if (ok) lastInter = Date.now(); return ok;
    },
    bridge: () => bridge
  };

  // ===== Ссылки и шаринг =====
  FZ.Platform = {
    openUrl: function (url) {
      if (!url) return;
      if (window.AndroidShare && window.AndroidShare.openUrl) { window.AndroidShare.openUrl(url); return; }
      if (platform === "vk" && bridge) { try { bridge.send("VKWebAppOpenApp", {}); } catch (e) {} }
      window.open(url, "_blank");
    },
    rate: function () {
      if (window.AndroidShare && window.AndroidShare.rate) { window.AndroidShare.rate(); return; }
      FZ.Platform.openUrl(FZ.CONFIG.store);
    },
    // Поделиться картинкой (canvas) с подписью
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

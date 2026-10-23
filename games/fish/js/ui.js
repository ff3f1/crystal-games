/* Интерфейс: HUD, меню, водоёмы, снасти, атлас, задания, турнир, карточка улова */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, Wd = FZ.World, $ = U.$;
  const UI = {};
  const ICON = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    map: '<path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5z"/><path d="M6 20h13"/><path d="M9 7h6"/>',
    list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
    cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    cam: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
    share: '<path d="M4 13v6h16v-6M12 3v12M7.5 7.5L12 3l4.5 4.5"/>',
    gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13"/><path d="M12 7c-1.5-3.5-5.5-3-4.5 0M12 7c1.5-3.5 5.5-3 4.5 0"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    fish: '<path d="M3 12c3-4.5 8.5-6 13-2.5L21 6v12l-5-3.5C11.5 18 6 16.5 3 12z"/><circle cx="8" cy="11" r=".8" fill="currentColor"/>',
    wave: '<path d="M2 10c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 16c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11.5 3.5 3.5 0 0 0 7 18z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
    storm: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M12 15l-2 4h3l-2 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    yt: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor"/>',
    ice: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'
  };
  const ic = (n) => '<svg class="i" viewBox="0 0 24 24">' + (ICON[n] || "") + "</svg>";
  UI.ic = ic;
  const skyIc = (sky, night) => ic({ clear: night ? "moon" : "sun", cloudy: "cloud", overcast: "cloud", rain: "rain", storm: "storm", snow: "snow" }[sky]);
  const stars = (n) => '<span class="stars">' + "★".repeat(n) + '<span class="o">' + "★".repeat(5 - n) + "</span></span>";
  const fishImg = (s, w, sil) => '<img alt="" src="' + FZ.Art.fishURL(s, w || 160, sil) + '">';
  const itemImg = (id) => '<img alt="" src="' + FZ.Art.icon(id, 56) + '">';
  const fmtH = (h) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };

  // ---------- Общие слои ----------
  let openOv = null;
  UI.toast = function (text, cls, ms) {
    const t = U.el("div", "toast " + (cls || ""), text);
    $("toast").appendChild(t);
    while ($("toast").children.length > 3) $("toast").firstChild.remove();
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = 0; setTimeout(() => t.remove(), 320); }, ms || 2200);
  };
  UI.sheet = function (html, onClose) {
    const ov = $("ovSheet");
    ov.innerHTML = '<div class="dim"></div><div class="sheet">' + '<button class="x" aria-label="Закрыть">' + ic("x") + "</button>" + html + "</div>";
    ov.classList.add("on"); openOv = ov;
    const close = function () { ov.classList.remove("on"); ov.innerHTML = ""; if (openOv === ov) openOv = null; if (onClose) onClose(); FZ.Sound.click(); };
    ov.querySelector(".dim").onclick = close; ov.querySelector(".x").onclick = close;
    ov._close = close;
    return ov.querySelector(".sheet");
  };
  UI.closeSheet = function () { const ov = $("ovSheet"); if (ov._close && ov.classList.contains("on")) ov._close(); };
  UI.anyOpen = () => document.querySelector(".ov.on") !== null;

  // ---------- HUD ----------
  let hudBuilt = false;
  UI.buildHud = function () {
    $("hud").innerHTML =
      '<div class="topbar">' +
        '<button class="pill round" id="bMenu" aria-label="Меню">' + ic("menu") + "</button>" +
        '<div class="pill" id="hLvlBox"><span class="lvl" id="hLvl">1</span><div class="xp"><i id="hXp"></i></div></div>' +
        '<div class="pill money" id="hMoney"></div><div class="grow"></div>' +
        '<button class="pill" id="hTime"></button>' +
      "</div>" +
      '<div class="locname" id="hLoc"></div>' +
      '<button class="pill round film" id="bFilm" aria-label="Режим съёмки">' + ic("cam") + "</button>" +
      '<div class="echo hide" id="hEcho"></div>' +
      '<div class="hint" id="hHint"></div>' +
      '<div class="tension hide" id="hTens"><canvas id="tensC"></canvas><div class="dist" id="hDist"></div><div class="stam"><i id="hStam"></i></div></div>' +
      '<div class="drag hide" id="hDrag"><span>Фрикцион</span><button id="dUp">+</button><b id="dVal">70%</b><button id="dDn">−</button></div>' +
      '<div class="icedepth hide" id="hIce"><span>верх</span><div class="track" id="iceTrack"><div class="knob" id="iceKnob"></div></div><span id="iceTxt">дно</span></div>' +
      '<div class="tray">' +
        '<button class="tool" id="tRod"><span class="ic" id="tRodIc"></span><span class="cnt" id="tRodTx"></span></button>' +
        '<button class="tool" id="tBait"><span class="ic" id="tBaitIc"></span><span class="cnt" id="tBaitTx"></span></button>' +
        '<button class="act" id="bAct"></button>' +
        '<button class="tool" id="tGb"><span class="ic">' + '<img alt="" src="' + FZ.Art.icon("gb", 56) + '">' + '</span><span class="cnt" id="tGbTx"></span></button>' +
        '<button class="tool" id="tMore"><span class="ic" id="tMoreIc"></span><span class="cnt" id="tMoreTx"></span></button>' +
      "</div>";
    hudBuilt = true;
    $("bMenu").onclick = () => { FZ.Sound.click(); UI.showMenu(); };
    $("hTime").onclick = () => UI.showTime();
    $("bFilm").onclick = () => { document.body.classList.toggle("filming"); if (document.body.classList.contains("filming")) UI.toast("Режим съёмки: интерфейс скрыт. Нажмите на камеру, чтобы вернуть"); };
    $("tRod").onclick = () => UI.showTackle();
    $("tBait").onclick = () => UI.showBait();
    $("tGb").onclick = () => { const r = G.throwGroundbait(); if (r !== true) { UI.toast(r + ". Купите в «Снастях»", "bad"); } else UI.toast("Прикормили точку"); };
    $("tMore").onclick = () => { const s = G.sess(); if (s.ice) { if (G.rig().state !== "fight") G.drill(); } else UI.showTackle(); };
    $("dUp").onclick = () => { G.setDrag(G.state().drag + 0.05); FZ.Sound.click(); };
    $("dDn").onclick = () => { G.setDrag(G.state().drag - 0.05); FZ.Sound.click(); };
    // глубина в лунке
    const tr = $("iceTrack");
    const setFromY = (y) => { const r = tr.getBoundingClientRect(); G.setLure(U.clamp((y - r.top) / r.height, 0.05, 1)); };
    tr.onpointerdown = (e) => { e.stopPropagation(); tr.setPointerCapture(e.pointerId); setFromY(e.clientY); tr.onpointermove = (ev) => setFromY(ev.clientY); };
    tr.onpointerup = () => { tr.onpointermove = null; };
    $("hIce").onpointerdown = (e) => e.stopPropagation();
    // действие
    const act = $("bAct");
    act.onpointerdown = (e) => { e.stopPropagation(); act.setPointerCapture(e.pointerId); act.classList.add("held"); FZ.Input.actionDown(); };
    act.onpointerup = act.onpointercancel = (e) => { e.stopPropagation(); act.classList.remove("held"); FZ.Input.actionUp(); };
    ["tRod", "tBait", "tGb", "tMore", "bMenu", "hTime", "bFilm", "hDrag"].forEach((id) => { $(id).addEventListener("pointerdown", (e) => e.stopPropagation()); });
    UI.refreshTools();
  };

  UI.refreshTools = function () {
    const s = G.sess(); if (!s || !hudBuilt) return;
    const mode = s.mode, g = G.gear(mode), L = G.loadout(mode);
    $("tRodIc").innerHTML = '<img alt="" src="' + FZ.Art.icon(mode === "ice" ? "ice" : mode === "spin" ? "spinner" : mode, 56) + '">';
    $("tRodTx").textContent = g.rod ? FZ.METHODS[mode].n : "Нет снасти";
    if (g.bait) { $("tBaitIc").innerHTML = '<img alt="" src="' + FZ.Art.icon(g.bait.id, 56) + '">'; $("tBaitTx").textContent = g.bait.lure ? g.bait.n : g.bait.n + " ×" + G.baitLeft(g.bait.id); }
    else { $("tBaitIc").innerHTML = ic("drop"); $("tBaitTx").textContent = "Нет наживки"; }
    $("tBait").classList.toggle("off", !g.bait);
    $("tGbTx").textContent = "Корм ×" + (G.state().inv.gb || 0);
    $("tGb").classList.toggle("off", !(G.state().inv.gb > 0));
    if (s.ice) { $("tMoreIc").innerHTML = ic("ice"); $("tMoreTx").textContent = s.hole ? "Новая лунка" : "Бурить"; }
    else { $("tMoreIc").innerHTML = ic("gear"); $("tMoreTx").textContent = mode === "float" ? FZ.DEPTHS[L.depth || "bottom"] : "Настройки"; }
    $("hLoc").textContent = s.loc.n + (s.ice ? ", лёд" : "");
  };

  let hintKey = "", tensDpr = 0;
  UI.frame = function (dt, t) {
    const s = G.sess(); if (!s || !hudBuilt) return;
    const st = G.state(), r = G.rig();
    $("hLvl").textContent = st.lvl;
    $("hXp").style.width = Math.round(st.xp / FZ.xpNeed(st.lvl) * 100) + "%";
    $("hMoney").textContent = U.money(st.money);
    const night = s.period === "night";
    const tk = fmtH(s.hour) + s.wx.sky + night;
    if (UI._tk !== tk) { UI._tk = tk; $("hTime").innerHTML = skyIc(s.wx.sky, night) + fmtH(s.hour); }
    // кнопка действия
    const act = $("bAct");
    let label = "", calm = false, alarm = false;
    const mode = s.mode;
    switch (r.state) {
      case "idle": label = "Заброс"; break;
      case "fly": case "settle": label = "…"; calm = true; break;
      case "wait": label = mode === "spin" ? "Крутить" : mode === "ice" ? "Играть" : "Смотать"; calm = mode !== "spin"; break;
      case "bite": if (r.bite.phase === "take") { label = "Подсечь!"; alarm = true; } else { label = mode === "spin" ? "Крутить" : "Клюёт…"; calm = true; } break;
      case "fight": label = "Тянуть"; break;
      case "landing": case "result": label = "…"; calm = true; break;
      case "nohole": label = "Бурить"; break;
      case "drill": label = "Бурю…"; calm = true; break;
    }
    if (act.textContent !== label) act.textContent = label;
    act.classList.toggle("calm", calm); act.classList.toggle("alarm", alarm);
    // инструменты/натяжение
    const fight = r.state === "fight" || r.state === "landing";
    $("hTens").classList.toggle("hide", !fight);
    $("hDrag").classList.toggle("hide", r.state !== "fight");
    ["tRod", "tBait", "tGb", "tMore"].forEach((id) => $(id).classList.toggle("hide", fight));
    $("hIce").classList.toggle("hide", !(s.ice && s.hole && !fight && r.state !== "drill"));
    if (s.ice && s.hole) { const k = s.hole.lure; $("iceKnob").style.top = k * 100 + "%"; $("iceTxt").textContent = (s.hole.depth * k).toFixed(1).replace(".", ",") + " м"; }
    if (r.state === "fight" && r.fish) UI.drawTension(r.fish, s);
    $("dVal").textContent = Math.round(st.drag * 100) + "%";
    // эхолот
    const echo = $("hEcho");
    if (st.extras.echo && !fight) {
      echo.classList.remove("hide");
      if (s.ice) echo.innerHTML = s.hole ? "Глубина <b>" + s.hole.depth.toFixed(1).replace(".", ",") + " м</b><br>Рыба: <b>" + (s.hole.fish > 1.1 ? "много" : s.hole.fish > 0.6 ? "есть" : "мало") + "</b>" : "Эхолот готов";
      else { const p = G.sess().lastAim || { X: 0, Z: 10 }; const tbl = r.state === "wait" ? G.biteTable() : null; let tot = 0; if (tbl) tbl.forEach((x) => (tot += x[1])); echo.innerHTML = "Глубина <b>" + G.depthAt(p.X, p.Z).toFixed(1).replace(".", ",") + " м</b>" + (tbl ? "<br>Активность: <b>" + (tot > 0.15 ? "высокая" : tot > 0.07 ? "средняя" : "низкая") + "</b>" : ""); }
    } else echo.classList.add("hide");
    UI.hint(s, r, st, t);
  };

  UI.hint = function (s, r, st, t) {
    let h = "", cls = "";
    const mode = s.mode;
    if (s.noIceRod && !st.load.ice.rod) h = "Для зимней рыбалки нужна зимняя удочка<small>Купите её в меню «Снасти» — она недорогая</small>";
    else if (r.state === "idle") {
      const ok = G.canFish();
      if (ok !== true) h = ok + "<small>Откройте «Снасти» в меню</small>";
      else if (st.tut === 0) h = "Коснитесь воды и отпустите — это заброс<small>Чем выше на экране, тем дальше</small>";
      else if (r.idleHint > 6) h = "Коснитесь воды, чтобы забросить";
    } else if (r.state === "nohole") h = "Пробурите лунку<small>Кнопка «Бурить» внизу</small>";
    else if (r.state === "wait") {
      const since = s.t - (r.castAt || 0);
      if (mode === "spin") h = since < 5 ? "Держите палец — проводка<small>Отпустите — приманка остановится. Хищник бьёт на проводке</small>" : "";
      else if (!G.gear(mode).bait || !G.baitLeft(G.gear(mode).bait.id)) h = "Нет наживки<small>Купите в «Снастях» или получите за рекламу на кнопке наживки</small>";
      else if (mode === "ice") h = since < 6 ? "Тапайте по экрану — играйте мормышкой<small>Следите за кивком: опустился или поднялся — подсекайте</small>" : "";
      else if (since < 5) h = mode === "feeder" ? "Ждём поклёвку<small>Следите за вершинкой и колокольчиком</small>" : (st.tut < 3 ? "Ждём поклёвку<small>Поплавок утонул или лёг набок — подсекайте</small>" : "Ждём поклёвку");
    } else if (r.state === "bite" && r.bite.phase === "take") { h = "Подсекай!<small>смахните вверх или нажмите кнопку</small>"; cls = "strike"; }
    else if (r.state === "fight" && r.fish) {
      const f = r.fish;
      if (f.tension > st.drag * 0.98 || f.tension > 0.86) h = "Отпустите! Леска на пределе";
      else if (f.slackT > 0.5) h = "Подматывайте — леска провисла!";
      else if (st.tut < 3) h = "Держите палец — подматывайте<small>Отпускайте, когда рыба рвётся</small>";
      else if (!s.ice && f.phase === "run" && !f.against && Math.abs(f.vx) > 0.6) h = "Ведите палец в другую сторону";
      else if (f.phase === "tired") h = "Рыба устала — подтягивайте!";
    }
    const key = h + cls;
    if (key !== hintKey) { hintKey = key; const e = $("hHint"); e.innerHTML = h; e.className = "hint " + cls; }
  };

  UI.drawTension = function (f, s) {
    const c = $("tensC"); const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (tensDpr !== dpr) { c.width = 230 * dpr; c.height = 118 * dpr; tensDpr = dpr; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 230, 118);
    const cx = 115, cy = 108, R = 92, a0 = Math.PI * 1.08, a1 = Math.PI * 1.92;
    const v = U.clamp(f.tension || 0, 0, 1.05), dm = G.state().drag;
    g.lineCap = "round";
    g.strokeStyle = "rgba(10,36,40,0.8)"; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    const col = v < 0.6 ? "#7ccf6a" : v < 0.85 ? "#f2c21a" : "#ff4416";
    g.strokeStyle = col; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * Math.min(1, v)); g.stroke();
    const ad = a0 + (a1 - a0) * dm;
    g.strokeStyle = "#eef3f1"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + Math.cos(ad) * (R - 13), cy + Math.sin(ad) * (R - 13)); g.lineTo(cx + Math.cos(ad) * (R + 13), cy + Math.sin(ad) * (R + 13)); g.stroke();
    g.fillStyle = "#eef3f1"; g.font = "700 11px Rubik,sans-serif"; g.textAlign = "center"; g.fillText("натяжение", cx, cy - 46);
    $("hDist").textContent = s.ice ? "глубина " + Math.max(0, f.D).toFixed(1).replace(".", ",") + " м" : (f.Z - 3).toFixed(1).replace(".", ",") + " м";
    $("hStam").style.width = Math.round(f.S * 100) + "%";
  };

  // ---------- События игры ----------
  UI.onEvent = function (e) {
    const s = G.sess();
    switch (e.type) {
      case "msg": UI.toast(e.text, e.bad ? "bad" : ""); break;
      case "need": UI.toast(e.what, "bad"); break;
      case "cast": G.rig().castAt = s.t; if (G.state().tut === 0) { G.state().tut = 1; } break;
      case "take": if (G.state().tut === 1) G.state().tut = 2; break;
      case "hooked": if (e.big) UI.toast("Крупная рыба! Не перетяните", "gold"); break;
      case "jump": UI.toast("Свечка! Ослабьте натяжение", "gold", 1400); break;
      case "level": FZ.Sound.level(); UI.toast("Уровень " + e.lvl + "! Бонус " + U.money(e.bonus), "gold", 3000); UI.unlocks(e.lvl); break;
      case "quest": UI.toast("Задание выполнено: " + e.q.text + ". Заберите награду в меню", "gold", 3200); break;
      case "catch": UI.showCatch(e.res); break;
      case "lost": UI.onLost(e); break;
      case "gear": case "money": UI.refreshTools(); break;
      case "hole": G.rig().castAt = s.t; UI.toast("Лунка готова, глубина " + e.depth.toFixed(1).replace(".", ",") + " м"); UI.refreshTools(); break;
      case "time": UI.ambience(); break;
      case "session": UI.refreshTools(); UI.ambience(); break;
      case "revived": UI.toast("Рыба снова на крючке!", "gold"); break;
    }
  };
  UI.ambience = function () {
    const s = G.sess(); if (!s) return;
    FZ.Sound.updateAmbience({ mode: s.mode, period: s.period, season: s.season, wind: s.wx.wind, sky: s.wx.sky, style: s.loc.style });
    FZ.Sound.playMusic(s.ice ? "winter" : s.period === "night" ? "night" : s.season);
  };
  UI.unlocks = function (lvl) {
    const items = [];
    FZ.LOCATIONS.forEach((l) => { if (l.lvl === lvl) items.push("водоём «" + l.n + "»"); });
    FZ.RODS.forEach((r) => { if (r.lvl === lvl) items.push(r.n); });
    FZ.BAITS.forEach((b) => { if (b.lvl === lvl && lvl > 1) items.push(b.n.toLowerCase()); });
    if (items.length) setTimeout(() => UI.toast("Открыто: " + items.slice(0, 3).join(", "), "gold", 3600), 900);
  };

  // ---------- Главное меню ----------
  UI.showMenu = function () {
    const st = G.state(), s = G.sess();
    const ov = $("ovMenu");
    const wx = s.wx, tour = Wd.tournament();
    const qDone = st.daily.quests.filter((q) => q.done && !q.claimed).length + (G.giftAvailable() ? 1 : 0);
    const tourBadge = st.daily.tour ? tour.tiers.filter((t2) => st.daily.tour.w >= t2.w && st.daily.tourClaim.indexOf(t2.id) < 0).length : 0;
    const d = new Date(); const wd = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"][d.getDay()];
    ov.innerHTML = '<div class="shade"></div>' +
      '<div class="logo"><div class="w1">Рыбалка</div><div class="w2">Клюёт!<i></i></div></div>' +
      '<div class="menu-bottom">' +
        '<button class="today" id="mToday"><div class="wx">' + skyIc(wx.sky, s.period === "night") + '</div><div style="text-align:left"><div class="t">' + wd + ", " + U.dateRu(d) + ". " + FZ.SEASONS[s.season] + "</div>" +
        '<div class="d">' + s.loc.n + ": клёв " + stars(wx.score) + "<br>" + Wd.tip(wx) + "</div></div></button>" +
        '<button class="go" id="mGo">Рыбачить<small>' + s.loc.n + "</small></button>" +
        '<div class="grid">' +
          '<button class="tile" id="mMap">' + ic("map") + "Водоёмы</button>" +
          '<button class="tile" id="mShop">' + ic("bag") + "Снасти</button>" +
          '<button class="tile" id="mAtlas">' + ic("book") + "Атлас рыб</button>" +
          '<button class="tile" id="mQuests">' + ic("list") + "Задания" + (qDone ? '<span class="badge">' + qDone + "</span>" : "") + "</button>" +
          '<button class="tile" id="mTour">' + ic("cup") + "Турнир дня" + (tourBadge ? '<span class="badge">' + tourBadge + "</span>" : "") + "</button>" +
          '<button class="tile" id="mSet">' + ic("gear") + "Настройки</button>" +
        "</div></div>";
    ov.classList.add("on");
    $("hud").classList.add("hide");
    const close = () => { ov.classList.remove("on"); $("hud").classList.remove("hide"); };
    $("mGo").onclick = () => { FZ.Sound.unlock(); FZ.Sound.click(); close(); UI.ambience(); if (G.giftAvailable() && G.state().tut >= 3) setTimeout(UI.showGift, 400); };
    $("mToday").onclick = () => UI.showForecast();
    $("mMap").onclick = () => UI.showMap();
    $("mShop").onclick = () => UI.showShop();
    $("mAtlas").onclick = () => UI.showAtlas();
    $("mQuests").onclick = () => UI.showQuests();
    $("mTour").onclick = () => UI.showTour();
    $("mSet").onclick = () => UI.showSettings();
    UI.menuOpen = true;
    UI.closeMenu = () => { close(); UI.menuOpen = false; };
  };

  // ---------- Водоёмы ----------
  UI.showMap = function (seasonTab) {
    const st = G.state();
    const real = U.seasonOf();
    let season = seasonTab || G.season();
    const draw = function () {
      let html = "<h2>Водоёмы</h2><div class=\"sub\">Сезон выбирайте сами: сейчас за окном " + FZ.SEASONS[real].toLowerCase() + "</div>" +
        '<div class="seg" id="mpSeason">' + FZ.SEASON_ORDER.map((x) => '<button data-s="' + x + '" class="' + (x === season ? "on" : "") + '">' + FZ.SEASONS[x] + "</button>").join("") + "</div>" +
        '<div class="scroll">';
      FZ.LOCATIONS.forEach(function (l) {
        const lock = st.lvl < l.lvl;
        const wx = Wd.weather(l.id, season);
        const bit = Wd.biters(l, season, wx).slice(0, 4).map((x) => x.n.toLowerCase());
        const here = G.sess() && G.sess().loc.id === l.id && G.sess().season === season;
        html += '<div class="row ' + (lock ? "locked" : "") + '"><div class="pic" style="background:' + locColor(l, season) + '"><img alt="" src="' + FZ.Scene.thumb(l, season) + '">' + (lock ? '<span class="lk">' + ic("lock") + "</span>" : "") + "</div>" +
          '<div class="body"><div class="t">' + l.n + "</div><div class=\"d\">" + l.reg + ". " + l.desc + "</div>" +
          '<div class="d">Клёв ' + stars(wx.score) + (bit.length ? "<br>Клюёт: " + bit.join(", ") : "") + (l.fee ? "<br>Путёвка " + U.money(l.fee) : "") + "</div></div>" +
          (lock ? '<span class="btn small ghost">с ' + l.lvl + " ур.</span>" : here ? '<span class="btn small ghost">Вы здесь</span>' : '<button class="btn small red" data-go="' + l.id + '">Ехать</button>') + "</div>";
      });
      html += "</div>";
      const sh = UI.sheet(html);
      sh.querySelectorAll("#mpSeason button").forEach((b) => (b.onclick = () => { season = b.dataset.s; FZ.Sound.click(); draw(); }));
      sh.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => UI.travel(b.dataset.go, season)));
    };
    draw();
  };
  function locColor(l, season) {
    const base = { pond: "#3e6a4a", river: "#3e5e6e", platnik: "#4a6a3e", reservoir: "#3a5a7a", lake: "#3a5070", delta: "#5a6a3e", baikal: "#2e5a7a", taiga: "#2e4a3e" }[l.style];
    return season === "winter" ? U.mix(base, "#c8d6e4", 0.45) : season === "autumn" ? U.mix(base, "#a86a2a", 0.3) : base;
  }
  UI.travel = async function (locId, season) {
    const st = G.state(), l = FZ.LOC[locId];
    if (l.fee) { if (st.money < l.fee) { UI.toast("Не хватает на путёвку: " + U.money(l.fee), "bad"); return; } st.money -= l.fee; }
    UI.closeSheet();
    await FZ.Ads.interstitial();
    G.startSession(locId, season === U.seasonOf() ? null : season);
    FZ.Scene.clearFx();
    if (UI.closeMenu) UI.closeMenu();
    UI.toast(l.n + ", " + FZ.SEASONS[G.sess().season].toLowerCase());
    if (G.sess().ice && !st.load.ice.rod) setTimeout(() => UI.toast("Нужна зимняя удочка — загляните в «Снасти»", "bad", 3500), 600);
  };

  // ---------- Снасти (магазин) ----------
  let shopTab = "rod";
  UI.showShop = function (tab) {
    if (tab) shopTab = tab;
    const st = G.state();
    const TABS = [["rod", "Удилища"], ["line", "Леска"], ["hook", "Крючки"], ["bait", "Наживка"], ["lure", "Приманки"], ["extra", "Разное"]];
    const priceBtn = function (kind, id, item, own) {
      if (own) return '<span class="btn small ghost">Есть</span>';
      if (st.lvl < (item.lvl || 1)) return '<span class="btn small ghost">с ' + item.lvl + " ур.</span>";
      return '<button class="btn small brass" data-buy="' + kind + ":" + id + '"' + (st.money < item.price ? " disabled" : "") + ">" + (item.price ? U.money(item.price) : "Бесплатно") + "</button>";
    };
    const likers = function (bid) {
      const arr = FZ.SPECIES.filter((s) => (s.baits[bid] || 0) >= 1.1).sort((a, b) => b.baits[bid] - a.baits[bid]).slice(0, 4).map((s) => s.n.toLowerCase());
      return arr.length ? "Любят: " + arr.join(", ") : "";
    };
    let html = "<h2>Снасти</h2><div class=\"sub\">Деньги: " + U.money(st.money) + "</div><div class=\"tabs\">" + TABS.map((t) => '<button class="tab ' + (t[0] === shopTab ? "on" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>").join("") + '</div><div class="scroll">';
    if (shopTab === "rod") {
      ["float", "feeder", "spin", "ice"].forEach(function (type) {
        html += "<h3>" + { float: "Поплавочные", feeder: "Фидеры и донки", spin: "Спиннинги", ice: "Зимние удочки" }[type] + "</h3>";
        FZ.RODS.filter((r) => r.type === type).forEach(function (r) {
          const own = G.owned("rod", r.id);
          const d = (r.cast ? "Заброс до " + r.cast + " м, " : "") + "держит рыбу до " + String(r.power).replace(".", ",") + " кг, чувствительность ×" + String(r.sens).replace(".", ",") + (type === "spin" && r.id === "s1" ? ". Вертушка в подарок" : "");
          const using = st.load[type].rod === r.id;
          html += '<div class="row"><div class="pic">' + itemImg(type === "spin" ? "spinner" : type) + '</div><div class="body"><div class="t">' + r.n + '</div><div class="d">' + d + "</div></div>" +
            (own ? (using ? '<span class="btn small ghost">В руках</span>' : '<button class="btn small" data-use="' + r.id + '">Взять</button>') : priceBtn("rod", r.id, r, false)) + "</div>";
        });
      });
    } else if (shopTab === "line") {
      FZ.LINES.forEach(function (l) {
        html += '<div class="row"><div class="pic">' + itemImg("line") + '</div><div class="body"><div class="t">' + l.n + '</div><div class="d">Выдерживает ' + String(l.test).replace(".", ",") + " кг. Заметность для рыбы: " + ["почти незаметна", "низкая", "средняя", "заметная", "высокая", "очень высокая"][l.vis] + "</div></div>" + priceBtn("line", l.id, l, G.owned("line", l.id)) + "</div>";
      });
      html += '<div class="sub" style="margin-top:10px">Толще леска — крупнее рыба, но осторожная мирная рыба клюёт реже. Купленная леска ставится на снасть автоматически, сменить можно в «Снасти» на берегу.</div>';
    } else if (shopTab === "hook") {
      FZ.HOOKS.forEach(function (h) { html += '<div class="row"><div class="pic">' + itemImg("hook") + '</div><div class="body"><div class="t">' + h.n + '</div><div class="d">' + h.note + "</div></div>" + priceBtn("hook", h.id, h, G.owned("hook", h.id)) + "</div>"; });
    } else if (shopTab === "bait") {
      FZ.BAITS.filter((b) => !b.lure).forEach(function (b) {
        html += '<div class="row"><div class="pic">' + itemImg(b.id) + '</div><div class="body"><div class="t">' + b.n + ' <span style="color:var(--muted);font-weight:500">у вас ' + (st.inv[b.id] || 0) + '</span></div><div class="d">' + b.pack + " шт. " + likers(b.id) + "</div></div>" + priceBtn("bait", b.id, b, false) + "</div>";
      });
      html += '<div class="row"><div class="pic">' + itemImg("gb") + '</div><div class="body"><div class="t">Прикормка <span style="color:var(--muted);font-weight:500">у вас ' + (st.inv.gb || 0) + '</span></div><div class="d">5 порций. Собирает мирную рыбу в точку, а фидер подкармливает её с каждым забросом</div></div>' + priceBtn("gb", "gb", FZ.GROUNDBAIT, false) + "</div>";
    } else if (shopTab === "lure") {
      FZ.BAITS.filter((b) => b.lure).forEach(function (b) {
        const n = st.lures[b.id] || 0;
        html += '<div class="row"><div class="pic">' + itemImg(b.id) + '</div><div class="body"><div class="t">' + b.n + (n ? ' <span style="color:var(--muted);font-weight:500">у вас ' + n + "</span>" : "") + '</div><div class="d">' + (b.m[0] === "ice" ? "Для зимней удочки. " : "Для спиннинга. ") + likers(b.id) + "</div></div>" + priceBtn("bait", b.id, b, false) + "</div>";
      });
      html += '<div class="sub" style="margin-top:10px">Приманка служит долго, но при обрыве лески теряется.</div>';
    } else {
      Object.keys(FZ.EXTRAS).forEach(function (id) { const x = FZ.EXTRAS[id]; html += '<div class="row"><div class="pic">' + ic(id === "echo" ? "wave" : id === "gaff" ? "fish" : "ice") + '</div><div class="body"><div class="t">' + x.n + '</div><div class="d">' + x.note + "</div></div>" + priceBtn("extra", id, x, G.owned("extra", id)) + "</div>"; });
    }
    html += "</div>";
    const sh = UI.sheet(html, () => UI.refreshTools());
    const sc = sh.querySelector(".scroll"); if (UI._shopScroll && UI._shopScroll[0] === shopTab) sc.scrollTop = UI._shopScroll[1];
    sh.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { shopTab = b.dataset.tab; FZ.Sound.click(); UI._shopScroll = null; UI.showShop(); }));
    sh.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = function () {
      const p = b.dataset.buy.split(":");
      const r = G.buy(p[0], p[1]);
      if (r === true) { FZ.Sound.coin(); UI.toast("Куплено", "gold", 1200); UI._shopScroll = [shopTab, sc.scrollTop]; UI.showShop(); }
      else UI.toast("Нельзя купить: " + r, "bad");
    }));
    sh.querySelectorAll("[data-use]").forEach((b) => (b.onclick = function () {
      const r = FZ.ROD[b.dataset.use]; G.equip(r.type, "rod", r.id); if (r.type !== "ice") G.setActive(r.type);
      FZ.Sound.click(); UI._shopScroll = [shopTab, sc.scrollTop]; UI.showShop(); UI.refreshTools();
    }));
  };

  // ---------- Снасть на берегу ----------
  UI.showTackle = function () {
    const s = G.sess(), st = G.state();
    const mode = s.mode;
    const L = st.load[mode];
    let html = "<h2>Снасть</h2><div class=\"sub\">" + s.loc.n + "</div><div class=\"scroll picker\">";
    if (!s.ice) {
      html += '<div class="seg" id="tkMode">' + ["float", "feeder", "spin"].map((m) => '<button data-m="' + m + '" class="' + (m === mode ? "on" : "") + '"' + (st.load[m].rod ? "" : " disabled") + ">" + FZ.METHODS[m].n + "</button>").join("") + "</div>";
    }
    const rods = st.rods.filter((id) => FZ.ROD[id].type === mode);
    html += "<h3>Удилище</h3>" + (rods.length ? rods.map((id) => '<div class="row ' + (L.rod === id ? "sel" : "") + '" data-rod="' + id + '"><div class="body"><div class="t">' + FZ.ROD[id].n + '</div><div class="d">держит до ' + String(FZ.ROD[id].power).replace(".", ",") + " кг" + (FZ.ROD[id].cast ? ", заброс до " + FZ.ROD[id].cast + " м" : "") + "</div></div></div>").join("") : '<div class="d">Нет удилища — купите в «Снастях»</div>');
    html += "<h3>Леска</h3>" + st.lines.map((id) => '<div class="row ' + (L.line === id ? "sel" : "") + '" data-line="' + id + '"><div class="body"><div class="t">' + FZ.LINE[id].n + '</div><div class="d">выдерживает ' + String(FZ.LINE[id].test).replace(".", ",") + " кг</div></div></div>").join("");
    if (mode !== "spin") html += "<h3>Крючок</h3>" + st.hooks.map((id) => '<div class="row ' + ((L.hook || "h2") === id ? "sel" : "") + '" data-hook="' + id + '"><div class="body"><div class="t">' + FZ.HOOK[id].n + '</div><div class="d">' + FZ.HOOK[id].note + "</div></div></div>").join("");
    if (mode === "float") html += "<h3>Глубина спуска</h3><div class=\"seg\" id=\"tkDepth\">" + ["top", "mid", "bottom"].map((d) => '<button data-d="' + d + '" class="' + ((L.depth || "bottom") === d ? "on" : "") + '">' + FZ.DEPTHS[d] + "</button>").join("") + "</div>";
    html += "<h3>Фрикцион</h3><div class=\"seg\" id=\"tkDrag\">" + [[0.5, "Слабый"], [0.7, "Средний"], [0.85, "Тугой"]].map((d) => '<button data-v="' + d[0] + '" class="' + (Math.abs(st.drag - d[0]) < 0.08 ? "on" : "") + '">' + d[1] + "</button>").join("") + "</div>" +
      '<div class="d" style="color:var(--muted);font-size:12.5px">Слабый фрикцион отдаёт леску раньше — обрыв реже, но вываживание дольше.</div>' +
      '<div style="margin-top:14px"><button class="btn" id="tkShop" style="width:100%">Купить снасти</button></div></div>';
    const sh = UI.sheet(html, () => UI.refreshTools());
    const re = () => { UI.closeSheet(); UI.showTackle(); };
    sh.querySelectorAll("#tkMode button").forEach((b) => (b.onclick = () => { G.setActive(b.dataset.m); FZ.Sound.click(); re(); }));
    sh.querySelectorAll("[data-rod]").forEach((b) => (b.onclick = () => { G.equip(mode, "rod", b.dataset.rod); re(); }));
    sh.querySelectorAll("[data-line]").forEach((b) => (b.onclick = () => { G.equip(mode, "line", b.dataset.line); re(); }));
    sh.querySelectorAll("[data-hook]").forEach((b) => (b.onclick = () => { G.equip(mode, "hook", b.dataset.hook); re(); }));
    sh.querySelectorAll("#tkDepth button").forEach((b) => (b.onclick = () => { G.setDepth(b.dataset.d); re(); }));
    sh.querySelectorAll("#tkDrag button").forEach((b) => (b.onclick = () => { G.setDrag(+b.dataset.v); re(); }));
    $("tkShop").onclick = () => { UI.closeSheet(); UI.showShop(mode === "spin" ? "lure" : "rod"); };
  };

  UI.showBait = function () {
    const s = G.sess(), mode = s.mode, L = G.loadout(mode);
    const list = FZ.BAITS.filter((b) => b.m.indexOf(mode) >= 0);
    const here = Object.keys(s.loc.fish);
    let html = "<h2>" + (mode === "spin" ? "Приманка" : "Наживка") + "</h2><div class=\"sub\">Что любит рыба на водоёме «" + s.loc.n + "»</div><div class=\"scroll picker\">";
    list.forEach(function (b) {
      const n = G.baitLeft(b.id);
      const fans = here.map((id) => FZ.SP[id]).filter((sp) => (sp.baits[b.id] || 0) >= 1 && (sp.methods[mode] || 0) > 0.3 && sp.season[s.season] > 0.3).map((sp) => sp.n.toLowerCase());
      html += '<div class="row ' + (L.bait === b.id ? "sel" : "") + (n ? "" : " locked") + '" data-b="' + b.id + '"><div class="pic">' + itemImg(b.id) + '</div><div class="body"><div class="t">' + b.n + ' <span style="color:var(--muted);font-weight:500">' + (b.lure ? (n ? "есть" : "нет") : n + " шт.") + '</span></div><div class="d">' + (fans.length ? "Здесь клюют: " + fans.slice(0, 5).join(", ") : "Здесь на неё почти не клюёт") + "</div></div></div>";
    });
    html += '</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="bpShop" style="flex:1">Купить</button><button class="btn brass" id="bpAd" style="flex:1"><span class="adtag">реклама</span> Червь ×15</button></div>';
    const sh = UI.sheet(html, () => UI.refreshTools());
    sh.querySelectorAll("[data-b]").forEach((r) => (r.onclick = () => { if (!G.baitLeft(r.dataset.b)) { UI.toast("Нет в наличии — купите в «Снастях»", "bad"); return; } G.setBait(r.dataset.b); FZ.Sound.click(); UI.closeSheet(); }));
    $("bpShop").onclick = () => { UI.closeSheet(); UI.showShop(mode === "spin" || FZ.BAITS.some((b) => b.lure && b.m[0] === mode && L.bait === b.id) ? "lure" : "bait"); };
    $("bpAd").onclick = async () => { const ok = await FZ.Ads.rewarded(); if (ok) { G.state().inv.worm = (G.state().inv.worm || 0) + 15; if (!G.loadout().bait && mode !== "spin") G.setBait("worm"); G.save(true); UI.toast("+15 червей", "gold"); UI.closeSheet(); } else UI.toast("Реклама сейчас недоступна", "bad"); };
    if (mode === "spin") $("bpAd").classList.add("hide");
  };

  UI.showTime = function () {
    const s = G.sess(); const st2 = FZ.Scene.sunTimes(s.season); const wx = s.wx;
    const rows = [["dawn", "Рассвет", "Зорька — лучший клёв мирной рыбы", "sun", st2[0] + 0.4], ["day", "День", "Хищник активен, мирная рыба уходит глубже", "sun", (st2[0] + st2[1]) / 2 - 1], ["dusk", "Вечер", "Вечерняя зорька: оживает всё живое", "cloud", st2[1] - 1], ["night", "Ночь", "Время сома, налима, леща и судака", "moon", (st2[1] + 2.5) % 24]];
    let html = "<h2>Погода и время</h2><div class=\"sub\">" + s.loc.n + ", " + U.dateRu() + "</div><div class=\"scroll picker\">" +
      '<div class="today" style="background:rgba(255,255,255,.05)"><div class="wx">' + skyIc(wx.sky, s.period === "night") + '</div><div><div class="t">' + Wd.skyName(wx.sky) + ", " + (wx.temp > 0 ? "+" : "") + wx.temp + "°, клёв " + stars(wx.score) + "</div>" +
      '<div class="d">Давление ' + wx.pressure + " мм, " + Wd.trendName(wx.trend) + ". Ветер " + wx.dirFull + ", " + wx.wind + " м/с<br>" + Wd.tip(wx) + '</div></div></div><button class="btn ghost small" id="tmFc" style="margin:8px 0 4px">Кто сегодня клюёт</button>' +
      "<h3>Подождать до… Сейчас " + fmtH(s.hour) + ", игровой час идёт чуть больше минуты</h3>" +
      rows.map((r) => '<div class="row ' + (s.period === r[0] ? "sel" : "") + '" data-p="' + r[0] + '"><div class="pic">' + ic(r[3]) + '</div><div class="body"><div class="t">' + r[1] + " <span style=\"color:var(--muted);font-weight:500\">" + fmtH(r[4]) + '</span></div><div class="d">' + r[2] + "</div></div></div>").join("") + "</div>";
    const sh = UI.sheet(html);
    sh.querySelectorAll("[data-p]").forEach((r) => (r.onclick = () => { if (G.rig().state === "fight") return; G.skipTo(r.dataset.p); UI.closeSheet(); UI.toast("Ждём: " + FZ.TIMES[r.dataset.p].toLowerCase()); }));
    sh.querySelector("#tmFc").onclick = () => { UI.closeSheet(); UI.showForecast(); };
  };

  UI.showForecast = function () {
    const s = G.sess(), wx = s.wx;
    const bit = Wd.biters(s.loc, s.season, wx).slice(0, 6);
    let html = "<h2>Прогноз клёва</h2><div class=\"sub\">" + s.loc.n + ", " + U.dateRu() + "</div><div class=\"scroll\">" +
      '<div class="today" style="background:rgba(255,255,255,.05)"><div class="wx">' + skyIc(wx.sky, s.period === "night") + '</div><div><div class="t">' + Wd.skyName(wx.sky) + ", " + (wx.temp > 0 ? "+" : "") + wx.temp + "°</div>" +
      '<div class="d">Давление ' + wx.pressure + " мм, " + Wd.trendName(wx.trend) + "<br>Ветер " + wx.dirFull + ", " + wx.wind + " м/с</div></div></div>" +
      '<div class="row"><div class="body"><div class="t">Клёв ' + stars(wx.score) + '</div><div class="d">' + Wd.tip(wx) + "</div></div></div><h3>Кто клюёт</h3>" +
      bit.map((sp) => '<div class="row"><div class="pic">' + fishImg(sp, 120, !G.state().caught[sp.id]) + '</div><div class="body"><div class="t">' + (G.state().caught[sp.id] ? sp.n : sp.n) + '</div><div class="d">Лучшие наживки: ' + FZ.bestBaits(sp).join(", ").toLowerCase() + "</div></div></div>").join("") + "</div>";
    UI.sheet(html);
  };

  // ---------- Атлас ----------
  UI.showAtlas = function () {
    const st = G.state();
    const got = FZ.SPECIES.filter((s) => st.caught[s.id]).length;
    let html = "<h2>Атлас рыб</h2><div class=\"sub\">Поймано видов: " + got + " из " + FZ.SPECIES.length + "</div><div class=\"scroll\"><div class=\"agrid\">";
    FZ.SPECIES.forEach(function (s) {
      const c = st.caught[s.id] || 0;
      html += '<button class="acard" data-sp="' + s.id + '"><i style="background:' + FZ.RARITY[s.rar].c + '"></i>' + fishImg(s, 140, !c) + '<div class="n">' + (c ? s.n : "?") + '</div><div class="c">' + (c ? (st.records[s.id] ? U.kg(st.records[s.id].w) : "") : "не поймана") + "</div></button>";
    });
    html += "</div></div>";
    const sh = UI.sheet(html);
    sh.querySelectorAll("[data-sp]").forEach((b) => (b.onclick = () => UI.showSpecies(b.dataset.sp)));
  };
  UI.showSpecies = function (id) {
    const s = FZ.SP[id], st = G.state(), c = st.caught[id] || 0, rec = st.records[id];
    const where = FZ.whereLives(id).map((l) => FZ.LOC[l].n);
    const bestTime = Object.keys(s.time).sort((a, b) => s.time[b] - s.time[a])[0];
    const bestSeason = Object.keys(s.season).sort((a, b) => s.season[b] - s.season[a])[0];
    const methods = Object.keys(s.methods).filter((m) => s.methods[m] >= 0.8).map((m) => FZ.METHODS[m].n.toLowerCase());
    let html = '<div class="detail"><h2>' + (c ? s.n : "Неизвестная рыба") + '</h2><div class="sub" style="font-style:italic">' + (c ? s.lat : "Поймайте, чтобы узнать больше") + '</div><div class="scroll">' +
      '<img class="big" alt="" src="' + FZ.Art.fishURL(s, 320, !c) + '">' +
      '<div class="facts"><span>Редкость</span><b style="color:' + FZ.RARITY[s.rar].c + '">' + FZ.RARITY[s.rar].n + "</b>" +
      "<span>Где ловится</span><b>" + where.join(", ") + "</b>" +
      (c ? "<span>Наживки</span><b>" + FZ.bestBaits(s).join(", ") + "</b><span>Снасти</span><b>" + methods.join(", ") + "</b><span>Лучшее время</span><b>" + FZ.TIMES[bestTime].toLowerCase() + ", " + FZ.SEASONS[bestSeason].toLowerCase() + "</b>" : "") +
      "<span>Трофей</span><b>от " + U.kg(s.trophy) + "</b>" +
      (rec ? "<span>Ваш рекорд</span><b>" + U.kg(rec.w) + ", " + rec.len + " см</b><span>Поймано</span><b>" + c + "</b>" : "") +
      (s.release ? "<span>Правило</span><b style=\"color:var(--ok)\">только отпустить (" + s.release + ")</b>" : "") +
      "</div>" + (c ? "<p>" + s.desc + "</p>" : '<p style="color:var(--muted)">Описание откроется после первой поимки.</p>') + "</div></div>";
    UI.sheet(html, () => UI.showAtlas());
  };

  // ---------- Задания и подарок ----------
  UI.showQuests = function () {
    const st = G.state();
    let html = "<h2>Задания</h2><div class=\"sub\">Новые задания каждый день в полночь</div><div class=\"scroll\">" + giftHtml() + "<h3>На сегодня</h3>";
    st.daily.quests.forEach(function (q) {
      const p = U.clamp(q.got / q.need, 0, 1);
      html += '<div class="row"><div class="pic">' + (q.type === "species" ? fishImg(FZ.SP[q.sp], 110) : ic(q.type === "night" ? "moon" : q.type === "trophy" ? "cup" : q.type === "release" ? "wave" : "list")) + '</div><div class="body"><div class="t">' + q.text + '</div><div class="d">Награда ' + U.money(q.reward) + '</div><div class="prog"><i style="width:' + Math.round(p * 100) + '%"></i></div></div>' +
        (q.claimed ? '<span class="btn small ghost">Получено</span>' : q.done ? '<button class="btn small brass" data-q="' + q.id + '">Забрать</button>' : '<span class="btn small ghost">' + (q.type === "kg" ? String(q.got).replace(".", ",") : q.got) + " / " + q.need + "</span>") + "</div>";
    });
    html += "</div>";
    const sh = UI.sheet(html, () => { if (UI.menuOpen) UI.showMenu(); });
    sh.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { const m = G.claimQuest(b.dataset.q); if (m) { FZ.Sound.coin(); UI.toast("+" + U.money(m), "gold"); } UI.closeSheet(); UI.showQuests(); }));
    const gb = sh.querySelector("#gGet"); if (gb) gb.onclick = () => { const m = G.claimGift(); if (m) { FZ.Sound.coin(); UI.toast("Подарок: +" + U.money(m), "gold"); } UI.closeSheet(); UI.showQuests(); };
  };
  function giftHtml() {
    const st = G.state(), avail = G.giftAvailable();
    const yest = U.dayKey(new Date(Date.now() - 86400000));
    const cont = st.daily.giftDay === yest || st.daily.giftDay === U.dayKey();
    const cur = avail ? (cont ? (st.daily.streak % 7) + 1 : 1) : st.daily.streak;
    let h = "<h3>Подарок за вход</h3><div class=\"streak\">";
    Wd.DAILY_GIFTS.forEach(function (g, i) { const day = i + 1; const done = day < cur || (!avail && day === cur); h += '<div class="' + (done ? "done" : "") + (avail && day === cur ? " now" : "") + '">день ' + day + "<b>" + U.num(g) + "</b></div>"; });
    h += "</div>" + (avail ? '<button class="btn brass" id="gGet" style="width:100%">' + ic("gift") + " Забрать " + U.money(Wd.DAILY_GIFTS[cur - 1]) + "</button>" : '<div class="d" style="color:var(--muted);font-size:12.5px">Сегодняшний подарок получен. Приходите завтра — награда растёт.</div>');
    return h;
  }
  UI.showGift = function () {
    if (!G.giftAvailable()) return;
    const sh = UI.sheet("<h2>" + (G.state().stats.days ? "С возвращением!" : "Подарок рыбаку") + "</h2><div class=\"sub\">Заходите каждый день — подарок растёт до 7-го дня</div>" + giftHtml());
    sh.querySelector("#gGet").onclick = () => { const m = G.claimGift(); if (m) { FZ.Sound.coin(); UI.toast("Подарок: +" + U.money(m), "gold"); } UI.closeSheet(); };
  };

  // ---------- Турнир дня ----------
  UI.showTour = function () {
    const st = G.state(), tour = Wd.tournament(), s = FZ.SP[tour.species];
    const best = st.daily.tour;
    const now = new Date(); const left = Math.ceil((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now) / 3600000);
    const where = FZ.whereLives(s.id).map((l) => FZ.LOC[l]).filter((l) => s.season[G.season()] > 0.2);
    let html = "<h2>Турнир дня</h2><div class=\"sub\">Поймайте самую крупную рыбу дня. До нового турнира " + left + " " + U.plural(left, "час", "часа", "часов") + "</div><div class=\"scroll\">" +
      '<div class="tourfish">' + fishImg(s, 300) + '<div style="font-weight:800;font-size:24px">' + s.n + '</div><div class="d" style="color:var(--muted)">' + (best ? "Ваш лучший сегодня: " + U.kg(best.w) + ", " + best.len + " см" : "Пока нет улова. Покажите, на что способны!") + "</div></div>";
    tour.tiers.forEach(function (t2) {
      const okw = best && best.w >= t2.w, got = st.daily.tourClaim.indexOf(t2.id) >= 0;
      const col = t2.id === "gold" ? "#f2c21a" : t2.id === "silver" ? "#c8d0d8" : "#d8955a";
      html += '<div class="tier"><div class="medal" style="background:' + col + '"></div><div class="body" style="flex:1"><div class="t" style="font-weight:700">' + t2.n + ": от " + U.kg(t2.w) + '</div><div class="d" style="color:var(--muted);font-size:12.5px">Приз ' + U.money(t2.prize) + "</div></div>" +
        (got ? '<span class="btn small ghost">Получено</span>' : okw ? '<button class="btn small brass" data-t="' + t2.id + '">Забрать</button>' : '<span class="btn small ghost">' + (best ? "ещё " + U.kg(Math.max(0.001, t2.w - best.w)) : "—") + "</span>") + "</div>";
    });
    html += "<h3>Где ловить</h3>" + (where.length ? where.map((l) => '<div class="row ' + (st.lvl < l.lvl ? "locked" : "") + '"><div class="body"><div class="t">' + l.n + '</div><div class="d">' + l.reg + "</div></div>" + (st.lvl < l.lvl ? '<span class="btn small ghost">с ' + l.lvl + " ур.</span>" : '<button class="btn small red" data-go="' + l.id + '">Ехать</button>') + "</div>").join("") : '<div class="d">В этом сезоне вид почти не клюёт. Смените сезон на карте водоёмов.</div>') +
      (best ? '<button class="btn" id="tShare" style="width:100%;margin-top:12px">' + ic("share") + " Похвастаться уловом</button>" : "") + "</div>";
    const sh = UI.sheet(html, () => { if (UI.menuOpen) UI.showMenu(); });
    sh.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { const m = G.claimTour(b.dataset.t); if (m) { FZ.Sound.trophy(); UI.toast("Приз: +" + U.money(m), "gold"); } UI.closeSheet(); UI.showTour(); }));
    sh.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => UI.travel(b.dataset.go, G.season())));
    const sb = sh.querySelector("#tShare");
    if (sb) sb.onclick = () => { const w = best.w; const r = { s, w, len: best.len, loc: best.loc, date: U.dayKey(), trophy: w >= s.trophy, record: false, newSpecies: false, pct: Wd.percentile(s, w) }; tour.tiers.forEach((t2) => { if (w >= t2.w) r.tier = t2; }); FZ.Share.share(r); };
  };

  // ---------- Настройки ----------
  UI.showSettings = function () {
    const st = G.state(), S = st.settings;
    const sw = (k, n) => '<div class="opt"><span>' + n + '</span><button class="sw ' + (S[k] ? "on" : "") + '" data-k="' + k + '" aria-label="' + n + '"></button></div>';
    let html = "<h2>Настройки</h2><div class=\"sub\">" + FZ.CONFIG.title + "</div><div class=\"scroll\">" + sw("sound", "Звуки природы и эффекты") + sw("music", "Музыка") + sw("vibro", "Вибрация") +
      '<div class="opt"><span>Качество графики</span></div><div class="seg" id="qSeg"><button data-q="hi" class="' + (S.quality === "hi" ? "on" : "") + '">Высокое</button><button data-q="lo" class="' + (S.quality === "lo" ? "on" : "") + '">Экономное</button></div>' +
      '<div class="row"><div class="pic">' + ic("cam") + '</div><div class="body"><div class="t">Режим съёмки</div><div class="d">Кнопка с камерой на берегу прячет интерфейс — удобно снимать ролики и Shorts с экрана.</div></div></div>' +
      (FZ.CONFIG.youtube ? '<button class="btn" id="sYt" style="width:100%;margin-top:10px">' + ic("yt") + " Наш канал на YouTube</button>" : "") +
      '<button class="btn ghost" id="sRate" style="width:100%;margin-top:10px">' + ic("star") + " Оценить игру</button>" +
      '<div class="d" style="color:var(--muted);font-size:12px;margin-top:16px;text-align:center">Crystal Games. Статистика: поймано ' + st.stats.total + " рыб, " + st.stats.kg.toFixed(1).replace(".", ",") + " кг, отпущено " + st.stats.released + "</div></div>";
    const sh = UI.sheet(html, () => { if (UI.menuOpen) UI.showMenu(); });
    sh.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { const k = b.dataset.k; S[k] = !S[k]; b.classList.toggle("on", S[k]); if (k === "sound") FZ.Sound.setOn(S[k]); if (k === "music") { FZ.Sound.setMusic(S[k]); if (S[k]) UI.ambience(); } G.save(true); FZ.Sound.click(); }));
    sh.querySelectorAll("#qSeg button").forEach((b) => (b.onclick = () => { S.quality = b.dataset.q; FZ.Scene.setQuality(S.quality); G.save(true); UI.closeSheet(); UI.showSettings(); }));
    const yt = sh.querySelector("#sYt"); if (yt) yt.onclick = () => FZ.Platform.openUrl(FZ.CONFIG.youtube);
    sh.querySelector("#sRate").onclick = () => { st.rateAsked = 2; G.save(true); FZ.Platform.rate(); };
  };

  // ---------- Улов ----------
  let catchAnim = null;
  UI.showCatch = function (r) {
    const ov = $("ovCatch"), s = r.s;
    const rar = FZ.RARITY[s.rar];
    const badges = [];
    if (r.newSpecies) badges.push(["Новый вид в атласе", "#7ccf6a"]);
    if (r.trophy) badges.push(["Трофей", "#f2a71b"]);
    if (r.record && !r.newSpecies) badges.push(["Личный рекорд", "#8fd3e0"]);
    if (r.tier) badges.push(["Турнир дня: " + r.tier.n.toLowerCase(), r.tier.id === "gold" ? "#f2c21a" : r.tier.id === "silver" ? "#c8d0d8" : "#d8955a"]);
    else if (r.tour) badges.push(["Турнир дня", "#c8d0d8"]);
    let doubled = false;
    ov.innerHTML = '<div class="dim"></div><div class="catch">' +
      '<div class="badges">' + badges.map((b, i) => '<span class="bdg" style="background:' + b[1] + ";animation-delay:" + (0.5 + i * 0.12) + 's">' + b[0] + "</span>").join("") + "</div>" +
      '<canvas id="cFish"></canvas>' +
      '<div class="wt" id="cWt">0 г</div><div class="nm">' + s.n + '</div><div class="rar" style="color:' + rar.c + '">' + rar.n + '</div>' +
      '<div class="note">' + r.len + " см, " + FZ.LOC[r.loc].n.toLowerCase() + "</div>" +
      '<div class="pct">Крупнее ' + Math.floor(r.pct) + "% рыб этого вида" + (r.record && r.prevRecord ? ". Прошлый рекорд " + U.kg(r.prevRecord) : "") + "</div>" +
      (r.mustRelease ? '<div class="redbook">' + s.n + ": " + (s.release === "Красная книга" ? "вид из Красной книги" : "правило платника") + " — только отпустить. Опыт ×2</div>" : "") +
      '<div class="acts">' +
        '<button class="dbl" id="cDbl"><span class="adtag">реклама</span> Удвоить награду</button>' +
        '<div class="two">' +
          (r.mustRelease ? "" : '<button class="btn brass" id="cKeep">Забрать<small id="cKeepS">+' + U.money(r.price) + "</small></button>") +
          '<button class="btn ' + (r.mustRelease ? "brass" : "ghost") + '" id="cRel">Отпустить<small id="cRelS">+' + Math.round(r.xp * (r.mustRelease ? 2 : 1.5)) + " опыта</small></button>" +
        "</div>" +
        '<button class="btn ghost" id="cShare">' + ic("share") + " Поделиться уловом</button>" +
      "</div></div>";
    ov.classList.add("on"); $("hud").classList.add("hide");
    // анимация рыбы и веса
    const cv = $("cFish"); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = cv.getBoundingClientRect(); cv.width = rect.width * dpr; cv.height = rect.height * dpr;
    const g = cv.getContext("2d");
    const t0 = performance.now();
    const len = Math.min(rect.width * 0.95, rect.height * 2.6);
    const drops = [];
    for (let i = 0; i < 40; i++) drops.push({ x: rect.width / 2 + (Math.random() - 0.5) * len * 0.8, y: rect.height * 0.55, vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 260, r: 1 + Math.random() * 3 });
    if (catchAnim) cancelAnimationFrame(catchAnim);
    const loop = function () {
      const t = (performance.now() - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, rect.width, rect.height);
      const k = U.clamp(t / 0.6, 0, 1);
      const glow = g.createRadialGradient(rect.width / 2, rect.height / 2, 10, rect.width / 2, rect.height / 2, rect.width * 0.55);
      glow.addColorStop(0, U.rgba(r.trophy ? "#f2a71b" : "#8fd3e0", 0.28 * k)); glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow; g.fillRect(0, 0, rect.width, rect.height);
      const x = rect.width / 2 + (1 - U.easeOutBack(k)) * rect.width * 0.8;
      FZ.Art.drawFish(g, s, x, rect.height / 2 + Math.sin(t * 2) * 4, len * 0.9, { phase: t * (t < 1.2 ? 14 : 4), amp: t < 1.2 ? 0.45 : 0.12, roll: Math.sin(t * 1.5) * 0.04 });
      drops.forEach((d) => { if (t > 1.2) return; d.vy += 600 / 60; d.x += d.vx / 60; d.y += d.vy / 60; g.fillStyle = "rgba(220,240,250,0.8)"; g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill(); });
      const kw = U.clamp((t - 0.3) / 0.9, 0, 1);
      $("cWt").textContent = U.kg(Math.max(0.001, r.w * U.easeOut(kw)));
      if (ov.classList.contains("on")) catchAnim = requestAnimationFrame(loop);
    };
    loop();
    if (r.newSpecies || r.trophy) FZ.Platform.vibrate([30, 50, 30]);
    const done = function (keep) {
      ov.classList.remove("on"); cancelAnimationFrame(catchAnim); $("hud").classList.remove("hide");
      const res = G.resolveCatch(keep, doubled);
      if (res) { if (res.money) UI.toast("+" + U.money(res.money) + ", +" + res.xp + " опыта", "gold"); else UI.toast("Отпустили. +" + res.xp + " опыта", "gold"); }
      UI.refreshTools();
      UI.afterCatch(r);
    };
    if ($("cKeep")) $("cKeep").onclick = () => done(true);
    $("cRel").onclick = () => { FZ.Sound.splash(0.4); done(false); };
    $("cShare").onclick = () => FZ.Share.share(r);
    $("cDbl").onclick = async function () {
      if (doubled) return;
      const ok = await FZ.Ads.rewarded();
      if (!ok) { UI.toast("Реклама сейчас недоступна", "bad"); return; }
      doubled = true; this.classList.add("on"); this.textContent = "Награда удвоена";
      if ($("cKeepS")) $("cKeepS").textContent = "+" + U.money(r.price * 2);
      $("cRelS").textContent = "+" + Math.round(r.xp * (r.mustRelease ? 2 : 1.5) * 2) + " опыта";
    };
  };
  UI.afterCatch = async function (r) {
    const st = G.state(), s = G.sess();
    if (st.tut === 3) { st.tut = 4; G.save(true); setTimeout(() => UI.toast("Отлично! В меню «Снасти» есть фидер и спиннинг — с ними клюёт крупнее", "", 4200), 700); return; }
    // просьба оценить — после удачи
    if (!st.rateAsked && (st.stats.trophies >= 2 || st.stats.total >= 18) && (r.trophy || r.record)) {
      st.rateAsked = 1; G.save(true);
      const sh = UI.sheet("<h2>Нравится рыбалка?</h2><div class=\"sub\">Оценка в RuStore помогает другим рыбакам найти игру</div><div style=\"display:flex;gap:8px;margin-top:8px\"><button class=\"btn ghost\" id=\"rLater\" style=\"flex:1\">Позже</button><button class=\"btn brass\" id=\"rGo\" style=\"flex:1\">" + ic("star") + " Оценить</button></div>");
      sh.querySelector("#rLater").onclick = () => UI.closeSheet();
      sh.querySelector("#rGo").onclick = () => { st.rateAsked = 2; G.save(true); UI.closeSheet(); FZ.Platform.rate(); };
      return;
    }
    if (s.catches % 6 === 0) await FZ.Ads.interstitial();
  };

  UI.onLost = function (e) {
    const f = e.fish;
    const worth = f && (f.w >= 0.4 || f.s.rar >= 3);
    const r = G.rig();
    if (!worth || !r.lost || !r.lost.canRevive) { UI.toast(e.text, "bad", 2600); return; }
    const ov = $("ovLost");
    const guess = f.w < 1 ? "грамм на " + Math.round(f.w * 10) * 100 : "на " + U.kg(f.w * U.rand.range(0.85, 1.2)).replace(/,\d+/, "") + " (на глаз)";
    ov.innerHTML = '<div class="dim"></div><div class="lost"><h2>' + e.text + "</h2><p>Там была солидная рыба, " + guess + ". Вернуть её?</p>" +
      '<button class="btn brass" id="lRev"><span class="adtag">реклама</span> Второй шанс</button><button class="btn ghost" id="lNo">Отпустить с миром</button></div>';
    ov.classList.add("on");
    $("lNo").onclick = () => { ov.classList.remove("on"); G.rig().lost = null; };
    $("lRev").onclick = async () => { const ok = await FZ.Ads.rewarded(); ov.classList.remove("on"); if (ok) G.revive(); else UI.toast("Реклама сейчас недоступна", "bad"); };
  };

  FZ.UI = UI;
})(window.FZ);

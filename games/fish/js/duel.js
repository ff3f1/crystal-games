/* Асинхронный вызов на три заброса. Дата задаёт условия, код передаёт счёт. */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, UI = FZ.UI, $ = U.$;
  const D = { count: 3, today: U.dayNum };
  const KEY = "fz_duel_1";
  const venues = ["pond", "oka", "seliger", "ladoga"];
  const eligible = ["roach", "rudd", "perch", "crucian", "gcrucian", "tench", "bream", "ide", "chub", "carp"];
  const points = n => n.toLocaleString("ru-RU");

  const validDay = day => Number.isInteger(day) && day >= 20000 && day <= 99999;
  const validScore = score => Number.isInteger(score) && score >= 0 && score <= 29999;
  function check(code) { return (U.hash(code) % 1296).toString(36).padStart(2, "0").toUpperCase(); }
  D.code = function (day, score) {
    const body = "TZ1-" + day.toString(36).toUpperCase() + "-" + score.toString(36).toUpperCase();
    return body + "-" + check(body);
  };
  D.parse = function (text) {
    const match = String(text).toUpperCase().match(/\bTZ1-([0-9A-Z]{1,4})-([0-9A-Z]{1,3})-([0-9A-Z]{2})\b/);
    if (!match || check(match[0].slice(0, -3)) !== match[3]) return null;
    const day = parseInt(match[1], 36), target = parseInt(match[2], 36);
    return validDay(day) && validScore(target) && D.code(day, target) === match[0] ? { day, target } : null;
  };
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  D.date = day => dateLabel.format(new Date(day * 86400000));
  D.rules = function (day) {
    const rng = U.rng("three-casts/v1/" + day);
    const loc = FZ.LOC[rng.pick(venues)];
    const season = rng.pick(["summer", "spring", "autumn"]);
    const period = rng.pick(["dawn", "day", "dusk"]);
    const sky = rng.pick(["clear", "cloudy", "clear", "rain"]);
    const wind = rng.int(1, 5);
    const pool = eligible.filter(id => loc.fish[id]).map(id => FZ.SP[id]);
    const rounds = Array.from({ length: D.count }, () => ({
      z: rng.range(8, 12.8), offset: rng.range(-0.21, 0.21), phase: rng.range(0, 6),
      fish: rng.pick(pool), size: rng.range(0.83, 1.15), seed: rng.int(1, 0x7fffffff)
    }));
    return { day, loc, season, period, sky, wind, rounds };
  };
  D.create = function (day, target) {
    if (!validDay(day) || (target !== null && !validScore(target))) return null;
    return { rules: D.rules(day), target, rows: [], score: 0, restAt: 0, cast: null, drag: 0.7 };
  };
  D.spot = function (run, time) {
    const round = run.rules.rounds[run.rows.length];
    if (!round) return null;
    const elapsed = Math.max(0, time - run.restAt);
    const X = FZ.Scene.maxLat(round.z) * (round.offset + 0.33 * Math.sin(elapsed * 0.82 + round.phase));
    return { X, Z: round.z, radius: 1.75 };
  };
  D.cast = function (run, a, t) {
    const spot = D.spot(run, t), round = run.rules.rounds[run.rows.length];
    const distance = Math.hypot(a.X - spot.X, a.Z - spot.Z);
    const onSpot = distance <= spot.radius;
    const s = round.fish;
    const w = U.clamp((onSpot ? 1.15 : 0.58) * round.size * Math.max(s.med, 0.32), s.min, Math.min(2.7, s.max));
    return { s, w, onSpot, delay: onSpot ? 1.05 : 3.05, rng: U.rng(round.seed) };
  };
  function recordBook() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(saved)) return saved.filter(r => r && validDay(r.day) && validScore(r.score) && Array.isArray(r.rows)).slice(0, 35);
    } catch (_) {}
    return [];
  }
  D.best = day => recordBook().find(r => r.day === day);
  D.finishCast = function (run, fish, reason, t) {
    const cast = run.cast;
    if (!cast) return null;
    const row = fish ? {
      sid: fish.s.id, w: Math.round(fish.w * 1000) / 1000, weight: Math.round(fish.w * 1000),
      spot: cast.onSpot ? 250 : 0, hook: fish.duelPrecise ? 150 : 0,
      clean: (fish.duelStrain || 0) <= 0.22 ? 150 : 0
    } : { reason, weight: 0, spot: 0, hook: 0, clean: 0 };
    row.total = row.weight + row.spot + row.hook + row.clean;
    run.score += row.total;
    run.rows.push(row);
    run.cast = null;
    run.restAt = t;
    if (run.rows.length === D.count) {
      const day = run.rules.day;
      const book = recordBook();
      const prior = book.find(r => r.day === day);
      run.record = run.score > (prior ? prior.score : 0);
      if (run.record) {
        const entry = { day, score: run.score, rows: run.rows };
        try { localStorage.setItem(KEY, JSON.stringify([entry, ...book.filter(r => r.day !== day)].slice(0, 35))); } catch (_) {}
      }
    }
    return row;
  };

  D.drawShoal = function (ctx, spot, t, project) {
    const p = project(spot.X, spot.Z);
    const r = U.clamp(p.s * spot.radius, 14, 49);
    const pulse = (t * 0.78) % 1;
    ctx.save();
    ctx.strokeStyle = U.rgba("#ffd890", 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.31, 0, 0, 2 * Math.PI); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = U.rgba("#ffc968", 0.55 * (1 - pulse));
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (0.3 + pulse), r * (0.1 + pulse * 0.31), 0, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = "#fff1b9";
    for (let i = 0; i < 3; i++) {
      const a = t * 2.1 + i * 1.9;
      ctx.globalAlpha = 0.42 + 0.42 * Math.sin(a) ** 2;
      ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * r * 0.53, p.y + Math.sin(a) * r * 0.15, 2, 0.9, a * 0.3, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.restore();
  };

  function start(day, target) {
    const ok = G.startDuel(day, target);
    if (ok !== true) { UI.toast(ok, "bad"); return; }
    UI.closeSheet();
    if (UI.menuOpen) UI.closeMenu();
    UI.refreshTools();
    UI.ambience();
    FZ.Sound.unlock();
  }

  async function copyCode(code, field) {
    if (window.AndroidShare && window.AndroidShare.copyChallenge) {
      if (window.AndroidShare.copyChallenge(code)) { UI.toast("Код скопирован"); return; }
    }
    try { await navigator.clipboard.writeText(code); UI.toast("Код скопирован"); }
    catch (_) { field.focus(); field.select(); }
  }

  D.card = function (entry) {
    const W = 720, H = 960, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d"), rules = D.rules(entry.day);
    const img = FZ.Assets.get("base/" + rules.loc.id);
    if (img) {
      const scale = Math.max(W / img.width, H / img.height);
      g.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
    } else { g.fillStyle = "#153e49"; g.fillRect(0, 0, W, H); }
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "#08212dd1"); shade.addColorStop(0.46, "#122c38be"); shade.addColorStop(1, "#0a202afa");
    g.fillStyle = shade; g.fillRect(0, 0, W, H);
    function text(value, x, y, size, color, weight = 700, align = "center") {
      g.font = weight + " " + size + "px Rubik, sans-serif";
      g.fillStyle = color; g.textAlign = align; g.fillText(value, x, y);
    }
    g.strokeStyle = "#f5daa58c"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(26, 27, W - 52, H - 54, 25); g.stroke();
    text("РЫБАЛКА: КЛЮЁТ!", 360, 102, 19, "#ddf2e4");
    text("ТРИ ЗАБРОСА", 360, 190, 54, "#f8eed5", 800);
    text(rules.loc.n + " · " + D.date(entry.day), 360, 238, 22, "#c3dfdd", 500);
    text(points(entry.score), 360, 391, 128, "#ffdd94", 800);
    text("ОЧКОВ", 360, 435, 21, "#f5e5c3");
    for (let i = 0; i < D.count; i++) {
      const row = entry.rows[i], y = 496 + i * 66;
      g.fillStyle = "#d1ecde12"; g.beginPath(); g.roundRect(72, y - 29, 576, 52, 10); g.fill();
      text(String(i + 1), 96, y + 5, 19, "#f5cf86", 700, "left");
      const species = row && FZ.SP[row.sid];
      text(species ? species.n : "Сошла или не клюнула", 129, y + 5, 21, "#dfefe6", 500, "left");
      text(row ? points(row.total) : "0", 625, y + 5, 23, "#ffdd94", 700, "right");
    }
    text("Сможешь перебить?", 360, 758, 37, "#f7edd4", 800);
    text(D.code(entry.day, entry.score), 360, 817, 34, "#ffe19e", 700);
    text("Введи код в «Три заброса»", 360, 867, 21, "#cfe5e3", 500);
    return c;
  };
  async function share(entry) {
    const code = D.code(entry.day, entry.score);
    const msg = "Мои три заброса — " + points(entry.score) + " очков. Перебьёшь? Открой «Три заброса» и введи код " + code;
    if (!await FZ.Platform.shareImage(D.card(entry), msg)) UI.toast("Можно отправить код вручную", "bad");
  }

  UI.showDuel = function () {
    const day = D.today(), rules = D.rules(day), best = D.best(day);
    const sh = UI.sheet('<div class="scroll duel-sheet"><div class="duel-hero"><p>ИСПЫТАНИЕ ДНЯ · '+D.date(day)+'</p><h2>Три заброса</h2><span>'+rules.loc.n+' · '+FZ.TIMES[rules.period]+'</span></div>'+
      '<p>Попади в движущийся косяк и подсеки в золотой зоне. Вес, точность и чистое вываживание дают очки.</p>'+
      '<button class="btn brass duel-wide" id="duelStart">Начать испытание</button>'+
      (best?'<button class="btn ghost duel-wide" id="duelBest">Поделиться рекордом · '+points(best.score)+'</button>':'')+
      '<form id="duelForm" class="duel-form"><label for="duelInput">Код друга</label><div><input id="duelInput" maxlength="400" autocomplete="off" spellcheck="false" placeholder="TZ1-…"><button type="button" class="btn ghost hide" id="duelPaste">Вставить</button></div>'+
      '<p class="duel-error hide" id="duelError" role="alert">Не удалось прочитать код. Проверь его или вставь сообщение целиком.</p>'+
      '<button class="btn ghost duel-wide" type="submit">Принять вызов</button></form></div>');
    sh.querySelector("#duelStart").onclick = () => start(day, null);
    if (best) sh.querySelector("#duelBest").onclick = () => { UI.closeSheet(); UI.showDuelResult(best, true); };
    const field = sh.querySelector("#duelInput"), paste = sh.querySelector("#duelPaste");
    if (window.AndroidShare && window.AndroidShare.pasteChallenge) {
      paste.classList.remove("hide");
      paste.onclick = () => {
        const code = window.AndroidShare.pasteChallenge();
        if (code) field.value = code;
        sh.querySelector("#duelError").classList.toggle("hide", !!code);
      };
    }
    sh.querySelector("#duelForm").onsubmit = e => {
      e.preventDefault();
      const parsed = D.parse(field.value);
      sh.querySelector("#duelError").classList.toggle("hide", !!parsed);
      if (parsed) start(parsed.day, parsed.target);
    };
  };

  UI.duelCast = function (run, row) {
    if (run.rows.length === D.count) {
      UI.showDuelResult({ day: run.rules.day, rows: run.rows, score: run.score }, false, run.target, run.record);
      return;
    }
    const notes = [];
    if (row.spot) notes.push("Косяк +" + row.spot);
    if (row.hook) notes.push("Подсечка +" + row.hook);
    if (row.clean) notes.push("Леска +" + row.clean);
    const sh = UI.sheet('<div class="duel-step"><p>Заброс '+run.rows.length+' из '+D.count+'</p><h2>'+(row.sid ? FZ.SP[row.sid].n : row.reason)+'</h2>'+
      '<strong>+'+points(row.total)+'</strong>'+(row.sid?'<p>'+U.kg(row.w)+(notes.length?' · '+notes.join(' · '):'')+'</p>':'')+
      '<button class="btn brass duel-wide" id="duelNext">Следующий заброс</button></div>');
    sh.querySelector("#duelNext").onclick = UI.closeSheet;
  };

  UI.showDuelResult = function (entry, fromMenu, target = null, record = false) {
    const title = target === null ? (record ? "Личный рекорд!" : "Три заброса позади")
      : entry.score > target ? "Ты выиграл вызов!" : entry.score === target ? "Ничья" : "Друг пока впереди";
    const rows = entry.rows.map((r, i) => '<li><span>'+(i+1)+'</span><b>'+(FZ.SP[r.sid] ? FZ.SP[r.sid].n : U.esc(r.reason || "Без улова"))+'</b><strong>'+points(r.total)+'</strong></li>').join("");
    const code = D.code(entry.day, entry.score);
    const close = () => { if (!fromMenu) { G.leaveDuel(); UI.showMenu(); } };
    const sh = UI.sheet('<div class="scroll duel-sheet duel-result"><div class="duel-hero"><p>'+D.rules(entry.day).loc.n+'</p><h2>'+title+'</h2><strong>'+points(entry.score)+' <small>очков</small></strong>'+
      (target === null ? '' : '<span>У друга '+points(target)+'</span>')+'</div><ol>'+rows+'</ol>'+
      '<button id="duelShare" class="btn brass duel-wide">Поделиться вызовом</button>'+
      '<div class="duel-code"><input id="duelCode" readonly aria-label="Код вызова" value="'+code+'"><button id="duelCopy" class="btn ghost">Копировать</button></div>'+
      '<button id="duelReplay" class="btn ghost duel-wide">Сыграть ещё раз</button></div>', close);
    sh.querySelector("#duelShare").onclick = () => share(entry);
    sh.querySelector("#duelCopy").onclick = () => copyCode(code, sh.querySelector("#duelCode"));
    sh.querySelector("#duelReplay").onclick = () => {
      UI.closeSheet();
      start(entry.day, target);
    };
  };
  UI.pauseDuel = function () {
    const sh = UI.sheet('<div class="duel-step"><h2>Три заброса</h2><p>При выходе текущая попытка завершится.</p><button id="duelResume" class="btn brass duel-wide">Продолжить</button>'+
      '<button id="duelLeave" class="btn ghost duel-wide">Вернуться к обычной рыбалке</button></div>');
    sh.querySelector("#duelResume").onclick = UI.closeSheet;
    sh.querySelector("#duelLeave").onclick = () => { UI.closeSheet(); G.leaveDuel(); UI.showMenu(); };
  };
  FZ.Duel = D;
})(window.FZ);

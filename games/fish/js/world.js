/* Мир по календарю: погода и прогноз клёва, турнир дня, задания дня.
   Всё считается от даты, поэтому у всех игроков в один день одно и то же. */
(function (FZ) {
  "use strict";
  const U = FZ.U;
  const W = {};
  const DIRS = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  const DIR_FULL = { "С": "северный", "СВ": "северо-восточный", "В": "восточный", "ЮВ": "юго-восточный", "Ю": "южный", "ЮЗ": "юго-западный", "З": "западный", "СЗ": "северо-западный" };

  // Погода на водоёме в день dayKey для сезона season
  W.weather = function (locId, season, dayKey) {
    dayKey = dayKey || U.dayKey();
    const r = U.rng("wx|" + dayKey + "|" + locId + "|" + season);
    const yest = U.rng("wx|" + dayKey + "|base")(); // общий фон для всех водоёмов в этот день
    const pressure = Math.round(742 + yest * 18 + r.range(-6, 6));
    const trendR = r();
    const trend = trendR < 0.28 ? "down" : trendR > 0.72 ? "up" : "flat";
    const wind = Math.round(r.range(0, 1) * r.range(0, 1) * 11);
    const dir = r.pick(DIRS);
    let sky;
    if (season === "winter") sky = U.weighted([["clear", 3], ["cloudy", 3], ["overcast", 2], ["snow", 2]], r());
    else if (season === "summer") sky = U.weighted([["clear", 4], ["cloudy", 3], ["overcast", 1.5], ["rain", 1.2], ["storm", 0.4]], r());
    else sky = U.weighted([["clear", 2.5], ["cloudy", 3], ["overcast", 2.5], ["rain", 2]], r());
    const tRange = { spring: [4, 17], summer: [17, 30], autumn: [1, 13], winter: [-24, -3] }[season];
    const temp = Math.round(r.range(tRange[0], tRange[1]));

    // Влияние на клёв (народная мудрость + здравый смысл)
    let peace = 1, pred = 1;
    if (trend === "flat") { peace *= 1.15; }
    if (trend === "down") { pred *= 1.25; peace *= 0.85; }
    if (trend === "up") { peace *= 0.95; pred *= 0.9; }
    if (pressure > 762) { peace *= 0.88; pred *= 0.9; }
    if (pressure < 740) { peace *= 0.9; pred *= 1.1; }
    if (wind >= 8) { peace *= 0.8; pred *= 0.9; }
    else if (wind >= 2 && wind <= 5) { peace *= 1.05; pred *= 1.1; }
    if (dir === "Ю" || dir === "ЮЗ" || dir === "З") { peace *= 1.08; pred *= 1.05; }
    if (dir === "С" || dir === "СВ" || dir === "В") { peace *= 0.92; }
    if (sky === "overcast" || sky === "cloudy") pred *= 1.12;
    if (sky === "rain") { peace *= 1.05; pred *= 1.08; }
    if (sky === "storm") { peace *= 0.7; pred *= 0.75; }
    if (sky === "clear" && season === "summer") peace *= 0.95;
    if (season === "winter" && temp < -18) { peace *= 0.8; pred *= 0.85; }
    const score = U.clamp(Math.round(((peace + pred) / 2 - 0.62) / 0.13), 1, 5);
    return { pressure, trend, wind, dir, dirFull: DIR_FULL[dir], sky, temp, peace, pred, score };
  };

  W.skyName = (s) => ({ clear: "Ясно", cloudy: "Облачно", overcast: "Пасмурно", rain: "Дождь", storm: "Гроза", snow: "Снег" }[s]);
  W.skyIcon = (s, night) => ({ clear: night ? "🌙" : "☀️", cloudy: "⛅", overcast: "☁️", rain: "🌧️", storm: "⛈️", snow: "🌨️" }[s]);
  W.trendName = (t) => ({ up: "растёт", down: "падает", flat: "стабильное" }[t]);

  W.tip = function (wx) {
    if (wx.sky === "storm") return "Перед грозой рыба затаилась. Переждите — после дождя будет клёв.";
    if (wx.trend === "down") return "Давление падает — хищник выходит на охоту. Берите спиннинг!";
    if (wx.trend === "flat" && wx.score >= 4) return "Стабильная погода — мирная рыба клюёт уверенно.";
    if (wx.wind >= 8) return "Сильный ветер мешает поплавку. Попробуйте фидер или спиннинг.";
    if (wx.dir === "Ю" || wx.dir === "ЮЗ") return "Тёплый южный ветерок — «рыбацкий». Хороший день!";
    if (wx.dir === "С" || wx.dir === "СВ") return "Северный ветер — рыба капризничает. Мельче наживку!";
    if (wx.sky === "rain") return "Тёплый дождик взбадривает рыбу. Ловите у травы.";
    return "Лучшее время — зорьки. Днём ищите рыбу глубже.";
  };

  // Активность вида: сезон × время суток × погода
  W.activity = function (s, season, time, wx) {
    const k = s.season[season] * s.time[time] * (s.kind === "pred" ? wx.pred : wx.peace);
    return k;
  };

  // Кто сегодня клюёт на водоёме
  W.biters = function (loc, season, wx) {
    const list = Object.keys(loc.fish).map(function (id) {
      const s = FZ.SP[id];
      const a = loc.fish[id] * s.season[season] * Math.max(s.time.dawn, s.time.day, s.time.dusk) * (s.kind === "pred" ? wx.pred : wx.peace);
      return [s, a];
    }).filter((x) => x[0].season[season] > 0.2);
    list.sort((a, b) => b[1] - a[1]);
    return list.map((x) => x[0]);
  };

  // ---------- Турнир дня ----------
  W.tournament = function (dayKey) {
    dayKey = dayKey || U.dayKey();
    const r = U.rng("tour|" + dayKey);
    const season = U.seasonOf(new Date(dayKey + "T12:00:00"));
    const pool = FZ.SPECIES.filter(function (s) {
      if (s.release || s.season[season] < 0.6) return false;
      const lv = Math.min.apply(null, FZ.whereLives(s.id).map((l) => FZ.LOC[l].lvl));
      return lv <= 12;
    });
    const s = U.weighted(pool.map((x) => [x, x.rar <= 1 ? 3 : x.rar === 2 ? 3 : 1.5]), r());
    const q = (p) => +(s.med * Math.exp(s.sigma * W.zOf(p))).toFixed(3);
    const tiers = [
      { id: "bronze", n: "Бронза", w: q(0.6), prize: 300 },
      { id: "silver", n: "Серебро", w: q(0.85), prize: 800 },
      { id: "gold", n: "Золото", w: q(0.97), prize: 2000 }];
    return { day: dayKey, species: s.id, tiers: tiers, season: season };
  };
  // Обратная к нормальной функции распределения (через подбор)
  W.zOf = function (p) { let lo = -5, hi = 5; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (U.ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  // Процентиль: «крупнее N% рыб этого вида»
  W.percentile = function (s, w) { return U.clamp(Math.round(U.ncdf(Math.log(w / s.med) / s.sigma) * 1000) / 10, 0.1, 99.9); };

  // ---------- Задания дня ----------
  W.quests = function (dayKey, state) {
    const r = U.rng("q|" + dayKey + "|" + state.lvl);
    const season = U.seasonOf(new Date(dayKey + "T12:00:00"));
    const locs = FZ.LOCATIONS.filter((l) => l.lvl <= state.lvl);
    const avail = {};
    locs.forEach(function (l) {
      Object.keys(l.fish).forEach(function (id) {
        const s = FZ.SP[id];
        if (s.season[season] >= 0.5 && l.fish[id] >= 6) avail[id] = (avail[id] || 0) + l.fish[id];
      });
    });
    const sp = Object.keys(avail).sort();
    const out = [];
    const used = {};
    const scale = 1 + state.lvl * 0.12;
    const add = function (q) { if (!used[q.type + (q.sp || "")]) { used[q.type + (q.sp || "")] = 1; q.id = "q" + out.length; out.push(q); } };
    let guard = 0;
    while (out.length < 3 && guard++ < 30) {
      const t = U.weighted([["species", 4], ["kg", 2], ["release", 1.5], ["count", 1.5], ["trophy", state.lvl >= 5 ? 1 : 0], ["night", state.lvl >= 3 ? 1 : 0]], r());
      if (t === "species" && sp.length) {
        const id = U.weighted(sp.map((x) => [x, avail[x]]), r());
        const s = FZ.SP[id];
        const n = s.med < 0.3 ? r.int(4, 7) : s.med < 1.5 ? r.int(2, 4) : 1;
        add({ type: "species", sp: id, need: n, text: "Поймать: " + s.n.toLowerCase() + " × " + n, reward: Math.round((120 + n * 40 + s.rar * 80) * scale) });
      } else if (t === "kg") {
        const kg = Math.round((3 + state.lvl * 1.2) * r.range(0.8, 1.3));
        add({ type: "kg", need: kg, text: "Наловить " + kg + " кг рыбы", reward: Math.round((150 + kg * 30) * scale) });
      } else if (t === "release") {
        const n = r.int(2, 4);
        add({ type: "release", need: n, text: "Отпустить рыб: " + n, reward: Math.round((120 + n * 50) * scale) });
      } else if (t === "count") {
        const n = r.int(8, 15);
        add({ type: "count", need: n, text: "Поймать любых рыб: " + n, reward: Math.round((150 + n * 15) * scale) });
      } else if (t === "trophy") {
        add({ type: "trophy", need: 1, text: "Поймать трофейную рыбу", reward: Math.round(600 * scale) });
      } else if (t === "night") {
        const n = r.int(2, 3);
        add({ type: "night", need: n, text: "Ночная рыбалка: поймать " + n + " " + U.plural(n, "рыбу", "рыбы", "рыб"), reward: Math.round((200 + n * 60) * scale) });
      }
    }
    return out.map((q) => Object.assign(q, { got: 0, done: false, claimed: false }));
  };

  W.DAILY_GIFTS = [150, 250, 400, 600, 800, 1100, 2000];

  FZ.World = W;
})(window.FZ);

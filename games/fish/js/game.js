/* Игровая логика: сохранение, экономика, рыбалка (заброс → поклёвка → подсечка → вываживание → подсачек) */
(function (FZ) {
  "use strict";
  const U = FZ.U, Wd = FZ.World;
  const G = {};
  const KEY = "fz_save";
  let st = null;          // сохраняемое состояние игрока
  let sess = null;        // текущая рыбалка
  let rig = null;         // снасть и её состояние
  const ev = [];          // события для интерфейса
  const emit = (type, data) => ev.push(Object.assign({ type }, data || {}));
  G.events = () => ev.splice(0, ev.length);

  // ---------- Сохранение ----------
  function fresh() {
    return {
      v: 1, money: 300, xp: 0, lvl: 1, karma: 0, loc: "pond", seasonPick: null,
      expedition: { active: false, locId: null, homeLoc: "pond", homeSeason: null, daysTotal: 0, daysLeft: 0, daysSpent: 0, provisions: 0, bagUsed: 0, bagCapacity: 10, catches: 0, best: 0, event: null, completed: false },
      achievements: {}, expeditionsCompleted: 0, firstIceCatches: 0,
      rods: ["f1", "i1"], lines: ["l1"], hooks: ["h1", "h2"], extras: {}, lures: {},
      inv: { worm: 40, bread: 25, gb: 2 },
      load: {
        float: { rod: "f1", line: "l1", hook: "h2", bait: "worm", depth: "bottom" },
        feeder: { rod: null, line: "l1", hook: "h2", bait: "worm" },
        spin: { rod: null, line: "l1", bait: null },
        ice: { rod: "i1", line: "l1", hook: "h1", bait: "worm" }
      },
      active: "float", drag: 0.7,
      records: {}, caught: {}, journal: [], stats: { total: 0, kg: 0, released: 0, trophies: 0, best: null, days: 0 },
      daily: { day: "", quests: [], giftDay: "", streak: 0, tour: null, tourDay: "", tourClaim: [] },
      settings: { sound: true, music: true, vibro: true, ambienceVolume:.72, effectsVolume:.72, musicVolume:.32, quality: "auto", autoQ: "hi", gfx: "paint", qv: 2 },
      tut: 0, rateAsked: 0, firstDay: U.dayKey(), lastDay: ""
    };
  }
  G.load = function () {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { st = Object.assign(fresh(), s); st.settings = Object.assign(fresh().settings, s.settings || {}); } } catch (e) { st = null; }
    if (!st) st = fresh();
    st.settings.gfx = "paint"; // migrate old saves away from illustrated graphics
    st.expedition = Object.assign(fresh().expedition, st.expedition || {});
    st.achievements = st.achievements || {};
    st.expeditionsCompleted = st.expeditionsCompleted || 0;
    st.firstIceCatches = st.firstIceCatches || 0;
    if (st.settings.qv !== 2) { st.settings.quality = "auto"; st.settings.autoQ = "hi"; st.settings.qv = 2; }
    if (st.rods.indexOf("i1") < 0) { st.rods.push("i1"); if (!st.load.ice.rod) st.load.ice.rod = "i1"; }
    autoBait();
    G.dayCheck();
    checkAchievements();
    return st;
  };
  let saveT = 0;
  G.save = function (now) {
    if (!now) { saveT = 0.6; return; }
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  };
  G.state = () => st;
  G.settings = () => (st ? st.settings : {});
  G.sess = () => sess;
  G.rig = () => rig;

  // ---------- День: задания, подарок, турнир ----------
  G.dayCheck = function () {
    const day = U.dayKey();
    if (st.daily.day !== day) {
      st.daily.day = day;
      st.daily.quests = Wd.quests(day, st);
      if (st.lastDay) st.stats.days++;
      st.lastDay = day;
    }
    if (st.daily.tourDay !== day) { st.daily.tourDay = day; st.daily.tour = null; st.daily.tourClaim = []; }
  };
  G.giftAvailable = () => st.daily.giftDay !== U.dayKey();
  G.claimGift = function () {
    if (!G.giftAvailable()) return 0;
    const yest = U.dayKey(new Date(Date.now() - 86400000));
    st.daily.streak = st.daily.giftDay === yest ? (st.daily.streak % 7) + 1 : 1;
    st.daily.giftDay = U.dayKey();
    const amount = Wd.DAILY_GIFTS[st.daily.streak - 1];
    st.money += amount;
    if (st.daily.streak === 3) addInv("maggot", 50);
    if (st.daily.streak === 5) addInv("gb", 3);
    G.save(true);
    return amount;
  };

  // ---------- Уровни и деньги ----------
  G.addXP = function (n) {
    st.xp += n;
    let up = false;
    while (st.xp >= FZ.xpNeed(st.lvl)) { st.xp -= FZ.xpNeed(st.lvl); st.lvl++; up = true; st.money += 150 * st.lvl; emit("level", { lvl: st.lvl, bonus: 150 * st.lvl }); }
    G.save();
  };
  function addInv(id, n) { st.inv[id] = (st.inv[id] || 0) + n; }

  // ---------- Снасти ----------
  G.season = function () { return st.seasonPick || U.seasonOf(); };
  // Open sea coasts do not become continuous ice sheets in winter.
  const OPEN_WINTER_SEAS = new Set(["blacksea", "kamchatka", "barents"]);
  G.isFrozen = function (loc, season) {
    const id = typeof loc === "string" ? loc : loc && loc.id;
    return season === "winter" && !OPEN_WINTER_SEAS.has(id);
  };
  G.modeFor = function (season, loc) {
    const water = loc || FZ.LOC[st.loc];
    return G.isFrozen(water, season) ? "ice" : (st.load[st.active] && st.load[st.active].rod ? st.active : "float");
  };
  G.loadout = function (mode) { return st.load[mode || G.mode()]; };
  G.mode = () => (sess ? sess.mode : G.modeFor(G.season()));
  G.gear = function (mode) {
    const L = st.load[mode];
    return { rod: FZ.ROD[L.rod], line: FZ.LINE[L.line], hook: FZ.HOOK[L.hook || "h2"], bait: L.bait ? FZ.BAIT[L.bait] : null, depth: L.depth || "bottom" };
  };
  G.baitLeft = function (id) { const b = FZ.BAIT[id]; if (!b) return 0; return b.lure ? (st.lures[id] || 0) : (st.inv[id] || 0); };
  G.availableBaits = function (mode) { return FZ.BAITS.filter((b) => b.m.indexOf(mode) >= 0 && G.baitLeft(b.id) > 0); };
  G.setBait = function (id) { G.loadout().bait = id; G.save(); emit("gear"); };
  G.setDepth = function (d) { G.loadout().depth = d; G.save(); emit("gear"); };
  G.setDrag = function (v) { st.drag = U.clamp(v, 0.3, 1); G.save(); };
  G.setActive = function (mode) {
    if (!st.load[mode] || !st.load[mode].rod) return false;
    if (mode === "ice") return false;
    st.active = mode; G.save();
    if (sess && !sess.ice) { sess.mode = mode; resetRig(); emit("gear"); }
    return true;
  };
  G.owned = function (kind, id) {
    if (kind === "rod") return st.rods.indexOf(id) >= 0;
    if (kind === "line") return st.lines.indexOf(id) >= 0;
    if (kind === "hook") return st.hooks.indexOf(id) >= 0;
    if (kind === "extra") return !!st.extras[id];
    return false;
  };
  G.buy = function (kind, id) {
    let item, price;
    if (kind === "rod") item = FZ.ROD[id]; else if (kind === "line") item = FZ.LINE[id]; else if (kind === "hook") item = FZ.HOOK[id];
    else if (kind === "bait") item = FZ.BAIT[id]; else if (kind === "gb") item = FZ.GROUNDBAIT; else if (kind === "extra") item = FZ.EXTRAS[id];
    if (!item) return "нет товара";
    price = item.price;
    if (st.lvl < (item.lvl || 1)) return "нужен уровень " + item.lvl;
    if (st.money < price) return "не хватает денег";
    st.money -= price;
    if (kind === "rod" && item.type === "spin" && !FZ.BAITS.some((x) => x.m[0] === "spin" && st.lures[x.id] > 0)) st.lures.spinner = 1; // вертушка в подарок к первому спиннингу
    if (kind === "rod") { st.rods.push(id); const L = st.load[item.type]; if (!L.rod || FZ.ROD[L.rod].price < price) L.rod = id; if (item.type !== "ice" && !st.load[st.active].rod) st.active = item.type; }
    else if (kind === "line") { st.lines.push(id); Object.keys(st.load).forEach((m) => { if (FZ.LINE[st.load[m].line].test < item.test && m !== "float") st.load[m].line = id; }); if (FZ.LINE[st.load.float.line].test < item.test && item.test <= 5) st.load.float.line = id; }
    else if (kind === "hook") st.hooks.push(id);
    else if (kind === "bait") { if (item.lure) st.lures[id] = (st.lures[id] || 0) + 1; else addInv(id, item.pack); autoBait(); }
    else if (kind === "gb") addInv("gb", item.pack);
    else if (kind === "extra") st.extras[id] = true;
    // если у снасти не было наживки — поставить
    autoBait();
    G.save(true); emit("gear"); emit("money");
    return true;
  };
  function autoBait() {
    Object.keys(st.load).forEach(function (m) {
      const L = st.load[m];
      if (!L.bait || G.baitLeft(L.bait) <= 0 || FZ.BAIT[L.bait].m.indexOf(m) < 0) {
        const av = G.availableBaits(m); L.bait = av.length ? av[0].id : null;
      }
    });
  }
  G.equip = function (mode, slot, id) { st.load[mode][slot] = id; G.save(); emit("gear"); if (sess && sess.mode === mode && rig.state !== "fight") resetRig(); };

  FZ.EXTRAS = {
    echo: { id: "echo", n: "Эхолот", note: "показывает глубину и рыбу под лункой и в точке заброса", price: 3500, lvl: 5 },
    gaff: { id: "gaff", n: "Багорик", note: "помогает вытащить крупную рыбу через лунку", price: 800, lvl: 6 },
    auger: { id: "auger", n: "Ледобур 150 мм", note: "бурит вдвое быстрее, в лунку пролезает рыба крупнее", price: 4500, lvl: 9 },
    expBag: { id: "expBag", n: "Экспедиционный рюкзак", note: "увеличивает вместимость экспедиции с 10 до 16 трофеев", price: 6500, lvl: 10 },
    tent: { id: "tent", n: "Экспедиционная палатка", note: "увеличивает награду за возвращение из экспедиции на 25%", price: 4800, lvl: 12 }
  };

  // ---------- Сессия рыбалки ----------
  G.startSession = function (locId, seasonPick) {
    if (seasonPick !== undefined) st.seasonPick = seasonPick;
    const trip = st.expedition;
    const loc = FZ.LOC[trip && trip.active ? trip.locId : (locId || st.loc)];
    st.loc = loc.id;
    const season = G.season();
    if(FZ.Assets && FZ.Assets.ensure)FZ.Assets.ensure("bg/"+loc.id+"_"+season);
    const now = new Date();
    sess = {
      loc, season, ice: G.isFrozen(loc, season), firstIce: Wd.firstIceActive(season) && G.isFrozen(loc, season), mode: G.modeFor(season, loc),
      hour: now.getHours() + now.getMinutes() / 60,
      wx: Wd.weather(loc.id, season), spots: [], fedSpot: null, gbUntil: 0, t: 0, catches: 0,
      hole: null, nextSpot: 3, lastAim: null
    };
    sess.period = FZ.Scene.period(sess.hour, season);
    autoBait();
    if (sess.ice && !st.load.ice.rod) sess.noIceRod = true;
    resetRig();
    G.save(true);
    emit("session");
    return sess;
  };
  G.endSession = function () { sess = null; rig = null; };

  // ---------- Экспедиции ----------
  G.startExpedition = function (locId, days) {
    const loc = FZ.LOC[locId];
    const trip = st.expedition;
    if (!loc || !loc.expedition) return "Это место не подходит для экспедиции";
    if (trip.active) return "Вы уже в экспедиции";
    if (st.lvl < loc.lvl) return "Нужен уровень " + loc.lvl;
    if (rig && (rig.state === "fight" || rig.state === "landing" || rig.state === "result")) return "Сначала закончим текущую рыбалку";
    days = U.clamp(Math.round(days || 3), 1, 3);
    const cost = days * 250;
    if (st.money < cost) return "Для экспедиции нужно " + U.money(cost);
    trip.active = true; trip.locId = locId; trip.homeLoc = st.loc;
    trip.homeSeason = G.season(); trip.daysTotal = days; trip.daysLeft = days;
    trip.daysSpent = 0; trip.provisions = days; trip.bagUsed = 0; trip.bagCapacity = st.extras.expBag ? 16 : 10;
    trip.catches = 0; trip.best = 0; trip.event = U.rand.pick(Wd.EXPEDITION_EVENTS); trip.completed = false;
    st.money -= cost; st.loc = locId;
    G.startSession(locId, trip.homeSeason);
    emit("expedition", { started: true, loc });
    G.save(true);
    return true;
  };
  G.returnExpedition = function () {
    const trip = st.expedition;
    if (!trip.active) return 0;
    const days = trip.daysSpent;
    const rewardBase = days * 180 + trip.catches * 35 + trip.best * 55 + trip.bagUsed * 50;
    const reward = Math.round(rewardBase * (st.extras.tent ? 1.25 : 1));
    const home = trip.homeLoc || "pond", season = trip.homeSeason;
    st.money += reward; st.expeditionsCompleted++;
    trip.active = false; trip.locId = null; trip.daysLeft = 0; trip.provisions = 0; trip.event = null; trip.completed = false;
    st.loc = home;
    G.startSession(home, season);
    checkAchievements();
    G.save(true);
    emit("expedition", { returned: true, reward });
    return reward;
  };
  function expeditionDayPassed() {
    const trip = st.expedition;
    if (!trip.active || trip.completed) return;
    trip.daysSpent++;
    trip.provisions = Math.max(0, trip.provisions - 1);
    trip.daysLeft = Math.max(0, trip.daysTotal - trip.daysSpent);
    trip.event = U.rand.pick(Wd.EXPEDITION_EVENTS);
    if (trip.daysLeft === 0) {
      trip.completed = true;
      emit("expedition", { completed: true, event: trip.event });
    } else {
      emit("expedition", { dayPassed: true, daysLeft: trip.daysLeft, event: trip.event });
    }
    G.save(true);
  }

  // ---------- Достижения ----------
  G.achievementProgress = function (def) { return Wd.achievementValue(def.stat, st); };
  function checkAchievements() {
    Wd.ACHIEVEMENTS.forEach(function (a) {
      const current = G.achievementProgress(a);
      if (current >= a.need && !st.achievements[a.id]) {
        st.achievements[a.id] = { unlocked: true, claimed: false, date: U.dayKey() };
        emit("achievement", { achievement: a });
      }
    });
  }
  G.claimAchievement = function (id) {
    const a = Wd.ACHIEVEMENTS.find((x) => x.id === id);
    const saved = st.achievements[id];
    if (!a || G.achievementProgress(a) < a.need || !saved || saved.claimed) return 0;
    saved.claimed = true;
    st.money += a.reward;
    G.addXP(Math.round(a.reward / 8));
    G.save(true);
    return a.reward;
  };

  function resetRig() {
    rig = { state: sess && sess.ice ? "nohole" : "idle", X: 0, Z: 10, fa: { sink: 0, tilt: 0, bob: 0, dx: 0 }, rod: { bend: 0, tension: 0, tilt: 0, jerk: 0, nod: 0, reelAngle: 0, reelRate: 0, ring: 0 },
      bite: null, fish: null, reeling: false, tilt: 0, still: 0, idleT: 0, jig: 0, jigPause: 3, jigCooldown: 0, landing: null, msgT: 0 };
    if (sess && sess.ice && sess.hole) { rig.state = "wait"; rig.lure = sess.hole.lure; }
  }

  // Время суток
  G.skipTo = function (period) {
    const st2 = FZ.Scene.sunTimes(sess.season);
    const target = { dawn: st2[0] + 0.4, day: (st2[0] + st2[1]) / 2 - 1, dusk: st2[1] - 1, night: (st2[1] + 2.5) % 24 }[period];
    const waitedHours=(target-sess.hour+24)%24;
    sess.weatherAge=(sess.weatherAge||0)+waitedHours*75;
    const front=Math.floor(sess.weatherAge/150);
    if(front>(sess.weatherFront||0)){sess.weatherFront=front;sess.wx=Wd.front(sess.loc.id,sess.season,front,sess.wx);}
    sess.hour = (target + 24) % 24;
    sess.period = FZ.Scene.period(sess.hour, sess.season);
    emit("time");
  };

  // ---------- Заброс ----------
  G.maxCast = function () { const g = G.gear(sess.mode); return Math.min(g.rod ? g.rod.cast : 10, sess.loc.zfar - 6); };
  G.aimClamp = function (X, Z) {
    const zMax = G.maxCast();
    const z = U.clamp(Z, 4.5, zMax);
    const lat = FZ.Scene.maxLat(z);
    return { X: U.clamp(X, -lat, lat), Z: z, ok: Z <= zMax + 0.5 && Z >= 4 };
  };
  G.depthAt = function (X, Z) {
    const d = sess.loc.depth, k = U.smooth(U.clamp(Z / (sess.loc.zfar * 0.75), 0, 1));
    const n = Math.sin(X * 0.4 + Z * 0.23) * 0.3 + Math.sin(Z * 0.7) * 0.15;
    return Math.max(0.5, d[0] + (d[1] - d[0]) * k + n * (d[1] - d[0]) * 0.15);
  };
  G.canFish = function () {
    const g = G.gear(sess.mode);
    if (!g.rod) return "Нет удочки для этого способа";
    if (!g.bait || G.baitLeft(g.bait.id) <= 0) return sess.mode === "spin" ? "Нет приманки — купите вертушку или воблер" : "Закончилась наживка";
    return true;
  };
  G.cast = function (X, Z) {
    if (rig.state !== "idle") return false;
    const ok = G.canFish(); if (ok !== true) { emit("need", { what: ok }); return false; }
    const a = X == null ? (sess.lastAim || { X: 0, Z: G.maxCast() * 0.65 }) : G.aimClamp(X, Z);
    const g = G.gear(sess.mode);
    // The wind only nudges the landing point; tutorial aim stays predictable.
    const fromWest = { "З": 1, "ЮЗ": 0.7, "СЗ": 0.7, "В": -1, "ЮВ": -0.7, "СВ": -0.7 };
    const wind = st.tut < 3 ? 0 : (sess.wx.wind || 0) / 11 * (fromWest[sess.wx.dir] || 0);
    const sc = 0.04 * a.Z;
    rig.Z = U.clamp(a.Z + U.rand.range(-sc, sc), 4.5, G.maxCast());
    const maxLat = FZ.Scene.maxLat(rig.Z);
    rig.X = U.clamp(a.X + U.rand.range(-sc, sc) + wind * Math.min(1.3, a.Z * 0.025), -maxLat, maxLat);
    sess.lastAim = { X: a.X, Z: a.Z };
    rig.state = "fly"; rig.flyT = 0; rig.castAt = sess.t;
    rig.flyFrom = { X: 0, Z: 4.5 }; rig.flyWind = wind;
    rig.flyDur = (0.38 + 0.12 * Math.sqrt(a.Z)) * (sess.mode === "feeder" ? 1.10 : sess.mode === "spin" ? 0.94 : 1);
    rig.rod.jerk = 0.42;
    rig.bite = null; rig.still = 0; rig.spinPause = 0; rig.lureDepth=null;rig.lureSpeed=0;rig.twitch=0;
    rig.fa = { sink: 0.6, tilt: 0.9, bob: 0, dx: 0 };
    FZ.Sound.cast(); emit("cast");
    if (sess.mode === "feeder" && (st.inv.gb || 0) > 0) { st.inv.gb--; feedSpot(rig.X, rig.Z, 0.22); }
    return true;
  };
  function feedSpot(X, Z, add) {
    const f = sess.fedSpot;
    if (f && Math.hypot(f.X - X, f.Z - Z) < 3.5) { f.level = Math.min(1, f.level + add); f.X = U.lerp(f.X, X, 0.3); f.Z = U.lerp(f.Z, Z, 0.3); }
    else sess.fedSpot = { X, Z, level: add };
    sess.fedSpot.until = sess.t + 240;
  }
  G.throwGroundbait = function () {
    if ((st.inv.gb || 0) <= 0) return "Нет прикормки";
    if (sess.ice) { st.inv.gb--; sess.gbUntil = sess.t + 180; FZ.Scene.chips(FZ.Scene.holeGeom().x, FZ.Scene.holeGeom().y, 6); emit("gb"); G.save(); return true; }
    const p = rig.state === "wait" || rig.state === "settle" ? { X: rig.X, Z: rig.Z } : (sess.lastAim || { X: 0, Z: 10 });
    st.inv.gb--; feedSpot(p.X, p.Z, 0.45); sess.gbUntil = sess.t + 180;
    FZ.Scene.splash(p.X, p.Z, 0.5, "rgba(190,160,110,0.9)"); FZ.Sound.plop(true);
    emit("gb"); G.save();
    return true;
  };
  G.retrieve = function () {
    if (rig.state === "wait" || rig.state === "settle" || rig.state === "bite") {
      if (rig.state === "bite") rig.bite = null;
      rig.state = "idle"; FZ.Sound.reel(2); emit("retrieve");
    }
  };

  // ---------- Лёд ----------
  G.drill = function () {
    if (!sess.ice || rig.state === "drill" || rig.state === "fight" || rig.state === "landing") return;
    if (!st.load.ice.rod) { emit("need", { what: "Нужна зимняя удочка — купите в «Снастях»" }); return; }
    rig.state = "drill"; rig.drillT = 0; rig.drillDur = st.extras.auger ? 1.3 : 2.4; rig.bite = null;
    FZ.Sound.drill(rig.drillDur);
  };
  function finishDrill() {
    const id = Math.floor(U.rand() * 1e6);
    const r = U.rng(id);
    const d = sess.loc.depth;
    sess.hole = { id, depth: +(U.lerp(d[0] + 0.5, d[1] * 0.8, r()) ).toFixed(1), fish: U.clamp(r.range(0.2, 1.7), 0.15, 1.7), lure: 0.85 };
    rig.state = "wait"; rig.lure = 0.85; rig.still = 0; rig.castAt = sess.t; rig.jig = 0; rig.jigPause = 3;
    FZ.Scene.chips(FZ.Scene.holeGeom().x, FZ.Scene.holeGeom().y, 26);
    emit("hole", { depth: sess.hole.depth });
  }
  G.jig = function () {
    if (!sess.ice || rig.state !== "wait" || (rig.jigCooldown || 0) > 0) return;
    rig.jig = Math.min(1, (rig.jig || 0) * 0.55 + 0.48);
    rig.jigCooldown = 0.12; rig.jigPause = 0;
    rig.rod.nod = -0.48; rig.still = 0;
  };
  G.setLure = function (k) { if (sess.hole) { sess.hole.lure = U.clamp(k, 0.05, 1); rig.lure = sess.hole.lure; } };

  // ---------- Поклёвка ----------
  function zoneNow() {
    const g = G.gear(sess.mode);
    if (sess.mode === "feeder") return "bottom";
    if (sess.mode === "spin") {
      if(rig.lureDepth!=null){const k=rig.lureDepth/Math.max(.5,G.depthAt(rig.X,rig.Z));return k>.72?"bottom":k>.24?"mid":"top";}
      return g.bait && g.bait.lure ? g.bait.lure : "mid";
    }
    if (sess.mode === "ice") { const k = rig.lure || 0.8; return k > 0.75 ? "bottom" : k > 0.3 ? "mid" : "top"; }
    return g.depth || "bottom";
  }
  const EDGE_FISH = { pike: 1, tench: 1, rudd: 1, crucian: 1, gcrucian: 1, rotan: 1, perch: 1, chub: 1, brooktrout: 1 };
  const DEEP_FISH = { bream: 1, zander: 1, catfish: 1, burbot: 1, sturgeon: 1, carp: 1, wildcarp: 1, whitefish: 1, omul: 1, palia: 1, nase: 1, sterlet: 1 };
  const RARF = [1, 1, 0.85, 0.6, 0.35, 0.18];
  G.biteTable = function () {
    const g = G.gear(sess.mode), loc = sess.loc, wx = sess.wx;
    const bait = g.bait ? g.bait.id : null;
    const zone = zoneNow();
    const lat = FZ.Scene.maxLat(rig.Z);
    const edge = !sess.ice && Math.abs(rig.X) > lat * 0.62;
    const deep = !sess.ice && rig.Z > loc.zfar * 0.45;
    let sumW = 0; Object.keys(loc.fish).forEach((id) => (sumW += loc.fish[id]));
    const list = [];
    Object.keys(loc.fish).forEach(function (id) {
      const s = FZ.SP[id];
      let m = s.season[sess.season] * s.time[sess.period] * (s.kind === "pred" ? wx.pred : wx.peace);
      if (sess.firstIce && (id === "perch" || id === "palia" || id === "whitefish" || id === "roach" || id === "smelt")) m *= 1.35;
      const tripEvent = st.expedition.active && st.expedition.event;
      if (tripEvent && (tripEvent.kind === "all" || tripEvent.kind === s.kind)) m *= tripEvent.multiplier;
      m *= (s.methods[sess.mode] || 0);
      m *= bait ? (s.baits[bait] || (FZ.BAIT[bait].lure ? 0.03 : 0.06)) : 0;
      m *= s.depth[zone];
      if (edge && EDGE_FISH[id]) m *= 1.35;
      if (deep && DEEP_FISH[id]) m *= 1.3;
      if (s.kind === "peace") {
        m *= 1 - 0.05 * g.line.vis;
        if (sess.fedSpot && Math.hypot(sess.fedSpot.X - rig.X, sess.fedSpot.Z - rig.Z) < 4) m *= 1 + sess.fedSpot.level;
        if (sess.gbUntil > sess.t) m *= 1.35;
      }
      sess.spots.forEach(function (sp) {
        if (Math.hypot(sp.X - rig.X, sp.Z - rig.Z) < 3) { if (sp.type === "bubbles" && s.kind === "peace") m *= 2; if (sp.type === "boil" && s.kind === "pred") m *= 2.6; }
      });
      if (sess.ice) {
        m *= sess.hole ? sess.hole.fish : 1;
        m *= FZ.FightPhysics.iceAttraction(s, rig.jig, rig.jigPause);
      }
      if (sess.mode === "spin") { m *= (rig.lureAttraction || 1) * (rig.spinPause > 2.5 ? (zone === "bottom" ? 0.8 : 0.25) : 1); }
      if (sess.mode === "float" && sess.wx.wind >= 8) m *= 0.8;
      m *= RARF[s.rar];
      // Mild activity pressure prevents long empty spells, but never forces
      // bites on a timer or makes incompatible bait attract fish.
      const activity = 1 + 0.55 * U.clamp((rig.idleT - 18) / 30, 0, 1);
      if (m > 0) list.push([s, 0.1 * loc.fish[id] / sumW * m * activity]);
    });
    return list;
  };
  function sampleWeight(s) {
    const g = G.gear(sess.mode);
    const hookBias = [0.8, 1, 1.25, 1.6][(g.hook ? g.hook.size : 2) - 1];
    const baitBias = g.bait && g.bait.big ? g.bait.big : 1;
    const bias = Math.pow(hookBias * baitBias * (1 + Math.min(0.12, st.karma * 0.003)), 0.6);
    let w;
    if (U.rand() < 0.004 + Math.min(0.006, st.karma * 0.0002)) w = s.trophy * U.rand.range(1.05, Math.max(1.1, s.max / s.trophy));
    else w = s.med * Math.exp(s.sigma * U.rand.normal()) * bias;
    if (sess.loc.id === "platnik" && (s.id === "carp" || s.id === "grasscarp" || s.id === "sturgeon" || s.id === "trout")) w *= 1.1;
    return U.clamp(w, s.min, s.max);
  }
  function startBite(s, w, empty) {
    const pattern = FZ.FightPhysics.bitePattern(s, sess.mode, w);
    const g = G.gear(sess.mode);
    let take = pattern.take * (g.rod ? g.rod.sens : 1) * (sess.period === "night" ? 0.97 : 1);
    if (st.tut < 3) take *= 2.2;
    rig.bite = {
      s, w, style: pattern.style, power: pattern.power, cadence: pattern.cadence,
      phase: "touch", t: 0,
      touches: empty ? U.rand.int(2, 3) : U.rand.int(pattern.touches[0], pattern.touches[1]),
      nextTouch: U.rand.range(0.12, 0.48), take, empty: !!empty, early: false
    };
    rig.state = "bite";
  }
  function biteTick(dt) {
    const b = rig.bite;
    b.t += dt;
    if (b.phase === "touch") {
      b.nextTouch -= dt;
      if (b.nextTouch <= 0) {
        if (b.touches > 0) {
          b.touches--; b.nextTouch = U.rand.range(0.65, 1.35) * b.cadence;
          b.touchAnim = 0.35;
          touchFx(b);
        } else if (b.empty) { // мелочь поклевала и ушла
          rig.bite = null; rig.state = "wait";
        } else {
          b.phase = "take"; b.t = 0; takeFx(b);
          emit("take");
        }
      }
      if (b.touchAnim > 0) b.touchAnim -= dt;
    } else if (b.phase === "take") {
      // A clear sustained retrieve can set the hook; avoid opaque RNG misses.
      if (sess.mode === "spin" && rig.reeling && b.t > 0.24) { hook(b.s, b.w); emit("msg", { text: "Самозасечка на проводке!" }); return; }
      if (b.t > b.take) {
        // не успели
        const eaten = U.rand() < 0.5;
        rig.bite = null;
        if (eaten && !G.gear(sess.mode).bait.lure) { useBait(); rig.state = sess.ice ? "wait" : "idle"; emit("msg", { text: "Наживку объели", bad: true }); }
        else { rig.state = "wait"; emit("msg", { text: "Пропустили поклёвку", bad: true }); }
      }
    }
  }
  function touchFx(b) {
    const power = b.power || 0.4;
    if (sess.mode === "feeder") { rig.rod.jerk = 0.10 + power * 0.22; rig.rod.ring = 0.4 + power; FZ.Sound.bite(); }
    else if (sess.mode === "spin") { rig.rod.jerk = 0.25 + power * 0.3; FZ.Platform.vibrate(12); FZ.Sound.bite(); }
    else if (sess.mode === "ice") { rig.rod.nod = b.style === "lift" ? -power * 0.45 : power * 0.55; FZ.Sound.bite(); }
    else { FZ.Scene.ring(rig.X, rig.Z, 0.12 + power * 0.25, 0.85); FZ.Sound.bite(); }
  }
  function takeFx(b) {
    FZ.Platform.vibrate(30);
    if (sess.mode === "feeder") { rig.rod.ring = 1.2 + b.power; rig.rod.jerk = 0.5 + b.power * 0.4; FZ.Sound.bell(); }
    else if (sess.mode === "spin") { rig.rod.jerk = 0.65 + b.power * 0.6; FZ.Sound.strike(); FZ.Scene.shake(4); }
    else if (sess.mode === "ice") { rig.rod.nod = b.style === "lift" ? -1 : 1; FZ.Sound.bite(); }
    else { FZ.Scene.ring(rig.X, rig.Z, 0.28 + b.power * 0.25, 1.2); FZ.Sound.bite(); }
  }
  // Анимация поплавка/кивка/вершинки во время поклёвки
  function biteAnim(dt, t) {
    const fa = rig.fa, b = rig.bite, rod = rig.rod;
    let sink = 0, tilt = 0, dx = 0, nod = 0, tipBend = sess.mode === "feeder" ? 0.28 : 0;
    if (b) {
      const ta = b.touchAnim > 0 ? Math.sin((0.35 - b.touchAnim) / 0.35 * Math.PI) : 0;
      const strength = b.power || 0.4;
      if (b.phase === "touch") {
        if (b.style === "lay" || b.style === "lift") sink = -0.38 * strength * ta;
        else sink = 0.45 * strength * ta;
        dx = (b.style === "slide" ? 4 * strength : 0) * ta;
        nod = (b.style === "lay" || b.style === "lift" ? -0.65 : 0.9) * strength * ta;
        tipBend += 0.32 * strength * ta;
      } else {
        const k = U.clamp(b.t / Math.min(0.35, b.take * 0.3), 0, 1);
        switch (b.style) {
          case "twitch": case "dunk": sink = U.lerp(0, 1.05, k); dx = Math.sin(t * 20) * 1.5; break;
          case "lay": sink = -0.65 * k; tilt = U.clamp((b.t - b.take * 0.25) / (b.take * 0.3), 0, 1); dx = tilt * 8; break;
          case "slide": sink = 0.45 * k; dx = U.lerp(0, 22, U.clamp(b.t / b.take, 0, 1)); break;
          case "drag": sink = U.lerp(0, 1.1, k); dx = U.lerp(0, 16, U.clamp(b.t / b.take, 0, 1)); break;
          case "lift": sink = -0.72 * k; break;
          case "dip": sink = 0.92 * k; break;
          case "spin": sink = 0.35 * k; break;
        }
        nod = (b.style === "lay" || b.style === "lift" ? -1.15 : 1.1) * k;
        tipBend = b.style === "lay" && sess.mode === "feeder" ? U.lerp(0.28, -0.05, k) : U.lerp(tipBend, 1, k);
      }
    }
    if (!b && sess.ice) nod = -0.36 * (rig.jig || 0);
    fa.sink = U.damp(fa.sink, sink, 14, dt); fa.tilt = U.damp(fa.tilt, tilt, 10, dt); fa.dx = U.damp(fa.dx, dx, 8, dt);
    rod.nod = U.damp(rod.nod, nod, 16, dt);
    if (rig.state !== "fight") rod.bend = U.damp(rod.bend, tipBend, 12, dt);
  }

  // ---------- Подсечка ----------
  G.strike = function () {
    if (rig.state === "bite") {
      const b = rig.bite;
      FZ.Sound.strike();
      if (b.phase === "touch") {
        rig.bite = null; rig.state = "wait";
        if (b.empty) { emit("msg", { text: "Мелочь балуется", bad: true }); return; }
        if (U.rand() < 0.55) emit("msg", { text: "Рано! Рыба ушла", bad: true });
        else { emit("msg", { text: "Рано подсекли", bad: true }); startBite(b.s, b.w); rig.bite.touches = 1; rig.bite.nextTouch = 1.4; }
        return;
      }
      const g = G.gear(sess.mode);
      const timing = 1 - Math.abs(b.t / b.take - (b.style === "lay" ? 0.6 : 0.35));
      const p = U.clamp(0.86 * (g.hook ? g.hook.hold : 1) + 0.1 * timing + (st.tut < 3 ? 1 : 0), 0.4, 0.98);
      if (U.rand() < p) { hook(b.s, b.w); }
      else { rig.bite = null; rig.state = "wait"; emit("msg", { text: "Не засеклась", bad: true }); }
    } else if (rig.state === "wait" && sess.mode !== "spin") {
      FZ.Sound.strike(); rig.rod.jerk = 0.6; emit("msg", { text: "Пустая подсечка" });
    }
  };

  function hook(s, w) {
    const lenCm = Math.round(Math.pow(w / s.lwA, 1 / 3));
    const Fmax = s.fight.power * (0.6 + 1.2 * Math.pow(w, 0.75));
    if(FZ.Fish3D)FZ.Fish3D.ready(s);
    rig.state = "fight";
    rig.bite = null;
    rig.fish = {
      s, w, lenCm, lenM: lenCm / 100, hooked: true, X: rig.X, Z: sess.ice ? 0 : rig.Z, D: sess.ice ? (sess.hole.depth * (rig.lure || 0.8)) : 0,
      vx: 0, vz: 0, turn: 1, S: 1, effort: 0.9, phase: "run", phaseT: U.rand.range(0.8, 1.6), T: Fmax * 0.6, Fmax, slackT: 0, snagT: 0,
      surface: 0, jump: null, chance: 0, jumped: 0, t: 0
    };
    rig.fish.turn = sess.ice ? 0 : (U.rand() < 0.5 ? -1 : 1);
    FZ.Scene.shake(5); FZ.Platform.vibrate(40);
    if (!sess.ice) FZ.Scene.splash(rig.X, rig.Z, 0.25 + Math.min(1, w / 5) * 0.5);
    emit("hooked", { big: Fmax > G.gear(sess.mode).line.test * 0.75 || w >= s.trophy });
  }

  // ---------- Вываживание ----------
  function fightTick(dt, t) {
    const f = rig.fish, s = f.s, g = G.gear(sess.mode);
    const rod = g.rod, line = g.line;
    const lineT = line.test, dragLim = st.drag * lineT;
    f.t += dt;
    // Location current influences the fish and rod loading.
    // Lightweight fish are carried more strongly by the flow.
    const flow=sess.ice?0:(sess.loc.current||0);
    const currentLoad=Math.max(0,flow-.25)*(.045+.035/Math.max(.5,Math.sqrt(f.w)));
    // Species have distinct rhythms without duplicating the fighting system.
    const character = FZ.FightPhysics.character(s);
    if (FZ.FightPhysics.secondWind(s, f, f.Z, sess.ice)) {
      f.phase = "rest"; f.phaseT = 0.85; f.nextDecision = 0; f.effort = 0.12;
      emit("msg", { text: "Карп собирается с силами — ждите новый рывок!" });
    }
    // смена поведения
    f.phaseT -= dt;
    const runChance = FZ.FightPhysics.runChance(s, f, f.Z, sess.ice);
    // A readable tell before a burst gives the player time to release the reel.
    if (f.phaseT <= .45 && f.nextDecision == null) f.nextDecision = U.rand();
    f.telegraph = f.phaseT > 0 && f.phaseT < .45 && f.nextDecision < runChance && f.S > .25;
    if (f.phaseT <= 0 || (f.jump && f.jump.k >= 1)) {
      if (f.jump && f.jump.k >= 1) { f.jump = null; if (!sess.ice) FZ.Scene.splash(f.X, f.Z, 0.6 + Math.min(1, f.w / 5)); FZ.Sound.splash(0.8); }
      const r = f.nextDecision == null ? U.rand() : f.nextDecision;
      f.nextDecision = null; f.telegraph = false;
      const runP = FZ.FightPhysics.runChance(s, f, f.Z, sess.ice);
      if (f.S < 0.16) { f.phase = "tired"; f.effort = 0.14; f.phaseT = U.rand.range(1.2, 2.5); f.vx *= 0.5; }
      else if (r < runP) {
        f.phase = "run"; f.effort = U.rand.range(0.85, 1); f.phaseT = U.rand.range(1, 2.4) * (0.8 + 0.3 * Math.log10(1 + f.w)) * character.duration;
        f.turn = sess.ice ? 0 : (U.rand() < 0.5 ? -1 : 1);
        if (rig.reeling) f.surge = Math.max(f.surge || 0, 0.26 * character.surge); // smoothed run load
        if (!sess.ice && s.fight.jump > 0 && f.Z < 30 && U.rand() < s.fight.jump * (0.4 + f.S * 0.6) && f.jumped < 3) {
          f.jump = { k: 0, dur: 0.95, dir: f.vx > 0 ? -1 : 1, hurt: false }; f.jumped++;
          FZ.Scene.splash(f.X, f.Z, 0.7); FZ.Sound.splash(1); emit("jump");
        }
        FZ.Scene.shake(2 + Math.min(6, f.Fmax)); FZ.Platform.vibrate(25);
      } else if (r < runP + 0.16 && f.S > 0.25) { f.phase = "toward"; f.effort = -0.3; f.phaseT = U.rand.range(0.8, 1.8); }
      else if (r < runP + 0.16 + s.fight.shake * 0.35) { f.phase = "shake"; f.effort = 0.62; f.phaseT = U.rand.range(0.6, 1.1); }
      else { f.phase = "rest"; f.effort = U.rand.range(0.28, 0.45); f.phaseT = U.rand.range(1, 2.4); }
    }
    if (f.jump) f.jump.k += dt / f.jump.dur;
    let eff = f.effort * (0.35 + 0.65 * f.S);
    if (f.phase === "shake") eff *= 1 + 0.45 * Math.sin(t * 28);
    // Fish muscles accelerate and relax with inertia, scaled by fish mass.
    const mass = Math.max(0.4, Math.pow(f.w, 0.38));
    const burst = f.phase === "run" ? 0.15 * Math.sin(f.t * (8 + 2 / mass)) : 0;
    const targetEffort = Math.max(0, eff * (1 + burst));
    f.muscle = U.damp(f.muscle == null ? targetEffort : f.muscle, targetEffort, 3.2 / mass + 2, dt);
    const fishPull = f.Fmax * f.muscle;
    f.surge = U.damp(f.surge || 0, 0, 3.5, dt);
    // Both axes have acceleration and water damping. Steering resists runs.
    FZ.FightPhysics.swim(f, { phase: f.phase, effort: f.muscle, ice: sess.ice, tilt: rig.tilt, character }, dt);
    const lineMotion = FZ.FightPhysics.line(f, {
      rod, lineTest: lineT, drag: st.drag, fishPull, phase: f.phase,
      currentLoad, surge: f.surge, reeling: rig.reeling, tutorial: st.tut < 3,
      jumping: !!(f.jump && f.jump.k < 1), jumpProgress: f.jump ? f.jump.k : 0
    }, dt);
    if (lineMotion.slipping) FZ.Sound.drag(U.clamp(lineMotion.excess / lineT, 0, 1));
    // A revived fish needs a brief recovery after the broken-line/ad handoff;
    // stale high tension must not snap the line before the player can react.
    if (f.reviveGrace > 0) {
      f.reviveGrace = Math.max(0, f.reviveGrace - dt);
      f.T = Math.min(f.T, lineT * 0.75);
    }
    if (f.T > lineT) return lose("snap");
    const intake = lineMotion.intake;
    // The fish moves along the line when the drag pays out; a taut line
    // restrains outward travel until it slips. Ice fights use vertical depth.
    if (sess.ice) f.D += (f.vz * (lineMotion.slipping ? 0.45 : 0.12) + lineMotion.slipSpeed * 0.5) * dt;
    else f.Z += (f.vz > 0 ? f.vz * (st.tut < 3 ? 0.06 : (lineMotion.slipping ? 1 : 0.18)) : f.vz) * dt + lineMotion.slipSpeed * dt;
    rig.rod.reelRate=rig.reeling ? intake/Math.max(.1,rod.reel) : 0;
    rig.rod.slipAngle=(rig.rod.slipAngle||0)+lineMotion.slipSpeed*dt*9;
    if(intake>0) {
      if(sess.ice) f.D-=intake*.55*dt; else f.Z-=intake*dt;
      FZ.Sound.reel(rod.reel);
    }
    // поперёк
    if (!sess.ice) {
      // Hydrodynamic drag increases with lateral velocity.
      const waterDrag = 0.12 + 0.085 * Math.abs(f.vx) / Math.max(0.5, Math.pow(f.w, 0.2));
      f.X += (f.vx + flow * .13 * Math.sin(t * .34 + f.X * .2)) * dt;
      f.vx *= Math.exp(-waterDrag * dt * 0.35);
      const lat = FZ.Scene.maxLat(Math.max(f.Z, 5));
      if (Math.abs(f.X) > lat) { f.snagT += dt; f.X = Math.sign(f.X) * lat; if (f.snagT > 0.4 && f.snagT - dt <= 0.4) emit("msg", { text: "Уходит в траву! Ведите удилище в другую сторону", bad: true }); }
      else f.snagT = Math.max(0, f.snagT - dt * 2);
      // Beginner protection: the tutorial fish should teach steering, not end
      // in a random snag while the player is learning the reel control.
      // After the first resolved catch normal reed/snag physics is unchanged.
      if (st.tut < 3 && f.snagT > 0.7) {
        const edgeSign = Math.sign(f.X) || 1;
        f.X = edgeSign * lat * 0.68;
        f.vx = -edgeSign * Math.max(0.5, Math.min(1.1, Math.abs(f.vx) * 0.55));
        f.snagT = 0;
        emit("msg", { text: "Рыба у травы! Ведите удилище от берега" });
      }
      if (f.snagT > 2.4 && f.w >= 0.3 && (EDGE_FISH[s.id] || f.Fmax > rod.power)) return lose("snag");
    }
    const against = !sess.ice && Math.abs(rig.tilt) > 0.25 && Math.sign(rig.tilt) === -Math.sign(f.vx) && Math.abs(f.vx) > 0.15;
    f.against = against;
    const pressure = U.clamp(f.T / lineT, 0, 1);
    f.controlQuality = U.clamp(1 - Math.abs(pressure - .46) / .46, 0, 1);
    const control = st.tut < 3 ? 1 : .55 + f.controlQuality * .75;
    f.swimDepth = U.damp(f.swimDepth == null ? .7 : f.swimDepth,
      f.phase === 'run' ? G.depthAt(f.X, Math.max(4,f.Z)) * .70 : f.phase === 'tired' ? .08 : .55, 1.4, dt);
    // выносливость
    const rodF = U.clamp(rod.power * 1.5 / f.Fmax, 0.3, 1);
    const drain = (0.03 + 0.12 * U.clamp(f.T / f.Fmax, 0, 1.5)) / (s.fight.stamina * (0.5 + 0.5 * Math.sqrt(f.w))) * (against ? 1.4 : 1) * rodF * character.fatigue * (st.tut < 3 ? 2 : 1);
    f.S = Math.max(0, f.S - drain * control * dt);
    // провис лески — сход
    if (f.T < 0.07 * f.Fmax && f.phase !== "tired") f.slackT += dt; else f.slackT = Math.max(0, f.slackT - dt * 2);
    if (f.slackT > 1.3 && U.rand() < 0.7 * (1.3 - (g.hook ? g.hook.hold : 1)) * dt * 2) return lose("slack");
    if (f.jump && !f.jump.hurt && f.T > 0.45 * lineT) { f.jump.hurt = true; if (U.rand() < 0.5 * (1.3 - (g.hook ? g.hook.hold : 1))) return lose("jump"); }
    // поверхность
    f.surface = U.damp(f.surface, f.phase === "tired" ? 1 : 0.15 * (1 - f.S), 2, dt);
    // дистанция
    if (sess.ice) {
      if (f.D < 0.5) { if (f.S < 0.3) return startLanding(); f.D = 0.5; f.phase = "run"; f.phaseT = 0; }
      f.Z = 0;
    } else {
      if (f.Z < 3.6) { if (f.S < 0.3) return startLanding(); f.Z = 3.6; if (f.phase !== "run") { f.phaseT = 0; } }
      if (f.Z > 100) return lose("spool");
    }
    // для отрисовки
    // Spring-damped rod tip has visible inertia and recovery.
    const bendTarget = U.clamp(f.T / (rod.power * 1.1), 0, 1.4);
    rig.rod.bendVel = (rig.rod.bendVel || 0) + (bendTarget - rig.rod.bend) * 95 * dt;
    rig.rod.bendVel *= Math.exp(-13 * dt);
    rig.rod.bend = U.clamp(rig.rod.bend + rig.rod.bendVel * dt, 0, 1.5);
    rig.rod.tension = U.clamp(f.T / lineT, 0, 1);
    // Throttle haptics: 60 vibrations per second feels like electrical noise.
    f.warnCooldown = Math.max(0, (f.warnCooldown || 0) - dt);
    if (f.T > lineT * 0.82 && f.warnCooldown === 0) {
      FZ.Platform.vibrate(12);
      f.warnCooldown = 0.42;
    }
    f.tension = f.T / lineT; f.dragMark = st.drag;
  }

  function lose(why) {
    const f = rig.fish;
    const g = G.gear(sess.mode);
    const text = { snap: "Обрыв лески!", snag: "Рыба завела в траву — обрыв", slack: "Сход! Леска провисла", jump: "Сход на свечке!", spool: "Рыба смотала леску", hole: "Не пролезла в лунку" }[why];
    if (why === "snap" || why === "snag" || why === "spool") {
      FZ.Sound.snap(); FZ.Scene.shake(8); FZ.Platform.vibrate([60, 40, 60]);
      if (g.bait && g.bait.lure) { st.lures[g.bait.id] = Math.max(0, (st.lures[g.bait.id] || 1) - 1); autoBait(); emit("msg", { text: "Приманка «" + g.bait.n + "» потеряна", bad: true }); }
    } else FZ.Sound.fail();
    if (g.bait && !g.bait.lure) useBait();
    rig.lost = { f, why, canRevive: !f.revived };
    rig.fish = null; rig.state = sess.ice ? "wait" : "idle"; rig.rod.tension = 0;
    emit("lost", { text, why, fish: f });
    G.save();
  }
  // Второй шанс после рекламы: рыба снова на крючке
  G.revive = function () {
    if (!rig.lost || !rig.lost.canRevive) return false;
    const f = rig.lost.f;
    f.revived = true;
    f.T = Math.min(f.Fmax * 0.2, G.gear(sess.mode).line.test * st.drag * 0.55);
    f.muscle = 0; f.surge = 0; f.vz = 0; f.vx *= 0.3;
    f.reviveGrace = 1.2;
    f.phase = "rest"; f.phaseT = 1.5; f.slackT = 0; f.snagT = 0; f.jump = null;
    f.S = Math.min(f.S, 0.6); if (!sess.ice) f.X *= 0.6; f.Z = Math.min(f.Z, 40);
    rig.fish = f; rig.state = "fight"; rig.lost = null;
    emit("revived");
    return true;
  };

  function startLanding() {
    const f = rig.fish;
    if (sess.ice && f.w > (st.extras.auger ? 8 : 5) && !st.extras.gaff && U.rand() < 0.6) return lose("hole");
    rig.state = "landing"; rig.landing = { k: 0, duration: sess.ice || f.w < .35 ? .8 : 2.1 };
    FZ.Sound.splash(0.7);
    if (!sess.ice) FZ.Scene.splash(f.X, f.Z, 0.8); else FZ.Scene.chips(FZ.Scene.holeGeom().x, FZ.Scene.holeGeom().y - 10, 10);
  }
  function useBait() {
    const g = G.gear(sess.mode);
    if (!g.bait || g.bait.lure) return;
    st.inv[g.bait.id] = Math.max(0, (st.inv[g.bait.id] || 0) - 1);
    if (st.inv[g.bait.id] <= 0) { autoBait(); emit("msg", { text: "Наживка «" + g.bait.n + "» закончилась", bad: true }); emit("gear"); }
  }

  // ---------- Улов ----------
  function finishCatch() {
    const f = rig.fish; const s = f.s;
    useBait();
    const w = Math.round(f.w * 1000) / 1000;
    const trophy = w >= s.trophy;
    const rec = st.records[s.id];
    const res = {
      s, w, len: f.lenCm, trophy, record: !rec || w > rec.w, prevRecord: rec ? rec.w : 0, newSpecies: !st.caught[s.id],
      price: s.price > 0 ? Math.max(5, Math.round(s.price * w * (trophy ? 1.4 : 1))) : 0,
      xp: Math.round((8 + 25 * Math.pow(w, 0.6)) * [1, 1, 1.3, 1.7, 2.3, 3.2][s.rar] * (trophy ? 1.6 : 1)),
      mustRelease: !!s.release || !!(st.expedition.active && st.expedition.bagUsed >= st.expedition.bagCapacity),
      expeditionFull: !!(st.expedition.active && st.expedition.bagUsed >= st.expedition.bagCapacity),
      loc: sess.loc.id, pct: Wd.percentile(s, w), mode: sess.mode, period: sess.period,
      date: U.dayKey()
    };
    // турнир дня
    const tour = Wd.tournament();
    if (tour.species === s.id) {
      res.tour = tour;
      const best = st.daily.tour;
      if (!best || w > best.w) { st.daily.tour = { w, sid: s.id, len: f.lenCm, loc: sess.loc.id }; res.tourBest = true; }
      res.tier = null; tour.tiers.forEach((t2) => { if (w >= t2.w) res.tier = t2; });
    }
    rig.fish = null; rig.state = "result"; rig.landing = null; rig.result = res;
    sess.catches++;
    FZ.Sound.flop();
    if (trophy || res.record && !res.newSpecies) FZ.Sound.trophy(); else FZ.Sound.coin();
    emit("catch", { res });
  }

  // Решение по пойманной рыбе
  G.resolveCatch = function (keep, doubled) {
    const r = rig.result; if (!r) return;
    const s = r.s;
    if (r.mustRelease) keep = false;
    let money = 0, xp = r.xp;
    if (keep) {
      money = r.price * (doubled ? 2 : 1); st.money += money;
      if (st.expedition.active) st.expedition.bagUsed = Math.min(st.expedition.bagCapacity, st.expedition.bagUsed + 1);
    }
    else { xp = Math.round(xp * (r.mustRelease ? 2 : 1.5) * (doubled ? 2 : 1)); st.karma++; st.stats.released++; }
    st.caught[s.id] = (st.caught[s.id] || 0) + 1;
    if (r.record) st.records[s.id] = { w: r.w, len: r.len, loc: r.loc, date: r.date };
    // Личный журнал: последние 60 завершённых поимок, включая отпускание.
    st.journal = Array.isArray(st.journal) ? st.journal : [];
    st.journal.unshift({
      sid: s.id, w: r.w, len: r.len, loc: r.loc, mode: r.mode, period: r.period,
      date: r.date, kept: !!keep, trophy: !!r.trophy, record: !!r.record,
      sky: sess.wx.sky, temp: sess.wx.temp
    });
    if (st.journal.length > 60) st.journal.length = 60;
    st.stats.total++; st.stats.kg += r.w;
    if (r.trophy) st.stats.trophies++;
    if (sess.firstIce) st.firstIceCatches++;
    if (st.expedition.active) { st.expedition.catches++; st.expedition.best = Math.max(st.expedition.best, r.w); }
    checkAchievements();
    if (!st.stats.best || r.w > st.stats.best.w) st.stats.best = { sid: s.id, w: r.w };
    // задания
    st.daily.quests.forEach(function (q) {
      if (q.done) return;
      if (q.type === "species" && q.sp === s.id) q.got++;
      else if (q.type === "kg") q.got = +(q.got + r.w).toFixed(2);
      else if (q.type === "release" && !keep) q.got++;
      else if (q.type === "count") q.got++;
      else if (q.type === "trophy" && r.trophy) q.got++;
      else if (q.type === "night" && r.period === "night") q.got++;
      if (q.got >= q.need) { q.done = true; emit("quest", { q }); }
    });
    G.addXP(xp);
    rig.result = null; rig.state = sess.ice ? "wait" : "idle";
    if (sess.ice) { rig.lure = sess.hole ? sess.hole.lure : 0.8; }
    if (st.tut < 3) st.tut = 3;
    G.save(true);
    emit("resolved", { keep, money, xp, r });
    return { money, xp };
  };
  G.claimQuest = function (id) {
    const q = st.daily.quests.find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return 0;
    q.claimed = true; st.money += q.reward; G.addXP(Math.round(q.reward / 6)); G.save(true);
    return q.reward;
  };
  G.claimTour = function (tierId) {
    const tour = Wd.tournament(); const best = st.daily.tour;
    const tier = tour.tiers.find((t2) => t2.id === tierId);
    if (!tier || !best || best.w < tier.w || st.daily.tourClaim.indexOf(tierId) >= 0) return 0;
    st.daily.tourClaim.push(tierId); st.money += tier.prize; G.save(true); return tier.prize;
  };

  // ---------- Главный цикл ----------
  G.update = function (dt, t) {
    if (saveT > 0) { saveT -= dt; if (saveT <= 0) G.save(true); }
    if (!sess) return;
    sess.t += dt;
    sess.weatherAge=(sess.weatherAge||0)+dt;
    const front=Math.floor(sess.weatherAge/150);
    if(front>(sess.weatherFront||0)){
      sess.weatherFront=front;sess.wx=Wd.front(sess.loc.id,sess.season,front,sess.wx);
      emit('time');
    }
    // время суток: 1 игровой час ≈ 75 секунд
    const rawHour = sess.hour + dt / 75 * (rig.state === "fight" ? 0.3 : 1);
    const passedDays = Math.floor(rawHour / 24);
    sess.hour = rawHour % 24;
    for (let day = 0; day < passedDays; day++) expeditionDayPassed();
    const p = FZ.Scene.period(sess.hour, sess.season);
    if (p !== sess.period) { sess.period = p; emit("time"); }
    // пятна активности
    sess.nextSpot -= dt;
    if (sess.nextSpot <= 0) {
      sess.nextSpot = U.rand.range(6, 14);
      if (!sess.ice && sess.spots.length < 2) {
        const hasPred = Object.keys(sess.loc.fish).some((id) => FZ.SP[id].kind === "pred" && FZ.SP[id].time[sess.period] > 0.6 && FZ.SP[id].season[sess.season] > 0.5);
        const type = hasPred && U.rand() < (sess.mode === "spin" ? 0.55 : 0.25) ? "boil" : "bubbles";
        const Z = U.rand.range(6, Math.min(G.maxCast(), sess.loc.zfar - 8));
        sess.spots.push({ type, X: U.rand.range(-0.8, 0.8) * FZ.Scene.maxLat(Z), Z, life: U.rand.range(12, 22) });
      }
      if (!sess.ice && U.rand() < 0.5) FZ.Scene.distantJump();
    }
    sess.spots = sess.spots.filter((s) => (s.life -= dt) > 0);
    if (sess.fedSpot && sess.fedSpot.until < sess.t) sess.fedSpot = null;
    if (sess.fedSpot) sess.fedSpot.level = Math.max(0, sess.fedSpot.level - dt * 0.002);

    const r = rig;
    r.rod.jerk = U.damp(r.rod.jerk, 0, 9, dt);
    r.rod.ring = U.damp(r.rod.ring, 0, 3, dt);
    r.rod.tilt = U.damp(r.rod.tilt, r.state === "fight" || sess.mode === "spin" ? r.tilt : 0, 8, dt);
    r.rod.lift=U.damp(r.rod.lift||0,r.liftTarget||0,9,dt);
    r.jig = Math.max(0, (r.jig || 0) - dt * 0.85);
    r.jigCooldown = Math.max(0, (r.jigCooldown || 0) - dt);
    r.jigPause = Math.min(10, (r.jigPause || 0) + dt);
    if (r.state === "fly") {
      r.flyT += dt / r.flyDur;
      if (r.flyT >= 1) {
        r.flyT = 1; r.state = "settle"; r.settleT = 0;
        FZ.Scene.splash(r.X, r.Z, sess.mode === "feeder" ? 0.4 : 0.15); FZ.Sound.plop(sess.mode === "feeder");
        if (sess.mode === "spin") { r.state = "wait"; r.spinPause = 0; }
        emit("landed");
      }
    } else if (r.state === "settle") {
      r.settleT += dt;
      r.fa.sink = U.damp(r.fa.sink, 0, 4, dt); r.fa.tilt = U.damp(r.fa.tilt, 0, 3, dt);
      if (r.settleT > 0.9) { r.state = "wait"; r.idleT = 0; }
    } else if (r.state === "drill") {
      r.drillT += dt; r.rod.jerk = Math.sin(t * 40) * 0.2;
      if (Math.random() < dt * 10) FZ.Scene.chips(FZ.Scene.holeGeom().x + (Math.random() - 0.5) * 60, FZ.Scene.holeGeom().y, 2);
      if (r.drillT >= r.drillDur) finishDrill();
    } else if (r.state === "wait" || r.state === "bite") {
      if (sess.mode === "spin" && r.state === "wait") spinTick(dt);
      if (sess.mode === "float" && sess.loc.current) { r.X += sess.loc.current * 0.12 * dt; if (Math.abs(r.X) > FZ.Scene.maxLat(r.Z) * 1.05) { r.state = "idle"; emit("msg", { text: "Поплавок снесло течением — перезабросьте" }); } }
      if (r.state === "wait") {
        r.idleT += dt;
        // первая рыба в обучении — быстро и гарантированно
        if (!G.gear(sess.mode).bait || G.baitLeft(G.gear(sess.mode).bait.id) <= 0) { /* без наживки не клюёт */ }
        else if (st.tut < 3 && r.idleT > 2.5) { const sp = FZ.SP[sess.mode === "float" || sess.mode === "feeder" ? "crucian" : "perch"]; startBite(sp, U.rand.range(0.28, 0.45)); }
        else {
          const tbl = G.biteTable();
          let tot = 0; tbl.forEach((x) => (tot += x[1]));
          if (U.rand() < 1 - Math.exp(-tot * dt)) {
            const s = U.weighted(tbl);
            const w = sampleWeight(s);
            const g = G.gear(sess.mode);
            const size = g.hook ? g.hook.size : 2;
            const empty = (size >= 3 && w < 0.09) || (size >= 4 && w < 0.4);
            startBite(s, w, empty);
          }
        }
      }
      if (r.state === "bite") biteTick(dt);
    } else if (r.state === "fight") {
      fightTick(dt, t);
    } else if (r.state === "landing") {
      r.landing.k += dt / (r.landing.duration || 1.2);
      if (r.landing.k >= 1) finishCatch();
    }
    if (r.state !== "fight") { r.rod.tension = U.damp(r.rod.tension, 0, 6, dt); }
    biteAnim(dt, t);
    if(r.state!=='fight' && (r.state!=='wait' || sess.mode!=='spin' || !r.reeling))
      r.rod.reelRate=0;
    r.rod.reelAngle+=dt*14*(r.rod.reelRate||0);
  };
  // Спиннинг: проводка
  function spinTick(dt) {
    const r=rig,g=G.gear(sess.mode);
    const speed=FZ.FightPhysics.lure(r,{zone:g.bait&&g.bait.lure,speed:g.rod.reel,depth:G.depthAt(r.X,r.Z)},dt);
    r.Z-=speed*dt;
    r.X+=((r.tilt||0)*speed*.18-r.X*.12)*dt;
    r.rod.reelRate=r.reeling?speed/Math.max(.1,g.rod.reel):0;
    if(r.reeling&&speed>.05)FZ.Sound.reel(speed);
    if(r.Z<4.2){r.state="idle";emit("msg",{text:"Проводка закончена — бросайте снова"});}
  }

  // Данные для отрисовки
  G.view = function (t) {
    const r = rig;
    // Follow the hooked fish rather than the original cast point.
    const hookedFish = r.fish && r.fish.hooked ? r.fish : null;
    const tackleState = r.state === "fly" ? "fly" : (r.state === "idle" || r.state === "nohole" || r.state === "drill" || r.state === "result") ? "none" : r.state === "fight" ? "fight" : "water";
    const flight = tackleState === "fly" ? FZ.FightPhysics.castPath(r.flyFrom || { X: 0, Z: 4.5 }, { X: r.X, Z: r.Z }, r.flyT || 0, r.flyWind) : null;
    const v = {
      loc: sess.loc, season: sess.season, hour: sess.hour, period: sess.period, wx: sess.wx, t, ice: sess.ice ? { holeId: sess.hole ? sess.hole.id : 0 } : null,
      mode: sess.mode, spots: sess.spots, fedSpot: sess.fedSpot,
      rod: r.rod, tackle: { state: tackleState, X: hookedFish ? hookedFish.X : (flight ? flight.X : r.X), Z: hookedFish ? hookedFish.Z : (flight ? flight.Z : r.Z), flyT: r.flyT, sink: r.fa.sink, tilt: r.fa.tilt, dx: r.fa.dx, bob: 0, reeling: r.reeling && sess.mode === "spin" },
      fish: r.fish ? Object.assign({}, r.fish, { depth: sess.ice ? r.fish.D : null, lenPx: r.fish.lenM * 300 }) : null,
      landing: r.landing ? { k: r.landing.k } : null
    };
    if (sess.ice && r.state === "nohole") v.ice.noHole = true;
    if (sess.ice && r.state === "drill") v.ice.drill = r.drillT / r.drillDur;
    if (r.landing && !v.fish && r.fish) v.fish = r.fish;
    return v;
  };

  FZ.Game = G;
})(window.FZ);

/* Lightweight, deterministic fight dynamics (metres, seconds).
   No renderer, randomness or save-state dependencies. */
(function (FZ) {
  "use strict";
  const P = {};
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const follow = (v, target, accel, dt) => v + clamp(target - v, -accel * dt, accel * dt);

  // A few readable personalities tune the shared physical model. Existing
  // species fight stats still determine base strength and encounter odds.
  const CHARACTERS = Object.freeze({
    roach:    { run: 0.72, forward: 1.12, lateral: 0.85, duration: 0.70, fatigue: 1.32, surge: 0.70 },
    perch:    { run: 1.06, forward: 1.13, lateral: 1.50, duration: 0.78, fatigue: 1.08, surge: 1.03 },
    bream:    { run: 0.80, forward: 0.76, lateral: 0.57, duration: 1.16, fatigue: 0.82, surge: 0.88 },
    carp:     { run: 1.08, forward: 1.12, lateral: 0.95, duration: 1.28, fatigue: 0.87, surge: 1.18, shore: 1.34, recover: 0.23 },
    wildcarp: { run: 1.10, forward: 1.17, lateral: 1.00, duration: 1.32, fatigue: 0.85, surge: 1.20, shore: 1.35, recover: 0.23 },
    pike:     { run: 1.04, forward: 1.16, lateral: 1.55, duration: 0.77, fatigue: 1.10, surge: 1.22, shore: 1.16 },
    catfish:  { run: 0.90, forward: 0.65, lateral: 0.43, duration: 1.32, fatigue: 0.62, surge: 1.04 }
  });
  const DEFAULT_CHARACTER = Object.freeze({
    run: 1, forward: 1, lateral: 1, duration: 1, fatigue: 1, surge: 1, shore: 1, recover: 0
  });
  P.character = function (species) { return CHARACTERS[species && species.id] || DEFAULT_CHARACTER; };
  P.runChance = function (species, fish, distance, ice) {
    const c = P.character(species);
    const base = species && species.fight ? species.fight.runs : 0.4;
    const nearBank = !ice && distance < 12;
    return clamp(base * (0.3 + 0.7 * clamp(fish.S, 0, 1)) * c.run * (nearBank ? (c.shore || 1) : 1), 0.04, 0.78);
  };
  // Once per fight, an exhausted carp can gather strength near the bank.
  // The game schedules a visible warning before its next run.
  P.secondWind = function (species, fish, distance, ice) {
    const recovery = P.character(species).recover || 0;
    if (ice || recovery <= 0 || fish.secondWind || fish.t < 5 || distance >= 12 || fish.S < 0.12 || fish.S >= 0.31) return false;
    fish.secondWind = true;
    fish.S = clamp(fish.S + recovery, 0, 0.54);
    return true;
  };

  // Species and fishing methods share one readable strike timeline while
  // differing in rhythm, strength and signal direction. No save-format fields.
  P.bitePattern = function (species, mode, weight) {
    const s = species || {};
    const bite = s.bite || "twitch";
    const style = mode === "spin" ? "spin" : mode === "ice" ?
      (bite === "lay" || bite === "twitch" ? "lift" : "dip") : bite;
    const touchRanges = {
      twitch: [1, 2], dunk: [0, 1], lay: [1, 3], slide: [1, 2],
      drag: [0, 1], spin: [0, 1], lift: [1, 2], dip: [0, 2]
    };
    const takeTimes = {
      twitch: 1.15, dunk: 1.15, lay: 1.75, slide: 1.55,
      drag: 1.55, spin: 1.25, lift: 1.55, dip: 1.35
    };
    const cadence = bite === "twitch" ? 0.75 : bite === "lay" ? 1.25 :
      bite === "drag" ? 0.85 : 1;
    const size = Math.max(0, Number(weight) || 0);
    const power = clamp(0.31 + 0.23 * Math.log1p(size), 0.31, 1.05);
    return {
      style, touches: touchRanges[style] || [1, 2],
      take: takeTimes[style] || 1.2,
      cadence, power: mode === "spin" ? Math.max(0.65, power) : power
    };
  };
  // Fish respond to little lifts and short pauses, not to endless tapping.
  P.iceAttraction = function (species, jig, pause) {
    const active = clamp(jig || 0, 0, 1), rest = clamp(pause || 0, 0, 10);
    const lureFish = species && (species.kind === "pred" || species.id === "omul" || species.id === "smelt");
    const pauseBonus = rest >= 0.4 && rest <= 2.4 ? 0.24 : 0;
    return lureFish ? 0.62 + active * 1.12 + pauseBonus : 0.85 + active * 0.28 + pauseBonus * 0.5;
  };

  // Constant horizontal flight speed; the renderer supplies the ballistic arc.
  // Wind changes the landing point separately, then adds a mild midair curve.
  P.castPath = function (from, to, progress, wind) {
    const k = clamp(progress, 0, 1);
    const curve = clamp(wind || 0, -1, 1) * 0.7 * k * (1 - k);
    return { X: from.X + (to.X - from.X) * k + curve, Z: from.Z + (to.Z - from.Z) * k };
  };

  // Fish accelerates towards a behavioural target instead of switching
  // velocity instantaneously when a run, turn or rest begins.
  P.swim = function (f, opts, dt) {
    const mass = Math.max(0.55, Math.pow(Math.max(0.05, f.w), 0.38));
    const character = opts.character || DEFAULT_CHARACTER;
    const effort = clamp(opts.effort || 0, 0, 1.6);
    const phase = opts.phase;
    const dir = f.turn || 1;
    const opposing = !opts.ice && Math.abs(opts.tilt || 0) > 0.25 && (opts.tilt || 0) * dir < 0;
    let forward = 0, lateral = 0;
    if (phase === "run") {
      forward = (0.45 + 1.4 * effort) / Math.sqrt(mass);
      lateral = dir * (0.6 + 1.25 * effort) / Math.sqrt(mass) * (opposing ? 0.34 : 1);
    } else if (phase === "toward") {
      forward = -0.75 / Math.sqrt(mass);
      lateral = dir * 0.12;
    } else if (phase === "shake") {
      forward = 0.06;
      lateral = dir * 0.32 * effort;
    } else if (phase === "tired") {
      forward = -0.12;
    } else {
      lateral = dir * 0.18 * effort;
      forward = 0.04 * effort;
    }
    forward *= character.forward;
    lateral *= character.lateral;
    const maxAccel = 2.8 / Math.sqrt(mass);
    f.vz = follow(f.vz || 0, forward * (opts.ice ? 0.65 : 1), maxAccel, dt);
    f.vx = opts.ice ? 0 : follow(f.vx || 0, lateral, maxAccel * (opposing ? 1.35 : 1), dt);
    f.vz *= Math.exp(-0.09 * dt);
    f.vx *= Math.exp(-0.11 * dt);
    return { opposing, vz: f.vz, vx: f.vx };
  };

  // The rod/line is an elastic, damped load; the friction drag releases line
  // before the spool can be wound inward against a running fish.
  P.line = function (f, opts, dt) {
    const rod = opts.rod;
    const maximum = Math.max(0.1, f.Fmax);
    const fishPull = Math.max(0, opts.fishPull);
    const reeling = !!opts.reeling;
    let target = fishPull + (reeling ? 0.08 * rod.power + 0.28 * fishPull + 0.04 * maximum : 0);
    target += Math.max(0, opts.currentLoad) * maximum * (0.3 + 0.7 * Math.abs(f.vx || 0) / 2);
    target += Math.max(0, opts.surge || 0) * maximum;
    target += Math.max(0, f.vz || 0) * maximum * 0.12 + Math.abs(f.vx || 0) * maximum * 0.025;
    if (opts.phase === "toward") target = reeling ? 0.14 * maximum + 0.08 * rod.power : 0.02 * maximum;
    if (opts.phase === "tired") target = reeling ? 0.22 * maximum + 0.06 * rod.power : 0.08 * maximum;
    const spring = clamp(rod.power / maximum, 0.35, 2.2);
    const rate = (3.2 + rod.sens * 2) * spring;
    f.T = Math.max(0, (f.T || 0) + (target - (f.T || 0)) * (1 - Math.exp(-rate * dt)));
    if (opts.jumping) f.T *= 1 + 0.3 * Math.sin(opts.jumpProgress * Math.PI);
    const dragLim = clamp(opts.drag, 0.3, 1) * opts.lineTest;
    const excess = Math.max(0, f.T - dragLim);
    const slipping = excess > 0.01;
    const slipSpeed = slipping ? clamp(0.24 + excess / maximum * 3.2, 0, 4.2) : 0;
    if (slipping) f.T = dragLim + excess * 0.18;
    const reelSp = rod.reel * (1 - 0.52 * clamp(fishPull / maximum, 0, 1)) * (opts.tutorial ? 1.35 : 1);
    const intake = reeling && !slipping ? Math.max(0, reelSp) : 0;
    return { slipping, slipSpeed, intake, excess, tension: f.T };
  };

  FZ.FightPhysics = P;
})(window.FZ);

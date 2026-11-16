/* Lightweight, deterministic fight dynamics (metres, seconds).
   No renderer, randomness or save-state dependencies. */
(function (FZ) {
  "use strict";
  const P = {};
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const follow = (v, target, accel, dt) => v + clamp(target - v, -accel * dt, accel * dt);

  // Fish accelerates towards a behavioural target instead of switching
  // velocity instantaneously when a run, turn or rest begins.
  P.swim = function (f, opts, dt) {
    const mass = Math.max(0.55, Math.pow(Math.max(0.05, f.w), 0.38));
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

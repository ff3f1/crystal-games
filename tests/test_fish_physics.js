/* Deterministic regression tests for the same model used by game.js. */
"use strict";
const assert = require("node:assert/strict");
global.window = { FZ: {} };
require("../games/fish/js/fight-physics.js");
const P = window.FZ.FightPhysics;
const rod = { power: 2.5, sens: 1, reel: 2.8 };
function fish(w = 1) { return { w, Fmax: 1.3, vx: 0, vz: 0, T: 0.3, turn: 1 }; }
function simulate(hz, args = {}) {
  const dt = 1 / hz, f = fish(args.weight || 1);
  let distance = 22, depth = 4, slips = 0, incoming = 0;
  for (let i = 0; i < hz * 8; i++) {
    const phase = args.phase || "run";
    P.swim(f, { phase, effort: 0.85, tilt: args.tilt || 0, ice: !!args.ice }, dt);
    const move = P.line(f, {
      rod, lineTest: args.lineTest || 2, drag: args.drag == null ? 0.7 : args.drag,
      fishPull: args.pull == null ? 0.8 : args.pull, phase, surge: 0,
      currentLoad: 0, reeling: !!args.reeling, tutorial: false, jumping: false
    }, dt);
    if (args.ice) depth += (f.vz * 0.4 + move.slipSpeed * 0.5 - move.intake * 0.55) * dt;
    else distance += (f.vz > 0 ? f.vz * (move.slipping ? 1 : 0.18) : f.vz) * dt + (move.slipSpeed - move.intake) * dt;
    if (move.slipping) slips++;
    incoming += move.intake * dt;
    for (const n of [distance, depth, f.T, f.vx, f.vz, incoming]) assert(Number.isFinite(n), "Non-finite physics state");
  }
  return { f, distance, depth, slips, incoming };
}
function close(a, b, tol, label) { assert(Math.abs(a - b) < tol, label + ": " + a + " vs " + b); }
const steady = simulate(60, { phase: "rest", reeling: true, pull: 0.25 });
assert(steady.incoming > 5, "reel must actually retrieve line");
assert(steady.distance < 22, "reeling must shorten distance");
assert(simulate(60, { phase: "rest", pull: 0.25 }).distance > steady.distance, "release must stop retrieval");
const run = simulate(60, { phase: "run", reeling: true, pull: 2.5, drag: 0.4 });
assert(run.slips > 0, "high load must engage friction drag");
assert(run.incoming < 1, "reel must not win against slipping drag");
assert(run.distance > 22, "fish must be able to take line");
assert(Math.abs(simulate(60, { ice: true }).f.vx) < 1e-9, "fish must not move sideways through an ice hole");
assert(simulate(60, { ice: true, reeling: true, phase: "tired", pull: 0.2 }).depth < 4, "ice mode must reel vertically");
const unsteered = simulate(60, { phase: "run" }).f.vx;
const steered = simulate(60, { phase: "run", tilt: -1 }).f.vx;
assert(Math.abs(steered) < Math.abs(unsteered) * 0.6, "steering must damp a lateral run");
assert(simulate(60, { weight: 6 }).f.vz < simulate(60, { weight: 0.25 }).f.vz, "fish mass must affect acceleration");
for (const hz of [30, 120]) {
  const variant = simulate(hz, { phase: "rest", reeling: true, pull: 0.25 });
  close(variant.distance, steady.distance, 0.15, "FPS-independent distance " + hz);
  close(variant.f.T, steady.f.T, 0.02, "FPS-independent line tension " + hz);
}
console.log("OK: inertia, steering, drag, reel, ice, and 30/60/120Hz invariance");

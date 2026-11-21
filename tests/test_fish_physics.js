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
const SP = (id, runs = 0.6) => ({ id, fight: { runs } });
const pike = P.character(SP("pike")), perch = P.character(SP("perch"));
const catfish = P.character(SP("catfish")), bream = P.character(SP("bream"));
assert(perch.lateral > bream.lateral, "perch should change direction more aggressively than bream");
assert(catfish.forward < pike.forward, "catfish should move more heavily than pike");
assert(P.runChance(SP("carp"), { S: 0.8 }, 7, false) > P.runChance(SP("carp"), { S: 0.8 }, 25, false), "carp should resist near the bank");
assert(P.runChance(SP("perch"), { S: 0.8 }, 20, false) > P.runChance(SP("roach"), { S: 0.8 }, 20, false), "roach should have fewer runs than perch");
assert(P.runChance(SP("pike", 100), { S: 1 }, 3, false) <= 0.78, "run probabilities must be bounded");
function personalityRun(profile, hz) {
  const f = fish(1); f.turn = 1;
  for (let i = 0; i < hz * 4; i++) P.swim(f, { phase: "run", effort: 1, ice: false, character: profile }, 1 / hz);
  return f;
}
assert(Math.abs(personalityRun(perch, 60).vx) > Math.abs(personalityRun(bream, 60).vx), "perch run needs more sideways movement");
const carp = SP("carp"), tiredCarp = { S: 0.2, t: 8 };
assert(!P.secondWind(carp, tiredCarp, 25, false), "second wind must not trigger in open water");
assert(P.secondWind(carp, tiredCarp, 8, false), "carp gets a readable second wind near shore");
assert(tiredCarp.S > 0.2 && tiredCarp.S <= 0.54, "recovery must be bounded");
assert(!P.secondWind(carp, tiredCarp, 8, false), "carp must not recover twice");
assert(!P.secondWind(SP("roach"), { S: 0.2, t: 8 }, 8, false), "small fish must not gain carp recovery");
assert(!P.secondWind(carp, { S: 0.2, t: 8 }, 8, true), "ice hole has no shoreline sprint");
for (const hz of [30, 120]) {
  close(personalityRun(pike, hz).vx, personalityRun(pike, 60).vx, 0.06, "species turn invariant " + hz);
}
const launch = { X: 0, Z: 4.5 }, landing = { X: 2, Z: 30 };
assert.deepEqual(P.castPath(launch, landing, 0, 1), launch, "cast begins near the rod");
assert.deepEqual(P.castPath(launch, landing, 1, 1), landing, "cast reaches the actual landing point");
const halfCast = P.castPath(launch, landing, 0.5, 1);
assert(halfCast.Z > launch.Z && halfCast.Z < landing.Z, "tackle must travel throughout the flight");
assert(halfCast.X > P.castPath(launch, landing, 0.5, 0).X, "wind must bend midair motion");
for (const k of [-1, 0, 0.2, 0.5, 0.8, 1, 2]) {
  const p = P.castPath(launch, landing, k, -1);
  assert(Number.isFinite(p.X) && Number.isFinite(p.Z), "cast coordinates must remain finite");
  assert(p.Z >= launch.Z && p.Z <= landing.Z, "cast progress must stay bounded");
}
const biteSmall = P.bitePattern({ id: "roach", bite: "twitch", kind: "peace" }, "float", 0.1);
const biteLarge = P.bitePattern({ id: "carp", bite: "drag", kind: "peace" }, "float", 10);
assert(biteSmall.touches[0] >= 1 && biteSmall.style === "twitch", "roach should nibble");
assert(biteLarge.power > biteSmall.power, "big fish must produce stronger visible bite feedback");
assert(biteLarge.take >= 1.3, "heavy bite must give a readable reaction window");
assert(P.bitePattern({ bite: "lay" }, "ice", 1).style === "lift", "winter lift bite");
assert(P.bitePattern({ bite: "drag" }, "ice", 1).style === "dip", "winter downward bite");
assert(P.bitePattern({ bite: "dunk" }, "spin", 1).style === "spin", "spinning attack regardless of float style");
assert(P.iceAttraction({ kind: "pred" }, 1, 0) > P.iceAttraction({ kind: "pred" }, 0, 5), "predator responds to jigging");
assert(P.iceAttraction({ kind: "pred" }, 0.3, 1) > P.iceAttraction({ kind: "pred" }, 0.3, 5), "brief pause matters on ice");
for (const species of [{kind:"pred",id:"pike"},{kind:"peace",id:"roach"}]) for (const jig of [-1,0,0.5,1,2]) {
  const v = P.iceAttraction(species, jig, 1);
  assert(Number.isFinite(v) && v >= 0.5 && v <= 2, "winter attraction remains positive and bounded");
}
console.log("OK: inertia, steering, drag, reel, ice, species personalities, shoreline recovery, cast flight, species bites, winter pauses and 30/60/120Hz invariance");

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { boot } = require('./strike-support.cjs');
function setup(mode = 'float', loc = 'pond', season = 'summer') {
  const b = boot({ mode });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../games/fish/js/data.js'), 'utf8'), { window: { FZ: b.FZ } });
  b.FZ.Scene.maxLat = z => z * .35;
  b.G.state().load[mode].rod = { float: 'f3', feeder: 'd2', spin: 's2', ice: 'i1' }[mode];
  b.G.state().load[mode].bait = mode === 'spin' ? 'spinner' : 'worm';
  b.G.state().lures.spinner = 1;
  b.G.startSession(loc, season);
  b.r = b.G.rig(); b.r.state = 'idle'; b.r.Z = 20;
  b.G.sess().hole = { depth: 5, fish: 1, lure: .8 };
  b.G.sess().wx = { peace: 1, pred: 1, wind: 0 };
  b.FZ.World.front = () => b.G.sess().wx;
  b.FZ.Scene.period = () => b.G.sess().period;
  return b;
}
function spot(b, id = 'perch', overrides = {}) {
  const s = b.FZ.SP[id];
  return { type: s.kind === 'pred' ? 'boil' : 'bubbles', X: 0, Z: 20, radius: 4.5,
    born: -3, duration: 33, life: 30, fish: { [id]: 1 }, peak: 1, weight: 1, intensity: 1, ...overrides };
}
module.exports = { setup, spot };

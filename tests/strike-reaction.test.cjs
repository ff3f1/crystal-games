const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./strike-support.cjs');

const cases = [
  ...['twitch', 'dunk', 'lay', 'slide', 'drag'].map(style => ['float', style]),
  ...['twitch', 'dunk', 'lay', 'slide', 'drag'].map(style => ['feeder', style]),
  ['spin', 'spin'], ['ice', 'lift'], ['ice', 'dip']
];

function bite(b, style, take, t = 0) {
  const s = b.species;
  b.r.fish = null; b.r.state = 'bite'; b.r.reeling = false;
  b.r.bite = { s, w: 1.5, style, take, t, phase: 'take', power: .6, cadence: 1 };
  b.G.events();
  return b.r.bite;
}

for (const [mode, style] of cases) for (const fps of [30, 60, 120]) {
  test(`visible cue and guaranteed touch window: ${mode}/${style}, ${fps} FPS`, () => {
    const b = boot({ mode });
    const take = style === 'lay' ? 1.25 : .95;
    const takeBite = bite(b, style, take);
    let first = null, last = null, count = 0;
    for (let frame = 1; frame / fps < take; frame++) {
      b.step(1 / fps);
      const result = b.P.strikeChance(takeBite, mode, { hold: .7 }, false);
      if (result.chance === 1) {
        first ??= frame / fps; last = frame / fps; count++;
        // Observe actual game animation, not just its target/helper.
        if (mode === 'ice') assert.ok(Math.abs(b.r.rod.nod) > .35);
        else if (mode === 'feeder') assert.ok(style === 'lay' ? b.r.rod.bend < .13 : b.r.rod.bend > .45);
        else if (mode === 'float' && style === 'lay') assert.ok(b.r.fa.tilt > .3);
        else if (mode === 'float' && style === 'slide') assert.ok(b.r.fa.dx > 2);
        else assert.ok(Math.abs(b.r.fa.sink) > .12);
      }
    }
    assert.ok(count > 0);
    assert.ok(last - first >= .45, `${mode}/${style}: ${last - first}s`);
  });
}

test('core strikes succeed even with worst RNG; touch/expired never succeed with best RNG', () => {
  for (const [mode, style] of cases) for (const hold of [.4, .7, 1, 1.3]) {
    const b = boot({ mode });
    const takeBite = bite(b, style, 1.5, .9);
    b.G.gear(mode).hook.hold = hold;
    const original = b.FZ.U.rand;
    const badRoll = () => .999999; badRoll.range = original.range;
    b.FZ.U.rand = badRoll;
    assert.equal(b.P.strikeChance(takeBite, mode, { hold }, false).chance, 1);
    b.G.strike(); assert.equal(b.r.state, 'fight');
    for (const phase of ['touch', 'take']) {
      const missed = bite(b, style, 1.5, 1.51); missed.phase = phase;
      const goodRoll = () => 0; goodRoll.range = original.range;
      b.FZ.U.rand = goodRoll;
      b.G.strike(); assert.equal(b.r.state, 'wait');
      assert.equal(b.r.fish, null);
    }
  }
});

test('hook hold widens margins without shrinking any good window', () => {
  const { P } = boot();
  for (const [mode, style] of cases) {
    let improved = 0;
    for (let t = 0; t <= 1.5; t += .005) {
      const f = { style, phase: 'take', t, take: 1.5 };
      const weak = P.strikeChance(f, mode, { hold: .7 }, false).chance;
      const strong = P.strikeChance(f, mode, { hold: 1.2 }, false).chance;
      assert.ok(strong >= weak);
      if (strong > weak + .05) improved++;
    }
    assert.ok(improved > 5);
  }
});

test('marginal outcomes follow the probability, consumed bites cannot reroll', () => {
  const b = boot();
  const takeBite = bite(b, 'twitch', 1, .11);
  const p = b.P.strikeChance(takeBite, 'float', { hold: 1 }, false).chance;
  assert.ok(p > 0 && p < .5);
  const original = b.FZ.U.rand;
  let draws = 0;
  const fail = () => { draws++; return .999; }; fail.range = original.range;
  b.FZ.U.rand = fail;
  b.G.strike(); b.G.strike();
  assert.equal(b.r.state, 'wait'); assert.equal(draws, 1);
  assert.ok(b.G.events().some(e => /Рано/.test(e.text)));
});

test('animation visibly releases tackle as late-strike probability falls', () => {
  for (const [mode, style] of cases) {
    const b = boot({ mode });
    const takeBite = bite(b, style, 1.5);
    const magnitude = () => mode === 'feeder' ? Math.abs(b.r.rod.bend - .28) :
      mode === 'ice' ? Math.abs(b.r.rod.nod) : Math.abs(b.r.fa.sink) + Math.abs(b.r.fa.tilt);
    for (let i = 0; i < 72; i++) b.step(1 / 60);
    const peak = magnitude();
    for (let i = 0; i < 17; i++) b.step(1 / 60);
    assert.ok(magnitude() < peak * .65);
    assert.ok(b.P.strikeChance(takeBite, mode, { hold: 1 }, false).chance < .05);
  }
});

for (const fps of [30, 60, 120]) {
  test(`manual strike outcomes agree across styles at ${fps} FPS`, () => {
    for (const [mode, style] of cases) {
      const b = boot({ mode });
      bite(b, style, 1.5);
      for (let i = 0; i < Math.round(.7 * fps); i++) b.step(1 / fps);
      b.G.strike(); assert.equal(b.r.state, 'fight');
    }
  });
  test(`spin needs sustained load; taps/releases/expiry cannot auto-hook: ${fps} FPS`, () => {
    const b = boot({ mode: 'spin' });
    const f = bite(b, 'spin', 1.25);
    for (let i = 0; i < Math.round(.5 * fps); i++) b.step(1 / fps);
    b.r.reeling = true; b.step(1 / fps);
    assert.equal(b.r.state, 'bite');
    b.r.reeling = false; b.step(1 / fps); assert.equal(f.setPull, 0);
    for (let i = 0; i < 4; i++) {
      b.r.reeling = true; b.step(1 / fps);
      b.r.reeling = false; b.step(1 / fps);
      assert.equal(b.r.state, 'bite');
    }
    // A fresh bite with uninterrupted pull hooks at the same physical time.
    bite(b, 'spin', 1.25); b.r.reeling = true;
    let elapsed = 0;
    while (b.r.state === 'bite' && elapsed < .6) { b.step(1 / fps); elapsed += 1 / fps; }
    assert.equal(b.r.state, 'fight');
    assert.ok(elapsed >= .34 && elapsed <= .4, `${elapsed}`);
    const expired = bite(b, 'spin', 1.25, 1.26);
    expired.setPull = 10; b.r.reeling = true;
    b.step(1 / fps); assert.notEqual(b.r.state, 'fight');
  });
}

test('tutorial keeps an early bite, avoids message spam, and still rejects empty bites', () => {
  for (const mode of ['float', 'feeder', 'spin', 'ice']) {
    const b = boot({ mode }); b.G.state().tut = 0;
    const f = bite(b, mode === 'ice' ? 'lift' : 'twitch', 2);
    f.phase = 'touch'; f.nextTouch = 1; f.touches = 1;
    b.G.strike(); b.G.strike();
    assert.equal(b.r.bite, f); assert.equal(f.t, 0);
    assert.equal(b.G.events().filter(e => /Рано/.test(e.text)).length, 1);
    f.phase = 'take'; f.t = .08;
    assert.ok(b.P.strikeChance(f, mode, { hold: 1 }, true).chance < 1);
    b.G.strike(); assert.equal(b.r.bite, f); assert.equal(f.t, .08);
    f.phase = 'take'; f.t = .7;
    b.G.strike(); assert.equal(b.r.state, 'fight');
    const empty = bite(b, 'twitch', 2, .7); empty.empty = true;
    b.G.strike(); assert.equal(b.r.state, 'wait');
  }
});

test('actual bite creation enforces touch-friendly floors and preserves tutorial extension', () => {
  for (const [mode, style] of cases) for (const tut of [0, 3]) {
    const b = boot({ mode, sens: .2 });
    const species = { ...b.r.fish.s, bite: style === 'lift' ? 'lay' : style === 'dip' ? 'dunk' : style };
    // Existing tutorial bite path calls private startBite with real data.
    b.FZ.SP = { crucian: species, perch: species };
    b.G.state().tut = 0;
    b.r.fish = null; b.r.bite = null; b.r.state = 'wait'; b.r.idleT = 3;
    b.r.lureDepth = 2;
    b.step(1 / 60);
    assert.equal(b.r.state, 'bite');
    const floor = b.r.bite.style === 'lay' ? 1.25 : .95;
    assert.ok(b.r.bite.take >= floor * 2.2 - 1e-9);
    // Now force a non-tutorial bite through the same existing table path.
    if (tut === 3) {
      b.G.state().tut = 3;
      b.G.biteTable = () => [[species, 1e9]];
      b.FZ.U.weighted = () => species;
      species.min = .2; species.max = 2; species.med = .5; species.sigma = .1;
      b.FZ.U.rand.normal = () => 0;
      b.r.state = 'wait'; b.r.bite = null;
      b.step(1 / 60);
      assert.equal(b.r.state, 'bite');
      assert.ok(Math.abs(b.r.bite.take - floor) < 1e-9);
    }
  }
});

test('touch-to-take transition builds the winter cue instead of a false full nod', () => {
  for (const style of ['lift', 'dip']) for (const fps of [30, 60, 120]) {
    const b = boot({ mode: 'ice' });
    const f = bite(b, style, 1.35);
    Object.assign(f, { phase: 'touch', nextTouch: 0, touches: 0 });
    b.r.rod.nod = 0;
    b.step(1 / fps);
    assert.equal(f.phase, 'take');
    assert.equal(f.t, 0);
    assert.equal(b.r.rod.nod, 0);
    assert.equal(b.P.strikeChance(f, 'ice', { hold: 1 }, false).chance, 0);
    for (let i = 0; i < Math.round(.4 * fps); i++) b.step(1 / fps);
    assert.ok(Math.abs(b.r.rod.nod) > .6);
    b.G.strike(); assert.equal(b.r.state, 'fight');
  }
});

test('irregular 30/60/120 FPS frames preserve the reaction and spin pull', () => {
  for (const mode of ['float', 'feeder', 'spin', 'ice']) {
    const b = boot({ mode });
    bite(b, mode === 'ice' ? 'lift' : mode === 'spin' ? 'spin' : 'lay', 1.5);
    const steps = [1 / 30, 1 / 120, 1 / 60, 1 / 30, 1 / 60];
    let elapsed = 0, i = 0;
    b.r.reeling = mode === 'spin';
    while (elapsed < .75 && b.r.state === 'bite') {
      const dt = steps[i++ % steps.length]; elapsed += dt; b.step(dt);
    }
    if (mode !== 'spin') b.G.strike();
    assert.equal(b.r.state, 'fight');
    if (mode === 'spin') assert.ok(elapsed >= .34 && elapsed <= .4);
  }
});

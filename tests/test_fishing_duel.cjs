/* Run against a served games/fish directory with FISH_URL and CHROME_PATH. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.FISH_URL || 'http://127.0.0.1:8770';
const output = process.env.FISH_OUT;
const script = async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true });
  const errors = [];
  async function open() {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
    await page.addInitScript(() => {
      window.adCount = 0;
      window.AndroidAds = { showRewarded() { adCount++; }, showInterstitial() { adCount++; } };
      window.AndroidShare = {
        shareImage(image, text) { window.lastShare = { length: image.length, text }; },
        pasteChallenge() { return window.clipCode || ''; },
        copyChallenge(text) { window.clipCode = text; return true; }
      };
    });
    await page.goto(url);
    await page.locator('#mDuel').waitFor();
    return page;
  }

  async function playCast(page, hitSpot) {
    return page.evaluate(hit => {
      const { Game: G, Duel: D } = FZ;
      const s = G.sess(), run = s.duel;
      const p = D.spot(run, s.t);
      if (!G.cast(hit ? p.X : 0, hit ? p.Z : 4.5)) throw Error('Could not cast');
      const count = run.rows.length;
      let took = false;
      for (let i = 0; i < 4800 && run.rows.length === count; i++) {
        const r = G.rig(), b = r.bite;
        if (b && b.phase === 'take' && b.t / b.take >= 0.43) { took = true; G.strike(); }
        if (r.state === 'fight') {
          const f = r.fish;
          r.reeling = !f.warning && !f.strained && f.phase !== 'run';
          r.tilt = f.runSpeed > 0 ? -.9 : .9;
        }
        G.update(1 / 60, s.t);
        G.events().forEach(FZ.UI.onEvent);
      }
      if (!took || run.rows.length !== count + 1) throw Error('Could not finish cast ' + count);
      return run.rows[count];
    }, hitSpot);
  }

  const page = await open();
  const variety = await page.evaluate(() => {
    const D = FZ.Duel, venues = new Set();
    for (let day = D.today(); day < D.today() + 365; day++) {
      const r = D.rules(day);
      if (r.rounds.length !== 3 || r.rounds.some(x => !x.fish || !r.loc.fish[x.fish.id])) return 0;
      venues.add(r.loc.id);
    }
    return venues.size;
  });
  assert.equal(variety, 4);
  const initial = await page.evaluate(() => {
    const G = FZ.Game;
    G.startSession('pond', 'winter');
    G.state().money = 505;
    G.setDrag(.83);
    G.save(true);
    window.home = G.sess();
    return localStorage.getItem('fz_save');
  });
  await page.click('#mDuel');
  await page.click('#duelStart');
  await page.locator('#hDuel').waitFor();
  assert(await page.evaluate(() => FZ.Game.sess().duel && FZ.Game.sess().mode === 'float'));
  const runDay = await page.evaluate(() => FZ.Game.sess().duel.rules.day);
  const first = await playCast(page, true);
  assert(first.sid && first.spot === 250 && first.hook === 150 && first.total >= 400, JSON.stringify(first));
  await page.click('#duelNext');
  const second = await playCast(page, false);
  assert(second.sid && second.spot === 0);
  await page.click('#duelNext');
  const third = await playCast(page, true);
  await page.locator('#duelShare').waitFor();
  const score = first.total + second.total + third.total;
  assert.equal(await page.evaluate(day => FZ.Duel.best(day).score, runDay), score);
  const code = await page.locator('#duelCode').inputValue();
  await page.click('#duelCopy');
  assert.equal(await page.evaluate(() => window.clipCode), code);
  await page.click('#duelShare');
  const shared = await page.evaluate(() => window.lastShare);
  assert(shared.length > 20000 && shared.text.includes(code) && shared.text.includes('rustore.ru'));
  if (output) {
    await page.screenshot({ path: path.join(output, 'duel-result.png') });
    const card = await page.evaluate(() => { const run = FZ.Game.sess().duel; return FZ.Duel.card({ day: run.rules.day, score: run.score, rows: run.rows }).toDataURL(); });
    fs.writeFileSync(path.join(output, 'duel-share.png'), Buffer.from(card.split(',')[1], 'base64'));
  }
  assert.equal(await page.evaluate(() => { FZ.Game.save(true); return localStorage.getItem('fz_save'); }), initial);
  assert.equal(await page.evaluate(() => window.adCount), 0);
  await page.click('#duelReplay');
  await page.locator('#hDuel').waitFor();
  assert.equal(await page.evaluate(() => FZ.Game.sess().duel.rows.length), 0);
  await page.click('#bMenu');
  await page.click('#duelLeave');
  assert.equal(await page.evaluate(() => FZ.Game.sess() === window.home && FZ.Game.drag() === .83), true);

  const friend = await open();
  await friend.click('#mDuel');
  await friend.fill('#duelInput', 'not a code');
  await friend.click('#duelForm button[type=submit]');
  await friend.locator('#duelError').waitFor();
  await friend.evaluate(value => window.clipCode = value, code);
  await friend.click('#duelPaste');
  await friend.click('#duelForm button[type=submit]');
  assert.equal(await friend.evaluate(() => FZ.Game.sess().duel.target), score);
  const theirs = await playCast(friend, true);
  assert.deepEqual(theirs, first);
  await friend.click('#duelNext');
  assert.deepEqual(await playCast(friend, false), second);
  await friend.click('#duelNext');
  assert.deepEqual(await playCast(friend, true), third);
  assert.equal(await friend.locator('.duel-result h2').textContent(), 'Ничья');
  assert.equal(await friend.evaluate(() => window.adCount), 0);
  assert.deepEqual(errors, []);
  console.log('PASS three seeded casts, accuracy and timing bonuses, save isolation, personal best, Android share payload, valid friend code, tie and retry');
  await browser.close();
};
script().catch(error => { console.error(error); process.exit(1); });
